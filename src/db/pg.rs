use super::{
    ColumnInfo, ColumnType, JsonResult, PgPoolHandler, PoolHandler, QueryResult, TableInfo,
    TableSchema,
};
use crate::{
    config::DatabaseConfig,
    db::{DEFAULT_LIMIT, MAX_LIMIT},
    error::AppError,
};
use serde_json::Value;
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{cmp::min, collections::HashMap, ops::Deref, str::FromStr, time::Instant};
use tracing::info;

// Structs to fetch constraint information
#[derive(sqlx::FromRow)]
struct ConstraintInfoRow {
    column_name: String,
    constraint_type: String, // PRIMARY KEY, UNIQUE, FOREIGN KEY
}

#[derive(sqlx::FromRow)]
struct ForeignKeyInfoRow {
    column_name: String,         // Column in the referencing table
    foreign_table_name: String,  // Referenced table
    foreign_column_name: String, // Referenced column
}

// Intermediate struct for basic column info (still need nullable as string)
#[derive(sqlx::FromRow)]
struct RawColumnInfo {
    column_name: String,
    data_type: String,   // Fetch as string, convert using FromStr
    is_nullable: String, // "YES" or "NO"
}

impl PoolHandler for PgPoolHandler {
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&db_config.conn_string)
            .await?;
        Ok(PgPoolHandler(pool))
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        let tables = sqlx::query_as::<sqlx::Postgres, TableInfo>(
            r#"
          SELECT n.nspname || '.' || c.relname as name,
            CASE c.relkind
              WHEN 'r' THEN 'table'
              WHEN 'v' THEN 'view'
              WHEN 'm' THEN 'materialized_view'
              ELSE c.relkind::text
            END as type
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r','v','m')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND c.relname NOT LIKE '\_%'
          ORDER BY name;"#,
        )
        .fetch_all(&self.0) // Pass reference to pool
        .await?;
        Ok(tables)
    }

    async fn get_table_schema(&self, table_name_full: &str) -> Result<TableSchema, AppError> {
        // Split potentially schema-qualified name
        let (schema_name, table_name_only) = match table_name_full.split_once('.') {
            Some((schema, table)) => (schema, table),
            None => ("public", table_name_full), // Default to public schema if not qualified
        };

        // 1. Fetch basic column info
        let raw_columns = sqlx::query_as::<_, RawColumnInfo>(
            "SELECT column_name, data_type, is_nullable
             FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2
             ORDER BY ordinal_position",
        )
        .bind(schema_name)
        .bind(table_name_only)
        .fetch_all(&self.0)
        .await?;

        // 2. Fetch PK/Unique constraints
        let constraints = sqlx::query_as::<_, ConstraintInfoRow>(
            "SELECT kcu.column_name, tc.constraint_type
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.key_column_usage AS kcu
               ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
             WHERE tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
               AND tc.table_schema = $1 AND tc.table_name = $2",
        )
        .bind(schema_name)
        .bind(table_name_only)
        .fetch_all(&self.0)
        .await?;

        // Process constraints into maps for quick lookup
        let mut pk_columns = HashMap::new();
        let mut unique_columns = HashMap::new();
        for c in constraints {
            if c.constraint_type == "PRIMARY KEY" {
                pk_columns.insert(c.column_name.clone(), true);
                unique_columns.insert(c.column_name.clone(), true); // PKs are implicitly unique
            } else if c.constraint_type == "UNIQUE" {
                unique_columns.insert(c.column_name.clone(), true);
            }
        }

        // 3. Fetch Foreign Key constraints
        let foreign_keys = sqlx::query_as::<_, ForeignKeyInfoRow>(
            "SELECT
                 kcu.column_name,
                 ccu.table_name AS foreign_table_name,
                 ccu.column_name AS foreign_column_name
             FROM
                 information_schema.table_constraints AS tc
                 JOIN information_schema.key_column_usage AS kcu
                   ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                 JOIN information_schema.constraint_column_usage AS ccu
                   ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_schema = $1 AND tc.table_name = $2",
        )
        .bind(schema_name)
        .bind(table_name_only)
        .fetch_all(&self.0)
        .await?;

        // Process FKs into a map
        let fk_map: HashMap<String, (String, String)> = foreign_keys
            .into_iter()
            .map(|fk| {
                (
                    fk.column_name,
                    (fk.foreign_table_name, fk.foreign_column_name),
                )
            })
            .collect();

        // 4. Combine all info
        let columns: Vec<ColumnInfo> = raw_columns
            .into_iter()
            .map(|raw| {
                let fk_info = fk_map.get(&raw.column_name);
                ColumnInfo {
                    name: raw.column_name.clone(),
                    data_type: ColumnType::from_str(&raw.data_type).unwrap_or_else(|_| {
                        tracing::warn!(
                            "Unknown column type '{}' for {}.{}, falling back to Text",
                            raw.data_type,
                            schema_name,
                            table_name_only
                        );
                        ColumnType::Text // Fallback or handle error appropriately
                    }),
                    is_nullable: raw.is_nullable.to_uppercase() == "YES",
                    is_pk: *pk_columns.get(&raw.column_name).unwrap_or(&false),
                    is_unique: *unique_columns.get(&raw.column_name).unwrap_or(&false),
                    fk_table: fk_info.map(|(t, _)| t.clone()),
                    fk_column: fk_info.map(|(_, c)| c.clone()),
                }
            })
            .collect();

        Ok(TableSchema {
            table_name: table_name_full.to_string(), // Return original full name
            columns,
        })
    }

    async fn execute_query(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> Result<QueryResult, AppError> {
        // 1. Get the original, validated SQL string
        let limit = min(limit.unwrap_or(DEFAULT_LIMIT), MAX_LIMIT);
        let original_sql = self.sanitize_query(query, limit).await?;
        info!("Sanitized query: {}", original_sql);

        // 2. Execute EXPLAIN query
        let explain_query = format!("EXPLAIN (FORMAT JSON) {}", original_sql);
        let plan_result: Option<serde_json::Value> = sqlx::query_scalar(&explain_query)
            .fetch_optional(&self.0)
            .await?;
        let plan = plan_result.and_then(|val| {
            if let Value::Array(mut arr) = val {
                if !arr.is_empty() {
                    Some(arr.remove(0))
                } else {
                    None
                }
            } else {
                None
            }
        });

        // 3. Construct CTE query for actual data fetching using the *limited* sql
        let cte_query = format!(
            "WITH q AS ({}) SELECT JSON_AGG(q.*) data FROM q",
            original_sql
        );

        // 4. Execute actual query and time it
        let start_time = Instant::now();
        let result: Option<JsonResult> = sqlx::query_as(&cte_query).fetch_optional(&self.0).await?;
        let execution_time = start_time.elapsed();

        let data = result.map_or(Value::Null, |jr| jr.data);

        Ok(QueryResult {
            data,
            execution_time,
            plan,
        })
    }
}

impl Deref for PgPoolHandler {
    type Target = PgPool;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::DatabaseType;

    #[tokio::test]
    async fn test_sanitize_query_without_limit() {
        let db_config = get_db_config();
        let db = PgPoolHandler::try_new(&db_config).await.unwrap();
        let sanitized = db.sanitize_query("SELECT * FROM users", 10).await.unwrap();
        assert_eq!(sanitized, "SELECT * FROM users LIMIT 10");
    }

    #[tokio::test]
    async fn test_sanitize_query_with_limit() {
        let db_config = get_db_config();
        let db = PgPoolHandler::try_new(&db_config).await.unwrap();
        let sanitized = db
            .sanitize_query("SELECT * FROM users limit 1000", 10)
            .await
            .unwrap();
        assert_eq!(sanitized, "SELECT * FROM users LIMIT 1000");
    }

    #[tokio::test]
    async fn test_get_table_schema() {
        let db_config = get_db_config();
        let db = PgPoolHandler::try_new(&db_config).await.unwrap();
        let schema = db.get_table_schema("users").await.unwrap();
        assert_eq!(schema.table_name, "users");
    }

    fn get_db_config() -> DatabaseConfig {
        DatabaseConfig {
            name: "test".to_string(),
            db_type: DatabaseType::Postgres,
            conn_string: "postgres://postgres:postgres@localhost:5432/postgres".to_string(),
        }
    }
}
