use crate::{
    config::DatabaseConfig,
    db::{
        ColumnInfo, ColumnType, DbPool, PoolHandler, QueryResult, TableInfo, TableSchema, TableType,
        DEFAULT_LIMIT,
    },
    error::AppError,
};
use async_trait::async_trait;
use scylla::{frame::response::result::Row, prepared_statement::PreparedStatement, Session, SessionBuilder};
use serde_json::json;
use std::{str::FromStr, sync::Arc, time::{Duration, Instant}};

#[derive(Debug)]
pub struct ScyllaDbPoolHandler(Arc<Session>);

#[async_trait]
impl PoolHandler for ScyllaDbPoolHandler {
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError> {
        let (uri, keyspace) = parse_scylla_conn_string(&db_config.conn_string)?;

        let session = SessionBuilder::new()
            .known_node(uri)
            .build()
            .await
            .map_err(|e| AppError::ConnectionError(format!("ScyllaDB connection error: {}", e)))?;

        if let Some(ks) = keyspace {
            session
                .query(format!("USE {}", ks), &[])
                .await
                .map_err(|e| {
                    AppError::ConnectionError(format!(
                        "ScyllaDB failed to use keyspace {}: {}",
                        ks, e
                    ))
                })?;
        }

        Ok(ScyllaDbPoolHandler(Arc::new(session)))
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        let rows = self
            .0
            .query("SELECT table_name FROM system_schema.tables", &[])
            .await
            .map_err(|e| AppError::QueryError(format!("ScyllaDB list_tables error: {}", e)))?
            .rows_typed::<(String,)>()
            .map_err(|e| AppError::QueryError(format!("ScyllaDB list_tables row parsing error: {}", e)))?;

        let mut tables = Vec::new();
        for row_result in rows {
            let (table_name,) = row_result.map_err(|e| AppError::QueryError(format!("ScyllaDB list_tables row error: {}", e)))?;
            tables.push(TableInfo {
                name: table_name,
                table_type: TableType::Table, // ScyllaDB doesn't have views in the same way as SQL
            });
        }
        Ok(tables)
    }

    async fn get_table_schema(&self, table_name: &str) -> Result<TableSchema, AppError> {
        // This query needs to be adapted based on the actual keyspace in use.
        // For simplicity, assuming keyspace was set with USE or is part of table_name if not.
        // A more robust solution would get the current keyspace from the session or require it.
        let query_str = format!(
            "SELECT column_name, type, kind FROM system_schema.columns WHERE table_name = '{}'",
            table_name
        );
        // If a keyspace is active, Scylla might require specifying it for system_schema queries,
        // or the table_name should be keyspace.table_name if no keyspace is active.
        // This is a simplification.

        let rows = self
            .0
            .query(&query_str, &[])
            .await
            .map_err(|e| AppError::QueryError(format!("ScyllaDB get_table_schema query error for table {}: {}", table_name, e)))?
            .rows_typed::<(String, String, String)>()
            .map_err(|e| AppError::QueryError(format!("ScyllaDB get_table_schema row parsing error for table {}: {}", table_name, e)))?;

        let mut columns = Vec::new();
        for row_result in rows {
            let (col_name, col_type_str, kind_str) = row_result.map_err(|e| AppError::QueryError(format!("ScyllaDB get_table_schema row error for table {}: {}", table_name, e)))?;
            
            let data_type = scylla_to_column_type(&col_type_str);
            let is_pk = kind_str == "partition_key" || kind_str == "clustering";
            // Scylla columns are generally nullable unless part of the primary key.
            // This is a simplification; more detailed schema info might be needed for exact nullability.
            let is_nullable = !is_pk;

            columns.push(ColumnInfo {
                name: col_name,
                data_type,
                is_nullable,
                is_pk,
                is_unique: is_pk, // In ScyllaDB, primary key implies uniqueness. No separate unique constraints like SQL.
                fk_table: None,   // ScyllaDB does not enforce foreign keys
                fk_column: None,
            });
        }

        Ok(TableSchema {
            table_name: table_name.to_string(),
            columns,
        })
    }

    async fn sanitize_query(&self, query: &str, _limit: usize) -> Result<String, AppError> {
        // CQL doesn't have the same comment styles or complex constructs that need sanitizing like SQL.
        // LIMIT clause is also different or might not be universally applicable for sanitization here.
        // Pass-through is acceptable.
        Ok(query.to_string())
    }

    async fn execute_query(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> Result<QueryResult, AppError> {
        let start_time = Instant::now();

        // Scylla's LIMIT is part of CQL syntax, not an API parameter like in some SQL drivers.
        // We assume the query string already includes it if desired.
        // The `limit` parameter here is from the generic API and might not directly map.
        // For simplicity, we'll use the provided limit if the query doesn't have one.
        // This is a naive approach; a proper parser would be needed to robustly add LIMIT.
        let mut effective_query = query.to_string();
        if limit.is_some() && !query.to_uppercase().contains("LIMIT") {
             effective_query = format!("{} LIMIT {}", query, limit.unwrap_or(DEFAULT_LIMIT));
        }


        let query_result = self
            .0
            .query(effective_query, &[])
            .await
            .map_err(|e| AppError::QueryError(format!("ScyllaDB execute_query error: {}", e)))?;

        let execution_time = start_time.elapsed();

        let mut result_data = Vec::<serde_json::Value>::new();

        if let Some(rows) = query_result.rows {
            for row in rows.into_typed::<(Vec<Option<scylla::frame::value::Value>>)>() {
                 match row {
                    Ok(cols_vec) => {
                        let mut row_map = serde_json::Map::new();
                        // We need column names. Scylla returns them in `query_result.col_specs`.
                        // This is a simplified example; real implementation needs robust type handling.
                        for (idx, col_spec) in query_result.col_specs.iter().enumerate() {
                            let col_name = &col_spec.name;
                            let cql_value_opt = cols_vec.get(idx).and_then(|v| v.as_ref());

                            let json_val = match cql_value_opt {
                                Some(cql_val) => cql_value_to_json(cql_val)?,
                                None => serde_json::Value::Null,
                            };
                            row_map.insert(col_name.clone(), json_val);
                        }
                        result_data.push(serde_json::Value::Object(row_map));
                    }
                    Err(e) => {
                        // Log or handle individual row parsing errors if necessary
                        // For now, let's skip problematic rows or return an error
                        tracing::warn!("Error parsing a ScyllaDB row: {}", e);
                        // Depending on requirements, this could be an error or continue
                    }
                }
            }
        }
        
        Ok(QueryResult {
            data: serde_json::Value::Array(result_data),
            execution_time,
            plan: None, // EXPLAIN PLAN is not a standard CQL feature like in SQL.
        })
    }
}

fn parse_scylla_conn_string(conn_str: &str) -> Result<(&str, Option<&str>), AppError> {
    if conn_str.is_empty() {
        return Err(AppError::ConnectionError(
            "ScyllaDB connection string is empty".to_string(),
        ));
    }
    let parts: Vec<&str> = conn_str.split('/').collect();
    let uri = parts[0];
    let keyspace = if parts.len() > 1 && !parts[1].is_empty() {
        Some(parts[1])
    } else {
        None
    };
    Ok((uri, keyspace))
}

fn scylla_to_column_type(scylla_type: &str) -> ColumnType {
    match scylla_type.to_lowercase().as_str() {
        "ascii" => ColumnType::Text, // Or a more specific Ascii type if added
        "bigint" => ColumnType::BigInt,
        "blob" => ColumnType::Bytea,
        "boolean" => ColumnType::Boolean,
        "counter" => ColumnType::BigInt, // Counters are 64-bit integers
        "date" => ColumnType::Date,
        "decimal" => ColumnType::Decimal,
        "double" => ColumnType::DoublePrecision,
        "duration" => ColumnType::Other("duration".to_string()), // Consider specific type
        "float" => ColumnType::Real,
        "inet" => ColumnType::Inet,
        "int" => ColumnType::Integer,
        "list" => ColumnType::Array, // Generic array, Scylla lists are typed
        "map" => ColumnType::Other("map".to_string()), // Maps are key-value, potentially JSONB or Other
        "set" => ColumnType::Array, // Sets are like lists of unique elements
        "smallint" => ColumnType::SmallInt,
        "text" => ColumnType::Text,
        "time" => ColumnType::Time,
        "timestamp" => ColumnType::Timestamp,
        "timeuuid" => ColumnType::Uuid, // TimeUUID is a specific kind of UUID
        "tinyint" => ColumnType::SmallInt, // TinyInt is 1-byte, map to SmallInt
        "tuple" => ColumnType::Other("tuple".to_string()),
        "uuid" => ColumnType::Uuid,
        "varchar" => ColumnType::Varchar,
        "varint" => ColumnType::Numeric, // Arbitrary-precision integer
        _ => ColumnType::Other(scylla_type.to_string()),
    }
}

// Helper to convert Scylla CqlValue to serde_json::Value
// This needs to be comprehensive based on Scylla types.
fn cql_value_to_json(cql_val: &scylla::frame::value::Value) -> Result<serde_json::Value, AppError> {
    use scylla::frame::value::Value;
    match cql_val {
        Value::Ascii(s) | Value::Text(s) => Ok(serde_json::Value::String(s.clone())),
        Value::BigInt(n) | Value::Counter(n) => Ok(json!(n)),
        Value::Boolean(b) => Ok(json!(b)),
        Value::Blob(b) => Ok(json!(hex::encode(b))), // Or base64, depending on preference
        Value::Date(d) => Ok(json!(d.to_string())), // Scylla date is days since epoch
        Value::Decimal(d) => {
            // big_decimal::BigDecimal doesn't directly serialize to number with serde_json default
            // Convert to string for reliable representation
            Ok(json!(d.to_string()))
        }
        Value::Double(d) => Ok(json!(d)),
        Value::Float(f) => Ok(json!(f)),
        Value::Int(i) => Ok(json!(i)),
        Value::SmallInt(s) => Ok(json!(s)),
        Value::TinyInt(t) => Ok(json!(t)),
        Value::Timestamp(ts) => { // scylla::frame::value::Timestamp is Duration
            // Convert Duration to milliseconds since epoch or ISO string
            Ok(json!(ts.as_millis() as i64))
        }
        Value::Timeuuid(uuid) | Value::Uuid(uuid) => Ok(json!(uuid.to_string())),
        Value::Inet(ip) => Ok(json!(ip.to_string())),
        Value::Time(t) => Ok(json!(t.to_string())), // Scylla time is nanoseconds since midnight
        Value::Varint(vi) => Ok(json!(vi.to_string())), // num_bigint::BigInt
        
        // Complex types (List, Map, Set, Tuple, UDT) require recursive conversion
        Value::List(items) => {
            let mut arr = Vec::new();
            for item in items {
                arr.push(cql_value_to_json(item)?);
            }
            Ok(serde_json::Value::Array(arr))
        }
        Value::Map(pairs) => {
            let mut map = serde_json::Map::new();
            for (k, v) in pairs {
                // Map keys in Scylla are also CqlValues. For JSON, keys must be strings.
                let key_str = cql_value_to_string_key(k)?;
                map.insert(key_str, cql_value_to_json(v)?);
            }
            Ok(serde_json::Value::Object(map))
        }
        // Value::Set(items) is similar to List for JSON representation
        Value::Set(items) => {
            let mut arr = Vec::new();
            for item in items {
                arr.push(cql_value_to_json(item)?);
            }
            Ok(serde_json::Value::Array(arr))
        }
        // Tuples could be arrays. UDTs could be objects.
        // These are simplified. Proper UDT handling requires schema knowledge.
        Value::Tuple(elements) => {
            let mut arr = Vec::new();
            for element in elements {
                 match element {
                    Some(e) => arr.push(cql_value_to_json(e)?),
                    None => arr.push(serde_json::Value::Null),
                }
            }
            Ok(serde_json::Value::Array(arr))
        }
        Value::Udt(udt_values) => {
            let mut map = serde_json::Map::new();
            for (name, value_opt) in udt_values {
                 match value_opt {
                    Some(val) => map.insert(name.clone(), cql_value_to_json(val)?),
                    None => map.insert(name.clone(), serde_json::Value::Null),
                };
            }
            Ok(serde_json::Value::Object(map))
        }
        Value::Duration(d) => Ok(json!(d.to_string())),
        // Explicitly handle null if it can appear here, though options are usually used
        // Value::Null => Ok(serde_json::Value::Null),
        _ => Err(AppError::ConversionError(format!(
            "Unsupported ScyllaDB CqlValue for JSON conversion: {:?}",
            cql_val
        ))),
    }
}

fn cql_value_to_string_key(cql_val: &scylla::frame::value::Value) -> Result<String, AppError> {
    use scylla::frame::value::Value;
    match cql_val {
        Value::Ascii(s) | Value::Text(s) => Ok(s.clone()),
        Value::BigInt(n) => Ok(n.to_string()),
        Value::Boolean(b) => Ok(b.to_string()),
        Value::Date(d) => Ok(d.to_string()),
        Value::Decimal(d) => Ok(d.to_string()),
        Value::Double(d) => Ok(d.to_string()),
        Value::Float(f) => Ok(f.to_string()),
        Value::Int(i) => Ok(i.to_string()),
        Value::SmallInt(s) => Ok(s.to_string()),
        Value::TinyInt(t) => Ok(t.to_string()),
        Value::Timestamp(ts) => Ok(format!("{}", ts.as_millis())),
        Value::Timeuuid(uuid) | Value::Uuid(uuid) => Ok(uuid.to_string()),
        Value::Inet(ip) => Ok(ip.to_string()),
        Value::Time(t) => Ok(t.to_string()),
        Value::Varint(vi) => Ok(vi.to_string()),
        // Blobs, lists, maps, sets, tuples, UDTs, durations are not typically good map keys.
        _ => Err(AppError::ConversionError(format!(
            "Unsupported ScyllaDB CqlValue for JSON map key: {:?}",
            cql_val
        ))),
    }
}

// Helper to extract typed values from a Scylla row.
// This is a placeholder for more robust dynamic type handling if needed.
// For now, execute_query uses a simpler approach with col_specs.
#[allow(dead_code)]
fn scylla_row_to_json_object(row: &Row, col_specs: &[scylla::frame::response::result::ColumnSpec]) -> Result<serde_json::Map<String, serde_json::Value>, AppError> {
    let mut map = serde_json::Map::new();
    for (i, col_spec) in col_specs.iter().enumerate() {
        let cql_value_opt: Option<scylla::frame::value::CqlValue> = row.columns.get(i).cloned().flatten();
        let json_val = match cql_value_opt {
            Some(cql_val) => cql_value_to_json(&cql_val)?,
            None => serde_json::Value::Null,
        };
        map.insert(col_spec.name.clone(), json_val);
    }
    Ok(map)
}

// Example of how one might try to get values if they knew the types.
// This is not used in the current execute_query due to dynamic nature of queries.
#[allow(dead_code)]
fn example_typed_row_access(row: Row) -> Result<(), scylla::cql_to_rust::FromRowError> {
    // Example: if you knew the first column was text and second was int
    let (text_val, int_val): (Option<String>, Option<i32>) = row.into_typed()?;
    tracing::debug!("Text: {:?}, Int: {:?}", text_val, int_val);
    Ok(())
}
