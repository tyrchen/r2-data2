use crate::{AppConfig, DbPool, db::PoolHandler};
use papaya::HashMap;
use std::{ops::Deref, sync::Arc};
use tracing::info;

#[derive(Clone)]
pub struct AppState(Arc<AppStateInner>);

pub struct AppStateInner {
    pub config: AppConfig,
    pub pools: Arc<HashMap<String, DbPool>>,
}

// Manual Debug implementation because sqlx Pools don't implement Debug
impl std::fmt::Debug for AppStateInner {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AppStateInner")
            .field("config", &self.config)
            .field("db_pools_count", &self.pools.len()) // Only show count
            .finish()
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

        let inner = AppStateInner {
            config,
            pools: Arc::new(pools),
        };
        Ok(Self(Arc::new(inner)))
    }
}
