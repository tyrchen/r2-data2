# Project Brief: R2 Data 2 - SQL Query Interface

## Overview

This project aims to build a **SQL Query Interface** web application. It features a React frontend and a Rust (Axum) backend.

## Core Functionality

-   **Database Connection:** Allow users to select and connect to configured SQL databases (initially PostgreSQL, designed for extension).
-   **Schema Exploration:** Provide a UI to browse the schema (tables, columns) of the selected database.
-   **SQL Editor:** Offer a feature-rich SQL editor with syntax highlighting and autocompletion based on the database schema, using the `@sqlrooms/sql-editor` package.
-   **Query Execution:** Enable users to execute SQL queries securely against the selected database via the backend API.
-   **Results Display:** Present query results in a clear tabular format.
-   **Data Visualization:** Offer an optional chart view for query results using Vega-Lite.

## Technical Stack

-   **Frontend:** React, Zustand (state management), `@sqlrooms/sql-editor` (SQL editor component), Vega-Lite (via `react-vega` for charts).
-   **Backend:** Rust, Axum (web framework), Tokio (async runtime), SQLx (database interaction), `jsonwebtoken` (JWT authentication).
-   **Database:** PostgreSQL (initial), designed for multi-DB support (e.g., MySQL).

## Key Architectural Points

-   Multi-panel, responsive UI layout.
-   RESTful API backend.
-   JWT-based authentication for API security.
-   Database abstraction layer in the backend to support multiple database types.
-   Use of connection pooling (`sqlx::Pool`) for database interactions.
-   Parsing query using `sqlparser` in backend to prevent SQL injection.
-   Return query result as JSON in backend API.

## Status

Implementation-ready design documented in `specs/0001-design.md`.
