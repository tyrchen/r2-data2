use std::ops::Deref;

use super::{MySqlPoolHandler, PoolHandler, TableInfo, TableSchema};
use crate::{config::DatabaseConfig, error::AppError};
use serde_json::Value;
use sqlx::{MySqlPool, mysql::MySqlPoolOptions};

impl PoolHandler for MySqlPoolHandler {
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError> {
        let pool = MySqlPoolOptions::new()
            .max_connections(5)
            .connect(&db_config.conn_string)
            .await?;
        Ok(MySqlPoolHandler(pool))
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        // TODO: not verified
        let tables = sqlx::query_as::<sqlx::MySql, TableInfo>(
            r#"
            SELECT
                CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as name,
                CASE TABLE_TYPE
                    WHEN 'BASE TABLE' THEN 'table'
                    WHEN 'VIEW' THEN 'view'
                    ELSE TABLE_TYPE
                END as type
            FROM information_schema.tables
            WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
            AND TABLE_NAME NOT LIKE '\_%'
            ORDER BY name
        "#,
        )
        .fetch_all(&self.0)
        .await?;
        Ok(tables)
    }

    async fn get_table_schema(&self, _table_name: &str) -> Result<TableSchema, AppError> {
        // TODO: Implement MySQL schema retrieval
        Err(AppError::NotImplemented(
            "MySQL get_table_schema not yet implemented".to_string(),
        ))
    }

    async fn sanitize_query(&self, _query: &str) -> Result<String, AppError> {
        // TODO: Implement MySQL sanitization
        Err(AppError::NotImplemented(
            "MySQL sanitize_query not yet implemented".to_string(),
        ))
    }

    async fn execute_query(&self, _query: &str) -> Result<Value, AppError> {
        // TODO: Implement MySQL execution
        Err(AppError::NotImplemented(
            "MySQL execute_query not yet implemented".to_string(),
        ))
    }
}

impl Deref for MySqlPoolHandler {
    type Target = MySqlPool;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
