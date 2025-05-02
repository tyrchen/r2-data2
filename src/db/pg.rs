use super::{
    ColumnInfo, ColumnType, JsonResult, PgPoolHandler, PoolHandler, TableInfo, TableSchema,
};
use crate::{config::DatabaseConfig, error::AppError};
use serde_json::Value;
use sqlparser::{dialect::PostgreSqlDialect, parser::Parser};
use sqlx::{PgPool, postgres::PgPoolOptions};
use std::{collections::HashMap, ops::Deref, str::FromStr};
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

    async fn sanitize_query(&self, query: &str) -> Result<String, AppError> {
        let dialect = PostgreSqlDialect {};
        let statements = Parser::parse_sql(&dialect, query)
            .map_err(|e| AppError::BadRequest(format!("SQL parsing error: {}", e)))?;
        // only allow one statement
        if statements.len() != 1 {
            return Err(AppError::SqlParsingError(
                "Only one statement is allowed".to_string(),
            ));
        }
        let sql = statements[0].to_string();

        Ok(format!(
            "WITH q AS ({}) SELECT JSON_AGG(q.*) data FROM q",
            sql
        ))
    }

    async fn execute_query(&self, query: &str) -> Result<Value, AppError> {
        let sanitized_query = self.sanitize_query(query).await?;
        let result: JsonResult = sqlx::query_as(&sanitized_query).fetch_one(&self.0).await?;
        Ok(result.data)
    }
}

impl Deref for PgPoolHandler {
    type Target = PgPool;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
