use crate::{
    AppConfig,
    db::{DatabaseInfo, DbPool, PoolHandler, TableInfo, TableSchema},
    error::AppError,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;
use tracing::{info, instrument};

// --- New Schema Structs ---

/// Represents the complete schema for all configured databases.
#[derive(Serialize, Clone, Debug)]
pub struct FullSchema {
    pub databases: Vec<DatabaseSchema>,
}

/// Represents the schema for a single database, including its tables.
#[derive(Serialize, Clone, Debug)]
pub struct DatabaseSchema {
    pub name: String,
    pub db_type: String,
    pub tables: Vec<TableSchema>,
}

// --- Existing Structs ---

#[derive(Deserialize)]
pub struct ExecuteQueryRequest {
    pub db_name: String,
    pub query: String,
}

// Placeholder handler for authenticated routes
pub async fn ping() -> Json<Value> {
    Json(json!({ "message": "pong" }))
}

// Handler to list configured databases
pub async fn list_databases(State(state): State<AppState>) -> Json<Vec<DatabaseInfo>> {
    let databases_info: Vec<DatabaseInfo> = state
        .config
        .databases
        .iter()
        .map(|db_config| DatabaseInfo {
            name: db_config.name.clone(),
            db_type: db_config.db_type.to_string(), // Convert enum to string
        })
        .collect();

    Json(databases_info)
}

pub async fn list_tables(
    State(state): State<AppState>,
    Path(db_name): Path<String>,
) -> Result<Json<Vec<TableInfo>>, AppError> {
    // Directly access the pool via the Arc'd HashMap
    // Papaya hashmap is designed for concurrent reads
    let pools = state.pools.pin_owned();
    let pool = pools
        .get(&db_name)
        .ok_or_else(|| AppError::NotFound(format!("Database '{}' not found", db_name)))?;

    let tables = pool.list_tables().await?;
    Ok(Json(tables))
}

pub async fn get_table_schema(
    State(state): State<AppState>,
    Path((db_name, table_name)): Path<(String, String)>,
) -> Result<Json<TableSchema>, AppError> {
    let pools = state.pools.pin_owned();
    let pool = pools
        .get(&db_name)
        .ok_or_else(|| AppError::NotFound(format!("Database '{}' not found", db_name)))?;

    // Call the abstracted method on the pool
    let schema = pool.get_table_schema(&table_name).await?;

    Ok(Json(schema))
}

pub async fn execute_query(
    State(state): State<AppState>,
    Json(payload): Json<ExecuteQueryRequest>,
) -> Result<Json<Value>, AppError> {
    let db_name = payload.db_name;
    let pools = state.pools.pin_owned();
    let pool = pools
        .get(&db_name)
        .ok_or_else(|| AppError::NotFound(format!("Database '{}' not found", db_name)))?;

    let sql = pool.sanitize_query(&payload.query).await?;
    let data = pool.execute_query(&sql).await?;
    Ok(Json(data))
}

// --- New Schema Fetching Logic ---

const SCHEMA_CACHE_KEY: &str = "full_schema";

/// Fetches the schema for all tables in all configured databases.
/// This function performs the actual data fetching and is intended to be called by the cached handler.
#[instrument(skip(pools, config))] // Instrument for tracing, skip large args
async fn fetch_full_schema_impl(
    pools: Arc<papaya::HashMap<String, DbPool>>,
    config: &AppConfig,
) -> Result<FullSchema, AppError> {
    info!("Fetching full schema from databases...");
    let mut database_schemas = Vec::new();

    // Use config to get the list and types of databases
    for db_config in &config.databases {
        let db_name = &db_config.name;
        info!(database = %db_name, "Fetching schema for database");
        let pools = pools.pin_owned();

        // Get a clone of the pool directly from the Arc<HashMap>
        // Assumes DbPool is Clone (which it should be if it wraps Arc<sqlx::Pool>)
        let pool = pools.get(db_name).ok_or_else(|| {
            AppError::Database(sqlx::Error::Configuration(
                format!(
                    "Internal consistency error: Pool not found for configured DB: {}",
                    db_name
                )
                .into(),
            ))
        })?;

        // Now we can await without holding a non-Send guard
        let tables_info = pool.list_tables().await?;
        let mut table_schemas = Vec::with_capacity(tables_info.len());

        for table_info in tables_info {
            info!(database = %db_name, table = %table_info.name, "Fetching schema for table");
            match pool.get_table_schema(&table_info.name).await {
                Ok(schema) => table_schemas.push(schema),
                Err(e) => {
                    // Log error but continue fetching other schemas
                    tracing::error!(
                        database = %db_name,
                        table = %table_info.name,
                        error = ?e,
                        "Failed to fetch schema for table, skipping."
                    );
                }
            }
        }

        database_schemas.push(DatabaseSchema {
            name: db_name.clone(),
            db_type: db_config.db_type.to_string(),
            tables: table_schemas,
        });
    }

    info!("Successfully fetched full schema.");
    Ok(FullSchema {
        databases: database_schemas,
    })
}

/// Axum handler to get the full schema, using a cache.
pub async fn get_full_schema(State(state): State<AppState>) -> Result<Json<FullSchema>, AppError> {
    // Access the cache from the AppState
    let cached_result_arc = state
        .schema_cache
        .get_with(SCHEMA_CACHE_KEY.to_string(), async {
            // If not in cache, call the implementation function
            let pools = Arc::clone(&state.pools);
            let result = fetch_full_schema_impl(pools, &state.config).await;
            // Wrap the result in Arc before returning for caching
            Arc::new(result)
        })
        .await; // .await here returns Arc<Result<...>>

    // let result = (*cached_result_arc).clone()?; // Clone the Result inside Arc, then use ?

    // Match on the Result inside the Arc
    match &*cached_result_arc {
        // Deref Arc once, then borrow Result
        Ok(schema) => Ok(Json(schema.clone())), // Clone the FullSchema if Ok
        Err(e) => Err(e.clone_internal_error()), // Clone the error if Err (requires helper)
    }

    // The result is now FullSchema
    // Ok(Json(result))
}

// --- Helper needed for AppError ---
impl AppError {
    // Helper to clone error variants that don't contain non-Clone types
    // NOTE: This is a simplified clone. If an error like Database(sqlx::Error)
    // needs to be returned from cache, it creates a generic Database error.
    fn clone_internal_error(&self) -> AppError {
        match self {
            AppError::Auth(e) => AppError::Auth((*e).clone()), // Clone the inner AuthError value
            AppError::Database(_) => AppError::Database(sqlx::Error::PoolClosed), // Return a generic, cloneable DB error
            AppError::UnsupportedDatabaseType(s) => AppError::UnsupportedDatabaseType(s.clone()),
            AppError::Config(_) => {
                AppError::Config(config::ConfigError::NotFound("cached config error".into()))
            } // Generic cloneable config error
            AppError::NotFound(s) => AppError::NotFound(s.clone()),
            AppError::NotImplemented(s) => AppError::NotImplemented(s.clone()),
            AppError::BadRequest(s) => AppError::BadRequest(s.clone()),
            AppError::SqlParsingError(s) => AppError::SqlParsingError(s.clone()),
            AppError::InvalidQueryResult(s) => AppError::InvalidQueryResult(s.clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AppConfig, TableType, db::ColumnType, state::AppState};
    use axum::{Json, extract::State};

    #[derive(Deserialize)]
    struct User {
        id: i32,
        name: String,
        email: String,
        #[allow(dead_code)]
        password: String,
    }

    #[tokio::test]
    async fn test_list_databases() {
        let state = AppState::new(AppConfig::load().unwrap()).await.unwrap();
        let Json(response) = list_databases(State(state)).await;
        assert_eq!(response.len(), 1);
        assert_eq!(response[0].name, "users");
        assert_eq!(response[0].db_type, "postgres");
    }

    #[tokio::test]
    async fn test_list_tables() {
        let state = AppState::new(AppConfig::load().unwrap()).await.unwrap();
        let Json(response) = list_tables(State(state), Path("users".to_string()))
            .await
            .unwrap();
        println!("response: {:?}", response);
        assert_eq!(response.len(), 5);
        assert_eq!(response[0].name, "public.repositories");
        assert_eq!(response[0].table_type, TableType::Table);
    }

    #[tokio::test]
    async fn test_get_table_schema() {
        let state = AppState::new(AppConfig::load().unwrap()).await.unwrap();
        let Json(response) = get_table_schema(
            State(state),
            Path(("users".to_string(), "repository_members".to_string())),
        )
        .await
        .unwrap();
        assert_eq!(response.columns.len(), 3);
        assert_eq!(response.columns[0].name, "id");
        assert_eq!(response.columns[0].data_type, ColumnType::Integer);
        assert!(!response.columns[0].is_nullable);
        assert!(response.columns[0].is_pk);
        assert!(response.columns[0].is_unique);

        assert_eq!(response.columns[1].name, "repository_id");
        assert_eq!(response.columns[1].data_type, ColumnType::Integer);
        assert!(!response.columns[1].is_nullable);
        assert!(!response.columns[1].is_pk);
        assert!(response.columns[1].is_unique);
        assert_eq!(
            response.columns[1].fk_table,
            Some("repositories".to_string())
        );
        assert_eq!(response.columns[1].fk_column, Some("id".to_string()));

        assert_eq!(response.columns[2].name, "user_id");
        assert_eq!(response.columns[2].data_type, ColumnType::Integer);
        assert!(!response.columns[2].is_nullable);
        assert!(!response.columns[2].is_pk);
        assert!(response.columns[2].is_unique);
        assert_eq!(response.columns[2].fk_table, Some("users".to_string()));
        assert_eq!(response.columns[2].fk_column, Some("id".to_string()));
    }

    // TODO: Add test for get_full_schema, potentially mocking DB interactions

    #[tokio::test]
    async fn test_execute_query() {
        let state = AppState::new(AppConfig::load().unwrap()).await.unwrap();
        let Json(data) = execute_query(
            State(state),
            Json(ExecuteQueryRequest {
                db_name: "users".to_string(),
                query: "SELECT * FROM users".to_string(),
            }),
        )
        .await
        .unwrap();
        println!("data: {:?}", data);
        let users: Vec<User> = serde_json::from_value(data).unwrap();
        assert_eq!(users[0].id, 1);
        assert_eq!(users[0].name, "Alice Johnson");
        assert_eq!(users[0].email, "alice@example.com");
    }
}
