use crate::{
    db::{DatabaseInfo, PoolHandler, TableInfo, TableSchema},
    error::AppError,
    state::AppState,
};
use axum::{
    Json,
    extract::{Path, State},
};
use serde::Deserialize;
use serde_json::{Value, json};

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
