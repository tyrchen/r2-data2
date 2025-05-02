mod auth;
mod config;
mod db;
mod error;
mod handlers;
mod state;

use axum::{
    Router,
    http::{HeaderValue, StatusCode, Uri, header},
    middleware,
    response::{Html, IntoResponse, Response},
    routing::{get, post},
};

pub use auth::Claims;
pub use config::AppConfig;
pub use db::{DatabaseInfo, DatabaseType, DbPool, TableInfo, TableType};
pub use error::AuthError;
use rust_embed::Embed;
pub use state::AppState;
use tower_http::{
    LatencyUnit,
    cors::{self, CorsLayer},
    trace::{DefaultOnRequest, DefaultOnResponse, TraceLayer},
};
use tracing::Level;

static INDEX_HTML: &str = "index.html";

#[derive(Embed)]
#[folder = "ui/dist"]
struct Assets;

pub fn get_router(state: AppState) -> Router {
    // Configure CORS
    let allowed_origin_str = state.config.allowed_origin.clone();
    let cors = CorsLayer::new()
        .allow_origin(
            allowed_origin_str
                .parse::<HeaderValue>()
                .unwrap_or_else(|_| panic!("Invalid ALLOWED_ORIGIN: {}", allowed_origin_str)),
        )
        .allow_methods(cors::Any)
        .allow_headers(cors::Any);

    // Define routes that need authentication
    let api_routes = Router::new()
        .route("/ping", get(handlers::ping))
        .route("/databases", get(handlers::list_databases))
        .route("/databases/{db_name}/tables", get(handlers::list_tables))
        .route(
            "/databases/{db_name}/tables/{table_name}/schema",
            get(handlers::get_table_schema),
        )
        .route("/execute-query", post(handlers::execute_query))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ));

    // Public routes (like root or maybe login later)
    Router::new()
        .nest("/api", api_routes)
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(
                    DefaultOnResponse::new()
                        .level(Level::INFO)
                        .latency_unit(LatencyUnit::Micros),
                ),
        )
        .fallback(static_handler)
        .with_state(state)
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if path.is_empty() || path == INDEX_HTML {
        return index_html().await;
    }

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();

            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            if path.contains('.') {
                return not_found().await;
            }

            index_html().await
        }
    }
}

async fn index_html() -> Response {
    match Assets::get(INDEX_HTML) {
        Some(content) => Html(content.data).into_response(),
        None => not_found().await,
    }
}

async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "404").into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_router() {
        // Mock or load a valid config for testing
        // This might require creating a test config file or mocking AppConfig::load
        let config = AppConfig::load().unwrap(); // Assumes config files exist
        let state = AppState::new(config).await.unwrap();
        let _router = get_router(state);
        // Basic test passes if it doesn't panic
    }
}
