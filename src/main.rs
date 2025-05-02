use r2_data2::{AppConfig, AppState, get_router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let config = AppConfig::load()?;
    info!("Loaded configuration: {:?}", config);
    let addr: SocketAddr = config.server_addr.parse()?;

    let state = AppState::new(config).await?;

    let app = get_router(state);

    info!("listening on {}", addr);
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
