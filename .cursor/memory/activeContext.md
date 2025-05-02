# Active Context: SQL Query Interface (Initialization)

## Project Goal

Develop a web-based SQL Query Interface allowing users to connect to databases (starting with PostgreSQL), browse schemas, write/execute SQL queries with autocompletion, and view results in tables or charts. The system uses a React frontend and a Rust/Axum backend with JWT authentication.

## Current Phase

**Planning/Implementation (Level 3).** The detailed design specification is available in `specs/0001-design.md`. Implementation plan generated based on Level 3 complexity. Tasks B.1 and B.2 are complete.

## Implementation Plan Summary (Level 3)

1.  **Requirements Analysis:** Build web-based SQL query tool (React/Rust) with DB connection, schema browsing, SQL editor (autocomplete), query execution, results table, visualization (Vega-Lite), and JWT auth.
2.  **Components Affected:** Backend (Axum, SQLx, JWT), Frontend (React, Zustand, @sqlrooms/sql-editor, react-vega, shadcn/ui). Specific modules identified.
3.  **Architecture Considerations:** Stateless REST API, JWT security, DB abstraction, connection pooling, client-side state management.
4.  **Implementation Strategy:** Phased approach: Backend foundation -> Frontend foundation -> Core Query Flow -> Visualization -> Testing.
5.  **Detailed Steps:** See `tasks.md`.
6.  **Dependencies:** Key libraries listed for backend (Axum, SQLx, etc.) and frontend (React, Zustand, etc.).
7.  **Challenges & Mitigations:** Schema mapping, JWT security, SQL safety, large results, editor integration, visualization complexity addressed with mitigation strategies.
8.  **Creative Phase Components:** Minor UI/chart logic refinement during implementation.

## Key Components & Technologies

-   **Frontend:** React, Zustand, `@sqlrooms/sql-editor`, Vega-Lite (`react-vega`), shadcn/ui, Tailwind CSS.
-   **Backend:** Rust, Axum, Tokio, SQLx, `jsonwebtoken`, `sqlparser`, `config`, `papaya`, Serde, Thiserror.
    -   Modules: `auth`, `config`, `db` (for DB types, pool operations like `list_tables`, `get_table_schema`, `sanitize_query`, `execute_query`), `error`, `handlers`, `state`.
-   **Architecture:** Client-Server (React SPA + Rust REST API), JWT Auth, Multi-Panel UI, `AppState` pattern, DB operations abstracted in `DbPool` / `PoolHandler` trait methods.

## Immediate Focus

-   Proceed with implementation based on the task list (`tasks.md`), starting with **Task B.10** (Review and refine error handling / JSON responses).

## Pending Decisions / Information

-   Exact JWT login mechanism (internal implementation or external service assumption) - Assume internal stub/simple implementation for now.
-   Need for database migrations (`sqlx-cli`) - Defer until database schema stabilizes or is required.

## Memory Bank Status

-   `projectbrief.md`: Initialized.
-   `productContext.md`: Initialized.
-   `systemPatterns.md`: Initialized.
-   `techContext.md`: Initialized.
-   `activeContext.md`: Updated (Reflects B.9 completion, refined architecture).
-   `progress.md`: To be updated.
-   `tasks.md`: Updated (Task B.9 marked complete).
