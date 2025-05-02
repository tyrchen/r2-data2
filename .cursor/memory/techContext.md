# Technical Context: SQL Query Interface

## Frontend Technologies

-   **Framework:** React (version specified by project setup)
-   **Language:** TypeScript
-   **State Management:** Zustand
-   **SQL Editor Component:** `@sqlrooms/sql-editor` (specifically `<SqlMonacoEditor>` for integration)
-   **Visualization Library:** Vega-Lite via `react-vega`
-   **CSS:** Tailwind CSS
-   **UI Components:** use shadcn/ui components
-   **HTTP Client:** Browser `fetch` API.
-   **Build Tool:** Vite

## Backend Technologies

-   **Language:** Rust (stable toolchain)
-   **Web Framework:** Axum
-   **Async Runtime:** Tokio
-   **Database Interaction:** SQLx (with features for PostgreSQL initially, potentially others like MySQL later)
-   **Serialization/Deserialization:** Serde (for JSON handling)
-   **JWT Handling:** `jsonwebtoken` crate
-   **SQL Parsing:** `sqlparser` crate
-   **Configuration:** `config` crate
-   **Build System:** Cargo
-   **Middleware (Potential):** `tower-http` for CORS, potentially custom middleware for JWT authentication.

## Databases

-   **Primary Target:** PostgreSQL (specific version TBD, assume recent)
-   **Design Goal:** Support for other SQL databases like MySQL/MariaDB in the future.

## Development Environment

-   **Frontend:** Node.js/npm (or yarn) for package management and running dev server.
-   **Backend:** Rust toolchain (rustc, cargo).
-   **Database:** Local PostgreSQL instance for development and testing.
-   **Version Control:** Git.

## Key Library Considerations

-   `@sqlrooms/sql-editor`: Core dependency for the editor. Need to understand its API for passing schema (`tableSchemas` prop) and getting/setting query text.
-   `react-vega`: Need to integrate the `<VegaLite>` component and manage Vega-Lite JSON specifications.
-   `sqlx`: Backend relies heavily on this for async DB access, connection pooling, and row mapping.
-   `jsonwebtoken`: Used for decoding/validating JWTs in backend middleware.
-   `sqlparser`: Used to sanitize user-provided SQL queries.
-   `axum`: Foundation for backend routing, state management, request/response handling, and middleware.
