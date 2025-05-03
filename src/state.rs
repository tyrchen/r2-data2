use crate::{AppConfig, DbPool, db::PoolHandler, error::AppError, handlers::FullSchema};
use moka::future::Cache;
use papaya::HashMap;
use rig::providers::openai as rig_openai;
use std::{ops::Deref, sync::Arc, time::Duration};
use tracing::{error, info}; // Import with alias

#[derive(Clone)]
pub struct AppState(Arc<AppStateInner>);

pub struct AppStateInner {
    pub config: AppConfig,
    pub pools: Arc<HashMap<String, DbPool>>,
    // Cache for the full schema, storing the Result wrapped in Arc
    pub schema_cache: Cache<String, Arc<Result<FullSchema, AppError>>>,
    // Add OpenAI client from rig-core
    pub openai_client: rig_openai::Client,
}

// Manual Debug implementation because sqlx Pools don't implement Debug
impl std::fmt::Debug for AppStateInner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppStateInner")
            .field("config", &self.config)
            .field("db_pools_count", &self.pools.len()) // Only show count
            // Do not display the cache content
            // Do not display the openai client details
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
            match DbPool::try_new(db_config).await {
                Ok(pool) => {
                    pools.pin().insert(db_config.name.clone(), pool);
                }
                Err(e) => {
                    error!("Failed to connect to database '{}': {}", db_config.name, e);
                }
            }
        }
        info!("Database connections established.");

        // Create the schema cache
        let schema_cache = Cache::builder()
            // Time to live (TTL): 10 minutes
            .time_to_live(Duration::from_secs(10 * 60))
            // Max capacity (optional, e.g., only 1 entry needed)
            .max_capacity(1)
            .build();

        // Initialize OpenAI client using environment variable
        // This will panic if OPENAI_API_KEY is not set.
        // Consider adding error handling or configuration check earlier.
        info!("Initializing OpenAI client from environment...");
        let openai_client = rig_openai::Client::from_env();
        info!("OpenAI client initialized.");

        let inner = AppStateInner {
            config,
            pools: Arc::new(pools),
            schema_cache,
            openai_client, // Add client to state
        };
        Ok(Self(Arc::new(inner)))
    }

    #[cfg(test)]
    pub fn new_for_test(config: AppConfig) -> Self {
        // Create empty/dummy versions of fields not needed for config-only tests
        let pools = Arc::new(HashMap::new());
        let schema_cache = Cache::builder().build();
        // Initialize client from env - it won't be used in config-only tests.
        // This might panic if OPENAI_API_KEY is *required* and *not set* during init,
        // but typically `from_env` reads it lazily or handles its absence until first use.
        let openai_client = rig_openai::Client::from_env();

        let inner = AppStateInner {
            config,
            pools,
            schema_cache,
            openai_client,
        };
        Self(Arc::new(inner))
    }
}
