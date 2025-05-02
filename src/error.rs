use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;
use tracing::warn;

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Missing credentials")]
    MissingCredentials,

    #[error("Token creation error")]
    TokenCreation,

    #[error("Internal server error (auth)")]
    InternalError,
}

// General AppError Enum
#[derive(Error, Debug)]
pub enum AppError {
    #[error(transparent)]
    Auth(#[from] AuthError),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Unsupported database type: {0}")]
    UnsupportedDatabaseType(String),

    #[error("Configuration error: {0}")]
    Config(#[from] config::ConfigError),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Not implemented: {0}")]
    NotImplemented(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("SQL parsing error: {0}")]
    SqlParsingError(String),

    #[error("Invalid query result: {0}")]
    InvalidQueryResult(String),
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AuthError::InvalidToken(msg) => {
                (StatusCode::UNAUTHORIZED, format!("Invalid Token: {}", msg))
            }
            AuthError::MissingCredentials => {
                (StatusCode::UNAUTHORIZED, "Missing Credentials".to_string())
            }
            AuthError::TokenCreation => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal error".to_string(),
            ),
            AuthError::InternalError => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal error".to_string(),
            ),
        };

        let body = Json(json!({ "error": error_message }));
        (status, body).into_response()
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::Auth(auth_error) => {
                // Reuse AuthError's IntoResponse implementation detail logic
                return auth_error.into_response();
            }
            AppError::Database(db_err) => {
                // Log the detailed DB error for internal review
                tracing::error!("Database error: {}", db_err);
                // Provide a generic message to the client
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal database error".to_string(),
                )
            }
            AppError::UnsupportedDatabaseType(db_type) => (
                StatusCode::BAD_REQUEST,
                format!("Unsupported database type: {}", db_type),
            ),
            AppError::Config(config_err) => {
                tracing::error!("Configuration error: {}", config_err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Server configuration error".to_string(),
                )
            }
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::NotImplemented(msg) => (StatusCode::NOT_IMPLEMENTED, msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::SqlParsingError(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::InvalidQueryResult(msg) => {
                warn!("Invalid query result: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Invalid query result".to_string(),
                )
            }
        };

        let body = Json(json!({ "error": error_message }));
        (status, body).into_response()
    }
}
