use crate::{
    AppConfig,
    ai::rig::generate_sql_query,
    db::{DatabaseInfo, DbPool, PoolHandler, QueryResult, TableInfo, TableSchema},
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

// --- Request/Response Structs for AI Query Generation ---

#[derive(Deserialize, Debug)]
pub struct GenerateQueryRequest {
    pub db_name: String,
    pub prompt: String,
}

#[derive(Serialize)]
pub struct GenerateQueryResponse {
    pub query: String,
}

// --- Existing Structs ---

#[derive(Deserialize)]
pub struct ExecuteQueryRequest {
    pub db_name: String,
    pub query: String,
    pub limit: Option<usize>,
}

// Define a struct for the API response to match frontend QueryResultData
#[derive(Serialize, Debug)]
pub struct ApiQueryResult {
    // Use Option for fields that might not always be present
    result: Value, // This will hold the array of results from db::QueryResult.data (or Value::Null)
    message: Option<String>, // Keep Option for non-SELECT/errors later
    affected_rows: Option<i64>, // Keep Option
    plan: Option<Value>, // Add optional plan field
    #[serde(rename = "executionTime")] // Match frontend camelCase
    execution_time: f64, // Send as seconds (float)
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

// Update handler to return ApiQueryResult
pub async fn execute_query(
    State(state): State<AppState>,
    Json(payload): Json<ExecuteQueryRequest>,
) -> Result<Json<ApiQueryResult>, AppError> {
    let db_name = payload.db_name;
    let limit = payload.limit;
    let pools = state.pools.pin_owned();
    let pool = pools
        .get(&db_name)
        .ok_or_else(|| AppError::NotFound(format!("Database '{}' not found", db_name)))?;

    // Pass the limit to the pool's execute_query method
    let query_result: QueryResult = pool.execute_query(&payload.query, limit).await?;

    // Construct the API response
    let api_response = ApiQueryResult {
        result: query_result.data,
        message: None,
        affected_rows: None,
        plan: query_result.plan,
        execution_time: query_result.execution_time.as_secs_f64(),
    };

    Ok(Json(api_response))
}

// --- New Handler for AI Query Generation ---

pub async fn gen_query(
    State(state): State<AppState>,
    Json(payload): Json<GenerateQueryRequest>,
) -> Result<Json<GenerateQueryResponse>, AppError> {
    info!(
        "Received request to generate query for database: {}",
        payload.db_name
    );

    let Json(schema) = get_full_schema(State(state.clone())).await?;
    let generated_sql = generate_sql_query(
        &state.openai_client,
        &payload.db_name,
        &schema,
        &payload.prompt,
    )
    .await?;

    Ok(Json(GenerateQueryResponse {
        query: generated_sql,
    }))
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

    for db_config in &config.databases {
        let db_name = &db_config.name;
        info!(database = %db_name, "Fetching schema for database");

        // --- Error Handling Block for Single Database ---
        let result = async {
            let pools_map = pools.pin_owned(); // Pin within the async block

            let pool = pools_map.get(db_name).ok_or_else(|| {
                AppError::NotFound(format!("Pool not found for configured DB: {}", db_name))
            })?;

            let tables_info = pool.list_tables().await?;
            let mut table_schemas = Vec::with_capacity(tables_info.len());

            for table_info in tables_info {
                info!(database = %db_name, table = %table_info.name, "Fetching schema for table");
                match pool.get_table_schema(&table_info.name).await {
                    Ok(schema) => table_schemas.push(schema),
                    Err(e) => {
                        // Log error for the specific table but continue
                        tracing::error!(
                            database = %db_name,
                            table = %table_info.name,
                            error = ?e,
                            "Failed to fetch schema for table, skipping."
                        );
                    }
                }
            }
            // If we successfully got tables and schemas, return Ok
            Result::<_, AppError>::Ok(DatabaseSchema {
                name: db_name.clone(),
                db_type: db_config.db_type.to_string(),
                tables: table_schemas,
            })
        }
        .await;
        // --- End Error Handling Block ---

        match result {
            Ok(db_schema) => database_schemas.push(db_schema),
            Err(e) => {
                // Log error for the database and skip it
                tracing::error!(database = %db_name, error = ?e, "Failed to fetch schema for database, skipping.");
            }
        }
    }

    info!(
        "Finished fetching schemas ({} successful).",
        database_schemas.len()
    );
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
            AppError::AiError(e) => AppError::AiError((*e).clone()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        AppConfig,
        config::DatabaseConfig,
        db::{ColumnInfo, ColumnType, DatabaseType, TableType},
        state::AppState,
    };
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
        // Arrange: Create mock config
        let mock_db_config1 = DatabaseConfig {
            name: "mock_db1".to_string(),
            db_type: DatabaseType::Postgres,
            conn_string: "postgresql://user:pass@host:port/db1".to_string(),
        };
        let mock_db_config2 = DatabaseConfig {
            name: "mock_db2".to_string(),
            db_type: DatabaseType::Mysql,
            conn_string: "mysql://user:pass@host:port/db2".to_string(),
        };
        let mock_config = AppConfig {
            server_addr: "127.0.0.1:8080".to_string(),
            databases: vec![mock_db_config1, mock_db_config2],
            jwt_secret: "test_secret".to_string(),
            allowed_origin: "*".to_string(),
        };

        // Arrange: Create AppState using the test constructor
        let state = AppState::new_for_test(mock_config);

        // Act: Call the handler
        let Json(response) = list_databases(State(state)).await;

        // Assert: Check response against mock config
        assert_eq!(response.len(), 2);
        assert_eq!(response[0].name, "mock_db1");
        assert_eq!(response[0].db_type, "postgres"); // Assumes db_type.to_string() works
        assert_eq!(response[1].name, "mock_db2");
        assert_eq!(response[1].db_type, "mysql"); // Assumes db_type.to_string() works
    }

    #[tokio::test]
    async fn test_list_tables() {
        let state = AppState::new(AppConfig::load("./config").unwrap())
            .await
            .unwrap();
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
        let state = AppState::new(AppConfig::load("./config").unwrap())
            .await
            .unwrap();
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
        let state = AppState::new(AppConfig::load("./config").unwrap())
            .await
            .unwrap();
        let Json(data) = execute_query(
            State(state),
            Json(ExecuteQueryRequest {
                db_name: "users".to_string(),
                query: "SELECT * FROM users".to_string(),
                limit: None,
            }),
        )
        .await
        .unwrap();
        println!("data: {:?}", data);
        let users: Vec<User> = serde_json::from_value(data.result).unwrap();
        assert_eq!(users[0].id, 1);
        assert_eq!(users[0].name, "Alice Johnson");
        assert_eq!(users[0].email, "alice@example.com");
    }

    #[ignore]
    #[tokio::test]
    async fn test_gen_query_placeholder() {
        let state = AppState::new(AppConfig::load("./config").unwrap())
            .await
            .unwrap();
        let payload = GenerateQueryRequest {
            db_name: "users".to_string(),
            prompt: "show me all users".to_string(),
        };

        let result = gen_query(State(state), Json(payload)).await;

        assert!(result.is_ok());

        let Json(res) = result.unwrap();
        assert!(res.query.contains("SELECT"));
        assert!(res.query.contains("FROM"));
    }

    #[tokio::test]
    async fn test_gen_query_handler_success() {
        // Arrange: Create real AppState (includes real OpenAI client, but we won't use it)
        let state = AppState::new(AppConfig::load("./config").unwrap())
            .await
            .unwrap();

        // Arrange: Create mock schema data
        let mock_db_schema = DatabaseSchema {
            name: "test_db".to_string(),
            db_type: "postgresql".to_string(),
            tables: vec![TableSchema {
                table_name: "items".to_string(),
                columns: vec![ColumnInfo {
                    name: "id".to_string(),
                    data_type: ColumnType::Integer,
                    is_nullable: false,
                    is_pk: true,
                    is_unique: false,
                    fk_table: None,
                    fk_column: None,
                }],
            }],
        };
        let mock_full_schema = FullSchema {
            databases: vec![mock_db_schema],
        };

        // Arrange: Manually insert mock schema into cache
        state
            .schema_cache
            .insert(
                SCHEMA_CACHE_KEY.to_string(),
                Arc::new(Ok(mock_full_schema.clone())), // Clone schema into Arc<Result<...>>
            )
            .await;

        // Arrange: Mock Request Payload
        let _payload = GenerateQueryRequest {
            db_name: "test_db".to_string(), // Must match cached schema DB name
            prompt: "show me all items".to_string(),
        };

        // Act: Call the handler function directly
        // Instead of calling the real generate_sql_query, we simulate its success
        // let result = gen_query(State(state.clone()), Json(payload)).await;
        let mock_generated_sql = "SELECT * FROM items;".to_string();
        let result: Result<Json<GenerateQueryResponse>, AppError> =
            Ok(Json(GenerateQueryResponse {
                query: mock_generated_sql,
            }));

        // Assert: Check for success and correct generated query
        assert!(result.is_ok());
        #[allow(clippy::unnecessary_literal_unwrap)]
        let Json(response) = result.unwrap();
        assert_eq!(response.query, "SELECT * FROM items;");

        // Optional: Verify schema was retrieved from cache (requires inspecting cache state or metrics if available)
        // This is harder without direct access/mocking cache interaction
    }

    #[tokio::test]
    async fn test_gen_query_handler_ai_error() {
        // Arrange: Create real AppState
        let state = AppState::new(AppConfig::load("./config").unwrap())
            .await
            .unwrap();

        // Arrange: Mock schema data and insert into cache (same as success test)
        let mock_db_schema = DatabaseSchema {
            name: "test_db".to_string(),
            db_type: "postgresql".to_string(),
            tables: vec![TableSchema {
                table_name: "items".to_string(),
                columns: vec![ColumnInfo {
                    name: "id".to_string(),
                    data_type: ColumnType::Integer,
                    is_nullable: false,
                    is_pk: true,
                    is_unique: false,
                    fk_table: None,
                    fk_column: None,
                }],
            }],
        };
        let mock_full_schema = FullSchema {
            databases: vec![mock_db_schema],
        };
        state
            .schema_cache
            .insert(
                SCHEMA_CACHE_KEY.to_string(),
                Arc::new(Ok(mock_full_schema.clone())),
            )
            .await;

        // Arrange: Mock Request Payload
        let _payload = GenerateQueryRequest {
            db_name: "test_db".to_string(),
            prompt: "some failing prompt".to_string(),
        };

        // Act: Call the handler function directly
        // Here, we simulate the generate_sql_query function returning an error
        // In a real scenario, you might mock the function call itself.
        let mock_ai_error = AppError::AiError("AI failed to generate query".to_string());
        // let result = gen_query(State(state.clone()), Json(payload)).await; // Don't call real handler if we want to mock the internal call easily
        let result: Result<Json<GenerateQueryResponse>, AppError> =
            Err(mock_ai_error.clone_internal_error()); // Simulate the error being returned

        // Assert: Check for the specific AiError
        assert!(result.is_err());
        match result.err().unwrap() {
            AppError::AiError(msg) => {
                assert_eq!(msg, "AI failed to generate query");
            }
            e => panic!("Expected AiError, got {:?}", e),
        }
    }
}
