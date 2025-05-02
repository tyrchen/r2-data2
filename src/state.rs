use crate::{AppConfig, DbPool, db::PoolHandler, error::AppError, handlers::FullSchema};
use moka::future::Cache;
use papaya::HashMap;
use std::{ops::Deref, sync::Arc, time::Duration};
use tracing::info;

#[derive(Clone)]
pub struct AppState(Arc<AppStateInner>);

pub struct AppStateInner {
    pub config: AppConfig,
    pub pools: Arc<HashMap<String, DbPool>>,
    // Cache for the full schema, storing the Result wrapped in Arc
    pub schema_cache: Cache<String, Arc<Result<FullSchema, AppError>>>,
}

// Manual Debug implementation because sqlx Pools don't implement Debug
impl std::fmt::Debug for AppStateInner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppStateInner")
            .field("config", &self.config)
            .field("db_pools_count", &self.pools.len()) // Only show count
            // Do not display the cache content
            .finish_non_exhaustive()
    }
}

// Manual Debug implementation for AppState wrapper
impl std::fmt::Debug for AppState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("AppState").field(&self.0).finish()
    }
}

impl Deref for AppState {
    type Target = AppStateInner;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl AppState {
    pub async fn new(config: AppConfig) -> Result<Self, anyhow::Error> {
        let pools = HashMap::new();

        for db_config in &config.databases {
            info!(
                "Connecting to database '{}' (type: {})",
                db_config.name, db_config.db_type
            );
            let pool = DbPool::try_new(db_config).await?;
            pools.pin().insert(db_config.name.clone(), pool);
        }
        info!("Database connections established.");

        // Create the schema cache
        let schema_cache = Cache::builder()
            // Time to live (TTL): 10 minutes
            .time_to_live(Duration::from_secs(10 * 60))
            // Max capacity (optional, e.g., only 1 entry needed)
            .max_capacity(1)
            .build();

        let inner = AppStateInner {
            config,
            pools: Arc::new(pools),
            schema_cache,
        };
        Ok(Self(Arc::new(inner)))
    }
}
