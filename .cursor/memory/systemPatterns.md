# System Patterns: SQL Query Interface

## Architecture Overview

-   **Client-Server Architecture:** A React Single Page Application (SPA) frontend communicates with a Rust/Axum backend via a RESTful API.
-   **Backend:** Stateless API design (state primarily managed by the client or through JWT claims). Uses Axum framework on Tokio runtime.
-   **Frontend:** Component-based architecture using React. Multi-panel layout for UI.

## Key Patterns & Mechanisms

-   **API Design:** RESTful endpoints for managing databases, schemas, and query execution.
    -   `GET /api/databases`
    -   `GET /api/databases/{dbName}/tables`
    -   `GET /api/databases/{dbName}/tables/{tableName}/schema`
    -   `POST /api/execute-query`
    -   (Optional) `GET /api/databases/{dbName}/tables/{tableName}/indexes`
    -   (Optional) `POST /api/login`
-   **Authentication:** JWT (JSON Web Tokens) used for securing API endpoints. Tokens issued upon login (mechanism TBD or assumed external) and sent in `Authorization: Bearer <token>` header. Backend middleware verifies tokens.
-   **State Management (Frontend):** Global state managed by Zustand. Central store holds application state (auth token, selected DB, schema, query, results, UI state). Components subscribe to relevant state slices.
-   **Database Interaction (Backend):**
    -   Uses SQLx for asynchronous database operations.
    -   Connection Pooling (`sqlx::Pool`) for efficient connection management.
    -   Database Abstraction: Configuration and logic designed to support multiple SQL database types (PostgreSQL initially) by potentially using traits or conditional logic for schema introspection and maintaining a unified API response format.
    -   Store database connection pools (`PgPool`, `MySqlPool`, etc.) in a `papaya::HashMap<String, DbPool>` within the Axum application state.
-   **Query Execution & Safety (Backend):**
    -   Accepts raw SQL from the user.
    -   Uses `sqlparser` to parse the query, allowing only single `SELECT` statements.
    -   Executes the parsed query using `sqlx::query()`.
    -   Wraps user query in a CTE to fetch results as a single JSON object (`JSON_AGG`).
-   **Schema Introspection (Backend):** Queries database system catalogs or `information_schema` to retrieve metadata (tables, columns, types, constraints). Provides this info via API endpoints in a consistent JSON format.
-   **Autocompletion (Frontend):** Leverages the `@sqlrooms/sql-editor` component (`SqlMonacoEditor`), feeding it schema information (tables, columns) fetched from the backend API to enable context-aware suggestions.
-   **Visualization (Frontend):** Uses Vega-Lite (via `react-vega`) to render charts from query results. Generates Vega-Lite JSON specifications based on result data and potentially user configuration.
-   **Error Handling:** Consistent error reporting via HTTP status codes (401, 400, 404, 500) and JSON error bodies (`{"error": "..."}`) from the backend. Frontend handles API errors gracefully and displays messages to the user.
-   **CORS:** Backend configured to allow requests from the frontend origin.
