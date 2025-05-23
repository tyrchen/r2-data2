use crate::{
    config::DatabaseConfig,
    db::{ColumnInfo, ColumnType, PoolHandler, QueryResult, TableSchema, TableInfo},
    error::AppError,
};
use async_trait::async_trait;
use redis::{aio::MultiplexedConnection, AsyncCommands, Cmd, Value as RedisValue};
use serde_json::{json, Value as JsonValue};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)] // Clone is possible because MultiplexedConnection is cloneable
pub struct RedisPoolHandler(MultiplexedConnection);

#[async_trait]
impl PoolHandler for RedisPoolHandler {
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError> {
        let client = redis::Client::open(db_config.conn_string.as_str())
            .map_err(|e| AppError::ConnectionError(format!("Redis client error: {}", e)))?;
        let con = client
            .get_multiplexed_tokio_connection()
            .await
            .map_err(|e| AppError::ConnectionError(format!("Redis connection error: {}", e)))?;
        Ok(RedisPoolHandler(con))
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        // Redis doesn't have "tables" in the SQL sense.
        // We could potentially list keys using KEYS *, but that's dangerous for large DBs.
        // Returning an empty list is a safe default.
        Ok(Vec::new())
    }

    async fn get_table_schema(&self, table_name: &str) -> Result<TableSchema, AppError> {
        // Redis keys don't have a fixed schema.
        // Return a placeholder schema.
        Ok(TableSchema {
            table_name: table_name.to_string(),
            columns: vec![
                ColumnInfo {
                    name: "key".to_string(),
                    data_type: ColumnType::Text,
                    is_nullable: false,
                    is_pk: true,
                    is_unique: true,
                    fk_table: None,
                    fk_column: None,
                },
                ColumnInfo {
                    name: "value".to_string(),
                    data_type: ColumnType::Text, // Or JSON, depending on how you store things
                    is_nullable: true,
                    is_pk: false,
                    is_unique: false,
                    fk_table: None,
                    fk_column: None,
                },
            ],
        })
    }

    async fn sanitize_query(&self, query: &str, _limit: usize) -> Result<String, AppError> {
        // Redis commands are generally simple; extensive sanitization might not be needed
        // as compared to SQL. However, be cautious with user input.
        // For now, pass-through.
        Ok(query.to_string())
    }

    async fn execute_query(
        &self,
        query: &str,
        _limit: Option<usize>, // Limit is typically part of Redis commands themselves (e.g., LRANGE)
    ) -> Result<QueryResult, AppError> {
        let start_time = Instant::now();
        let mut con = self.0.clone();

        let parts: Vec<&str> = query.trim().split_whitespace().collect();
        if parts.is_empty() {
            return Err(AppError::BadRequest("Empty query".to_string()));
        }

        let command = parts[0].to_uppercase();
        let args = &parts[1..];

        let mut cmd = redis::cmd(&command);
        for arg in args {
            cmd.arg(arg);
        }

        let redis_result: RedisValue = cmd
            .query_async(&mut con)
            .await
            .map_err(|e| AppError::QueryError(format!("Redis command execution error: {}", e)))?;

        let execution_time = start_time.elapsed();
        let data = redis_value_to_json_value(redis_result)?;

        Ok(QueryResult {
            data,
            execution_time,
            plan: None, // Redis doesn't have query plans in the SQL sense.
        })
    }
}

fn redis_value_to_json_value(rv: RedisValue) -> Result<JsonValue, AppError> {
    match rv {
        RedisValue::Nil => Ok(JsonValue::Null),
        RedisValue::Int(i) => Ok(JsonValue::Number(i.into())),
        RedisValue::Data(bytes) => {
            Ok(JsonValue::String(String::from_utf8_lossy(&bytes).into_owned()))
        }
        RedisValue::Status(s) => Ok(JsonValue::String(s)),
        RedisValue::Okay => Ok(JsonValue::String("OK".to_string())),
        RedisValue::Bulk(values) => {
            let mut arr = Vec::with_capacity(values.len());
            for v in values {
                arr.push(redis_value_to_json_value(v)?);
            }
            Ok(JsonValue::Array(arr))
        }
         // As per redis-rs docs, an empty Bulk or an empty MultiBulk means an empty array.
        // A nil Bulk or nil MultiBulk means a Null value.
        // This is handled by Nil case above for nil MultiBulk.
        // For empty Bulk, it results in an empty `values` vec, producing JsonValue::Array([]).
    }
}

// Example Test (not part of the library code, but for illustration)
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_redis_value_conversion() {
        assert_eq!(redis_value_to_json_value(RedisValue::Nil).unwrap(), json!(null));
        assert_eq!(redis_value_to_json_value(RedisValue::Int(123)).unwrap(), json!(123));
        assert_eq!(
            redis_value_to_json_value(RedisValue::Data(b"hello".to_vec())).unwrap(),
            json!("hello")
        );
        assert_eq!(
            redis_value_to_json_value(RedisValue::Status("OK".to_string())).unwrap(),
            json!("OK")
        );
        assert_eq!(redis_value_to_json_value(RedisValue::Okay).unwrap(), json!("OK"));

        let bulk_redis_values = vec![RedisValue::Int(1), RedisValue::Data(b"two".to_vec())];
        let expected_json_array = json!([1, "two"]);
        assert_eq!(
            redis_value_to_json_value(RedisValue::Bulk(bulk_redis_values)).unwrap(),
            expected_json_array
        );
        
        let empty_bulk = vec![];
        let expected_empty_json_array = json!([]);
         assert_eq!(
            redis_value_to_json_value(RedisValue::Bulk(empty_bulk)).unwrap(),
            expected_empty_json_array
        );
    }
}
