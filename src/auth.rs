use crate::{error::AuthError, state::AppState};
use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, Request},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::{Deserialize, Serialize};

// Define the structure of the JWT claims
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String, // Subject (e.g., user ID or email)
    pub exp: usize,  // Expiration time (timestamp)
                     // Add any other custom claims you might need
                     // pub roles: Vec<String>,
}

pub async fn auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, AuthError> {
    let token = headers
        .get("Authorization")
        .and_then(|header| header.to_str().ok())
        .and_then(|header| header.strip_prefix("Bearer "));

    let token = token.ok_or(AuthError::MissingCredentials)?;

    let decoding_key = DecodingKey::from_secret(state.config.jwt_secret.as_ref());

    let validation = Validation::default();

    let claims = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|e| AuthError::InvalidToken(e.to_string()))?
        .claims;

    // Store claims in request extensions for handlers to use if needed
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

// Add tests module
#[cfg(test)]
mod tests {
    use crate::AppConfig;

    use super::*;
    use jsonwebtoken::{EncodingKey, Header, encode};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    // Example function to generate a JWT
    fn generate_test_jwt(
        user_id: &str,
        duration_secs: u64,
    ) -> Result<String, jsonwebtoken::errors::Error> {
        let config = AppConfig::load().unwrap();
        let secret = config.jwt_secret;
        let now = SystemTime::now();
        let expiration = now.duration_since(UNIX_EPOCH).expect("Time went backwards")
            + Duration::from_secs(duration_secs);

        let claims = Claims {
            sub: user_id.to_owned(),
            exp: expiration.as_secs() as usize,
        };

        let header = Header::default(); // Default algorithm is HS256
        let encoding_key = EncodingKey::from_secret(secret.as_ref());

        encode(&header, &claims, &encoding_key)
    }

    #[test]
    fn test_jwt_generation() {
        let config = AppConfig::load().unwrap();
        let secret = config.jwt_secret;
        let user_id = "test_user@example.com";
        let token = generate_test_jwt(user_id, 3600 * 24 * 365 * 10); // 10 years expiration

        assert!(token.is_ok());
        let generated_token = token.unwrap();
        println!("Generated Test JWT: {}", generated_token);

        // Optional: Verify the generated token (requires decoding logic similar to middleware)
        let decoding_key = DecodingKey::from_secret(secret.as_ref());
        let validation = Validation::default();
        let decoded = decode::<Claims>(&generated_token, &decoding_key, &validation);
        assert!(decoded.is_ok());
        assert_eq!(decoded.unwrap().claims.sub, user_id);
    }
}
