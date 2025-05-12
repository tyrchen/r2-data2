use std::{fmt, path::Path, str::FromStr};

use config::{Config, Environment, File};
use serde::{Deserialize, Serialize};

use crate::DatabaseType;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DatabaseConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub db_type: DatabaseType,
    pub conn_string: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
    pub server_addr: String,
    #[serde(default)] // Provide default empty vec if missing
    pub databases: Vec<DatabaseConfig>,
    pub jwt_secret: String,
    pub allowed_origin: String,
}

impl AppConfig {
    pub fn load(config_path: &str) -> Result<Self, anyhow::Error> {
        // Construct paths for configuration files
        let default_config = Path::new(config_path).join("default");
        let dev_config = Path::new(config_path).join("development");

        // Load configuration
        let config = Config::builder()
            .add_source(File::with_name(default_config.to_str().unwrap()))
            .add_source(File::with_name(dev_config.to_str().unwrap()).required(false))
            .add_source(Environment::with_prefix("APP").separator("__"))
            .build()?;

        let app_config: AppConfig = config.try_deserialize()?;
        Ok(app_config)
    }
}

impl fmt::Display for DatabaseType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DatabaseType::Postgres => write!(f, "postgres"),
            DatabaseType::Mysql => write!(f, "mysql"),
        }
    }
}

impl FromStr for DatabaseType {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "postgres" | "postgresql" => Ok(DatabaseType::Postgres),
            "mysql" | "mariadb" => Ok(DatabaseType::Mysql),
            _ => Err(anyhow::anyhow!("Invalid database type: {}", s)),
        }
    }
}
