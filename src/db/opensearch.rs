use crate::{
    config::DatabaseConfig,
    db::{ColumnInfo, ColumnType, PoolHandler, QueryResult, TableInfo, TableSchema, TableType},
    error::AppError,
};
use async_trait::async_trait;
use opensearch::{
    http::transport::{SingleNodeConnectionPool, TransportBuilder},
    indices::{IndicesGetMappingParts, IndicesGetParts},
    nodes::NodesInfoParts,
    cat::CatIndicesParts,
    search::SearchParts,
    OpenSearch,
};
use serde_json::{json, Value as JsonValue};
use std::time::{Duration, Instant};
use url::Url;

#[derive(Debug)]
pub struct OpenSearchPoolHandler(OpenSearch);

#[async_trait]
impl PoolHandler for OpenSearchPoolHandler {
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError> {
        let url = Url::parse(&db_config.conn_string).map_err(|e| {
            AppError::ConnectionError(format!("Invalid OpenSearch URL: {}", e))
        })?;

        let conn_pool = SingleNodeConnectionPool::new(url);
        let transport = TransportBuilder::new(conn_pool)
            .build()
            .map_err(|e| AppError::ConnectionError(format!("OpenSearch transport error: {}", e)))?;
        
        let client = OpenSearch::new(transport);

        // Test connection by getting cluster info
        client
            .ping()
            .send()
            .await
            .map_err(|e| AppError::ConnectionError(format!("OpenSearch ping failed: {}", e)))?;

        Ok(OpenSearchPoolHandler(client))
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        let response = self
            .0
            .cat()
            .indices(CatIndicesParts::Index(&["*"])) // Get all indices
            .format("json")
            .send()
            .await
            .map_err(|e| AppError::QueryError(format!("OpenSearch list_tables error: {}", e)))?;

        let response_body = response
            .json::<JsonValue>()
            .await
            .map_err(|e| AppError::QueryError(format!("OpenSearch list_tables JSON parsing error: {}", e)))?;

        let indices_array = response_body.as_array().ok_or_else(|| {
            AppError::QueryError("OpenSearch list_tables: response is not an array".to_string())
        })?;

        let mut tables = Vec::new();
        for index_info in indices_array {
            if let Some(index_name) = index_info.get("index").and_then(|v| v.as_str()) {
                tables.push(TableInfo {
                    name: index_name.to_string(),
                    table_type: TableType::Table, // OpenSearch indices are treated as tables
                });
            }
        }
        Ok(tables)
    }

    async fn get_table_schema(&self, table_name: &str) -> Result<TableSchema, AppError> {
        let response = self
            .0
            .indices()
            .get_mapping(IndicesGetMappingParts::Index(&[table_name]))
            .send()
            .await
            .map_err(|e| AppError::QueryError(format!("OpenSearch get_table_schema error for index {}: {}", table_name, e)))?;

        let response_body = response
            .json::<JsonValue>()
            .await
            .map_err(|e| AppError::QueryError(format!("OpenSearch get_table_schema JSON parsing error for index {}: {}", table_name, e)))?;
        
        let index_mapping = response_body
            .get(table_name)
            .and_then(|data| data.get("mappings"))
            .and_then(|mappings| mappings.get("properties"))
            .and_then(|props| props.as_object())
            .ok_or_else(|| AppError::QueryError(format!("Could not find properties in mapping for index {}", table_name)))?;

        let mut columns = Vec::new();
        for (col_name, col_data) in index_mapping {
            let os_type = col_data.get("type").and_then(|t| t.as_str()).unwrap_or("object");
            let column_type = opensearch_type_to_column_type(os_type);
            
            columns.push(ColumnInfo {
                name: col_name.clone(),
                data_type: column_type,
                is_nullable: true, // Defaulting to true, as nullability is complex in OS
                is_pk: false,      // OpenSearch doesn't have PKs in the SQL sense (_id is special)
                is_unique: false,
                fk_table: None,
                fk_column: None,
            });
        }

        Ok(TableSchema {
            table_name: table_name.to_string(),
            columns,
        })
    }

    async fn sanitize_query(&self, query: &str, _limit: usize) -> Result<String, AppError> {
        // OpenSearch uses JSON-based Query DSL, pass-through is appropriate.
        // Basic validation could be to check if it's valid JSON.
        serde_json::from_str::<JsonValue>(query)
            .map_err(|e| AppError::BadRequest(format!("Invalid JSON for OpenSearch query: {}", e)))?;
        Ok(query.to_string())
    }

    async fn execute_query(
        &self,
        query: &str, // Expected to be OpenSearch Query DSL JSON
        _limit: Option<usize>, // Limit should be part of the Query DSL if needed (e.g., "size" field)
    ) -> Result<QueryResult, AppError> {
        let start_time = Instant::now();

        let query_json: JsonValue = serde_json::from_str(query)
            .map_err(|e| AppError::BadRequest(format!("Invalid OpenSearch Query DSL (JSON parsing failed): {}", e)))?;

        // Determine target index/indices from query if possible, or use a default, or all.
        // For simplicity, assuming query is self-contained or targets all if not specified via _index path.
        // Or, one could require the index to be part of the query JSON or passed differently.
        // Here, we use SearchParts::None which means the query might need to specify the index,
        // or it will search all indices if the query itself doesn't target specific ones.
        let search_response = self.0
            .search(SearchParts::None) // No specific index here, assumes query contains it or searches all
            .body(query_json)
            .send()
            .await
            .map_err(|e| AppError::QueryError(format!("OpenSearch search execution error: {}", e)))?;
        
        if !search_response.status_code().is_success() {
             let error_body = search_response.text().await.unwrap_or_else(|_| "Failed to read error body".to_string());
             return Err(AppError::QueryError(format!("OpenSearch query failed with status {}: {}", search_response.status_code(), error_body)));
        }

        let response_data = search_response
            .json::<JsonValue>()
            .await
            .map_err(|e| AppError::QueryError(format!("OpenSearch search response JSON parsing error: {}", e)))?;
        
        let execution_time = start_time.elapsed();

        Ok(QueryResult {
            data: response_data,
            execution_time,
            plan: None, // OpenSearch doesn't have query plans in the SQL sense (_explain API is different)
        })
    }
}

fn opensearch_type_to_column_type(os_type: &str) -> ColumnType {
    match os_type.to_lowercase().as_str() {
        "text" => ColumnType::Text,
        "keyword" => ColumnType::Varchar, // Keywords are good for exact matches, like varchar
        "byte" => ColumnType::SmallInt, // Representing as SmallInt, though it's smaller
        "short" => ColumnType::SmallInt,
        "integer" => ColumnType::Integer,
        "long" => ColumnType::BigInt,
        "float" => ColumnType::Real,
        "double" => ColumnType::DoublePrecision,
        "half_float" => ColumnType::Real, // Approximate
        "scaled_float" => ColumnType::Decimal, // Requires scaling factor, Decimal is general
        "boolean" => ColumnType::Boolean,
        "date" => ColumnType::Timestamp, // OpenSearch dates are often like timestamps
        "date_nanos" => ColumnType::Timestamp, // Higher precision timestamp
        "ip" => ColumnType::Inet,
        "binary" => ColumnType::Bytea,
        "object" => ColumnType::Json, // Representing objects as JSON
        "nested" => ColumnType::Json, // Nested objects also as JSON
        // Geo types
        "geo_point" => ColumnType::Point, // Or Other("geo_point")
        "geo_shape" => ColumnType::Other("geo_shape".to_string()),
        // Specialized types
        "completion" => ColumnType::Other("completion".to_string()),
        "token_count" => ColumnType::Integer, // Usually an integer count
        "murmur3" => ColumnType::Other("murmur3".to_string()), // Hash
        // Range types
        "integer_range" => ColumnType::Other("integer_range".to_string()),
        "float_range" => ColumnType::Other("float_range".to_string()),
        "long_range" => ColumnType::Other("long_range".to_string()),
        "double_range" => ColumnType::Other("double_range".to_string()),
        "date_range" => ColumnType::Other("date_range".to_string()),
        "ip_range" => ColumnType::Other("ip_range".to_string()),
        _ => ColumnType::Other(os_type.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_opensearch_type_mapping() {
        assert_eq!(opensearch_type_to_column_type("text"), ColumnType::Text);
        assert_eq!(opensearch_type_to_column_type("keyword"), ColumnType::Varchar);
        assert_eq!(opensearch_type_to_column_type("long"), ColumnType::BigInt);
        assert_eq!(opensearch_type_to_column_type("integer"), ColumnType::Integer);
        assert_eq!(opensearch_type_to_column_type("short"), ColumnType::SmallInt);
        assert_eq!(opensearch_type_to_column_type("byte"), ColumnType::SmallInt);
        assert_eq!(opensearch_type_to_column_type("double"), ColumnType::DoublePrecision);
        assert_eq!(opensearch_type_to_column_type("float"), ColumnType::Real);
        assert_eq!(opensearch_type_to_column_type("half_float"), ColumnType::Real);
        assert_eq!(opensearch_type_to_column_type("scaled_float"), ColumnType::Decimal);
        assert_eq!(opensearch_type_to_column_type("date"), ColumnType::Timestamp);
        assert_eq!(opensearch_type_to_column_type("date_nanos"), ColumnType::Timestamp);
        assert_eq!(opensearch_type_to_column_type("boolean"), ColumnType::Boolean);
        assert_eq!(opensearch_type_to_column_type("binary"), ColumnType::Bytea);
        assert_eq!(opensearch_type_to_column_type("object"), ColumnType::Json);
        assert_eq!(opensearch_type_to_column_type("nested"), ColumnType::Json);
        assert_eq!(opensearch_type_to_column_type("ip"), ColumnType::Inet);
        assert_eq!(opensearch_type_to_column_type("geo_point"), ColumnType::Point);
        assert_eq!(opensearch_type_to_column_type("geo_shape"), ColumnType::Other("geo_shape".to_string()));
        assert_eq!(opensearch_type_to_column_type("unknown_type"), ColumnType::Other("unknown_type".to_string()));
    }
}
