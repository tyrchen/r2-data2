mod mysql;
mod pg;

use crate::{config::DatabaseConfig, error::AppError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlparser::{ast, dialect::GenericDialect, parser::Parser};
use sqlx::{MySqlPool, PgPool};
use std::{cmp::min, convert::Infallible, str::FromStr, time::Duration};

const DEFAULT_LIMIT: usize = 500;
const MAX_LIMIT: usize = 5000;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[non_exhaustive]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    Postgres,
    Mysql,
}

#[derive(Debug)]
pub struct PgPoolHandler(PgPool);

#[derive(Debug)]
pub struct MySqlPoolHandler(MySqlPool);

#[derive(Debug)]
pub enum DbPool {
    Postgres(PgPoolHandler),
    MySql(MySqlPoolHandler),
    // Add other pool types here if needed
}

pub trait PoolHandler: Sized {
    /// Create a new pool handler
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError>;
    /// List all tables in the database
    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError>;
    /// Get the schema of a table
    async fn get_table_schema(&self, table_name: &str) -> Result<TableSchema, AppError>;
    /// Sanitize the query and rewrite it to CTE format
    async fn sanitize_query(&self, query: &str, limit: usize) -> Result<String, AppError> {
        let dialect = GenericDialect {};
        let ast = Parser::parse_sql(&dialect, query)
            .map_err(|e| AppError::BadRequest(format!("SQL parsing error: {}", e)))?;
        if ast.len() != 1 {
            return Err(AppError::BadRequest(
                "Only single SQL statements are allowed".to_string(),
            ));
        }

        let mut stmt = ast.into_iter().next().unwrap();

        let has_limit = match stmt {
            ast::Statement::Query(ref mut query) => {
                // Check query type
                match &*query.body {
                    ast::SetExpr::Select(_)
                    | ast::SetExpr::Values(_)
                    | ast::SetExpr::Query(_)
                    | ast::SetExpr::Table(_) => {
                        // Valid query type
                    }
                    _ => {
                        return Err(AppError::BadRequest(
                            "Only SELECT-like queries are allowed.".to_string(),
                        ));
                    }
                }

                match &mut query.limit {
                    Some(ast::Expr::Value(ast::ValueWithSpan {
                        value: ast::Value::Number(s, _),
                        ..
                    })) => {
                        let existing_limit = s.parse::<usize>().unwrap_or(0);
                        if existing_limit < limit {
                            // do nothing
                        } else {
                            *s = min(existing_limit, MAX_LIMIT).to_string();
                        }
                        true
                    }
                    _ => false,
                }
            }
            _ => {
                return Err(AppError::BadRequest(
                    "Only SELECT queries are allowed".to_string(),
                ));
            }
        };
        let mut sql = stmt.to_string();
        if !has_limit {
            sql = format!("{} LIMIT {}", sql, limit);
        }
        Ok(sql)
    }

    /// Execute the query and return the result along with execution time
    async fn execute_query(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> Result<QueryResult, AppError>;
}

// Response structure for the /api/databases endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: String, // Use String representation for JSON response
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TableType {
    Table,
    View,
    MaterializedView,
}
// Response structure for the /api/databases/{dbName}/tables endpoint
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)] // Derive FromRow for sqlx query mapping
pub struct TableInfo {
    pub name: String,
    #[sqlx(rename = "type", try_from = "String")]
    #[serde(rename = "type")]
    pub table_type: TableType, // e.g., "BASE TABLE", "VIEW"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ColumnType {
    // Numeric types
    SmallInt,
    Integer,
    BigInt,
    Decimal,
    Numeric,
    Real,
    DoublePrecision,
    // Character types
    Char,
    Varchar,
    Text,
    // Binary types
    Bytea,
    // Boolean
    Boolean,
    // Date/Time types
    Date,
    Time,
    Timestamp,
    TimestampTz,
    Interval,
    // JSON types
    Json,
    Jsonb,
    // Network types
    Inet,
    Cidr,
    MacAddr,
    // UUID
    Uuid,
    // Geometric types
    Point,
    Line,
    Lseg,
    Box,
    Path,
    Polygon,
    Circle,
    // Array types
    Array,
    // Range types
    Int4Range,
    Int8Range,
    NumRange,
    TsRange,
    TstzRange,
    DateRange,
    // Bit string types
    Bit,
    Varbit,
    // Text search types
    TsVector,
    TsQuery,
    // XML
    Xml,
    // Money
    Money,
    // Other
    Other(String),
}

// Structures for /api/.../schema endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: ColumnType,
    pub is_nullable: bool,
    // Add constraint fields
    #[serde(default)]
    pub is_pk: bool,
    #[serde(default)]
    pub is_unique: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fk_table: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fk_column: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSchema {
    pub table_name: String,
    pub columns: Vec<ColumnInfo>,
    // Optional: Add constraints, indexes later if needed
    // pub constraints: Option<Vec<ConstraintInfo>>,
    // pub indexes: Option<Vec<IndexInfo>>,
}

// Struct to hold the query result and execution time
#[derive(Debug, Serialize)]
pub struct QueryResult {
    pub data: Value,
    pub execution_time: Duration,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan: Option<Value>,
}

#[derive(sqlx::FromRow)]
pub struct JsonResult {
    pub data: Value,
}

impl FromStr for TableType {
    type Err = Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "table" => Ok(TableType::Table),
            "view" => Ok(TableType::View),
            "materialized_view" => Ok(TableType::MaterializedView),
            _ => unreachable!(),
        }
    }
}

impl From<String> for TableType {
    fn from(s: String) -> Self {
        TableType::from_str(&s).unwrap()
    }
}

impl TableType {
    pub fn as_str(&self) -> &str {
        match self {
            TableType::Table => "table",
            TableType::View => "view",
            TableType::MaterializedView => "materialized_view",
        }
    }
}

impl FromStr for ColumnType {
    type Err = Infallible;

    // TODO: verify mysql types
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "smallint" => Ok(ColumnType::SmallInt),
            "integer" => Ok(ColumnType::Integer),
            "bigint" => Ok(ColumnType::BigInt),
            "decimal" => Ok(ColumnType::Decimal),
            "numeric" => Ok(ColumnType::Numeric),
            "real" => Ok(ColumnType::Real),
            "double precision" => Ok(ColumnType::DoublePrecision),
            "money" => Ok(ColumnType::Money),
            "text" => Ok(ColumnType::Text),
            "char" => Ok(ColumnType::Char),
            "character" => Ok(ColumnType::Char),
            "varchar" => Ok(ColumnType::Varchar),
            "character varying" => Ok(ColumnType::Varchar),
            "boolean" => Ok(ColumnType::Boolean),
            "json" => Ok(ColumnType::Json),
            "jsonb" => Ok(ColumnType::Jsonb),
            "bytea" => Ok(ColumnType::Bytea),
            "uuid" => Ok(ColumnType::Uuid),
            "inet" => Ok(ColumnType::Inet),
            "cidr" => Ok(ColumnType::Cidr),
            "macaddr" => Ok(ColumnType::MacAddr),
            "point" => Ok(ColumnType::Point),
            "line" => Ok(ColumnType::Line),
            "lseg" => Ok(ColumnType::Lseg),
            "box" => Ok(ColumnType::Box),
            "path" => Ok(ColumnType::Path),
            "polygon" => Ok(ColumnType::Polygon),
            "circle" => Ok(ColumnType::Circle),
            "array" => Ok(ColumnType::Array),
            "int4range" => Ok(ColumnType::Int4Range),
            "int8range" => Ok(ColumnType::Int8Range),
            "numrange" => Ok(ColumnType::NumRange),
            "tsrange" => Ok(ColumnType::TsRange),
            "tstzrange" => Ok(ColumnType::TstzRange),
            "date" => Ok(ColumnType::Date),
            "datetime" => Ok(ColumnType::Timestamp),
            "time" => Ok(ColumnType::Time),
            "timestamp" => Ok(ColumnType::Timestamp),
            "timestamp with time zone" => Ok(ColumnType::TimestampTz),
            "interval" => Ok(ColumnType::Interval),
            "daterange" => Ok(ColumnType::DateRange),
            "bit" => Ok(ColumnType::Bit),
            "varbit" => Ok(ColumnType::Varbit),
            "tsvector" => Ok(ColumnType::TsVector),
            "tsquery" => Ok(ColumnType::TsQuery),
            "xml" => Ok(ColumnType::Xml),
            v => Ok(ColumnType::Other(v.to_string())),
        }
    }
}

impl From<String> for ColumnType {
    fn from(s: String) -> Self {
        ColumnType::from_str(&s).unwrap_or_else(|_| {
            tracing::warn!("Unsupported database type string encountered: {}", s);
            // Decide on a default/fallback type if needed, or keep panicking/unreachable
            // For now, stick with unreachable! based on previous code
            unreachable!("unsupported type: {}", s)
        })
    }
}

impl sqlx::Type<sqlx::Postgres> for ColumnType {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        sqlx::postgres::PgTypeInfo::with_name("TEXT") // Treat as TEXT for SQLx binding/fetching
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for ColumnType {
    fn decode(
        value: sqlx::postgres::PgValueRef<'r>,
    ) -> Result<Self, Box<dyn std::error::Error + 'static + Send + Sync>> {
        let s = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        Ok(ColumnType::from_str(&s).map_err(|_| "Invalid ColumnType string")?)
    }
}

impl PoolHandler for DbPool {
    async fn try_new(db_config: &DatabaseConfig) -> Result<Self, AppError> {
        match db_config.db_type {
            DatabaseType::Postgres => {
                let pool = PgPoolHandler::try_new(db_config).await?;
                Ok(DbPool::Postgres(pool))
            }
            DatabaseType::Mysql => {
                let pool = MySqlPoolHandler::try_new(db_config).await?;
                Ok(DbPool::MySql(pool))
            }
            #[allow(unreachable_patterns)]
            _ => Err(AppError::UnsupportedDatabaseType(
                db_config.db_type.to_string(),
            )),
        }
    }

    async fn list_tables(&self) -> Result<Vec<TableInfo>, AppError> {
        match self {
            DbPool::Postgres(pg_pool) => pg_pool.list_tables().await,
            DbPool::MySql(mysql_pool) => mysql_pool.list_tables().await,
        }
    }

    // Add method signature for getting table schema
    async fn get_table_schema(&self, table_name: &str) -> Result<TableSchema, AppError> {
        match self {
            DbPool::Postgres(pg_pool) => pg_pool.get_table_schema(table_name).await,
            DbPool::MySql(mysql_pool) => mysql_pool.get_table_schema(table_name).await,
        }
    }

    async fn sanitize_query(&self, query: &str, limit: usize) -> Result<String, AppError> {
        match self {
            DbPool::Postgres(pg_pool) => pg_pool.sanitize_query(query, limit).await,
            DbPool::MySql(mysql_pool) => mysql_pool.sanitize_query(query, limit).await,
        }
    }

    async fn execute_query(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> Result<QueryResult, AppError> {
        match self {
            DbPool::Postgres(pg_pool) => pg_pool.execute_query(query, limit).await,
            DbPool::MySql(mysql_pool) => mysql_pool.execute_query(query, limit).await,
        }
    }
}
