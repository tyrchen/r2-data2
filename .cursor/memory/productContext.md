# Product Context: SQL Query Interface

## User Needs & Goals

Users (likely developers or data analysts) need a convenient web-based tool to:

1.  Connect to various SQL databases within their environment.
2.  Easily understand the structure (schema) of the databases they are working with.
3.  Write SQL queries efficiently, aided by syntax highlighting and context-aware autocompletion (table/column names).
4.  Execute these queries against the database.
5.  View the results of their queries clearly in a table.
6.  Optionally visualize the results as charts for better understanding or reporting.
7.  Perform these actions securely.

## Key Features & User Experience (UX)

-   **Multi-Panel Layout:** A simultaneous view of database/schema, SQL editor, and results enhances workflow efficiency. Panels should be responsive and potentially resizable.
    -   Database Selector (Sidebar)
    -   Schema Browser (Sidebar, below selector)
    -   SQL Editor (Main area, top)
    -   Result Viewer (Main area, bottom - with Table/Chart toggle)
-   **Database Selector:** Simple dropdown or list to choose the target database.
-   **Schema Browser:** Tree or list view of tables (and potentially views/columns) for the selected database. Clicking elements might insert names into the editor.
-   **SQL Editor:** Powered by `@sqlrooms/sql-editor` (Monaco-based). Provides:
    -   SQL syntax highlighting.
    -   Autocompletion for SQL keywords, functions, table names, and column names (driven by fetched schema).
    -   An "Execute" button (and potentially keyboard shortcut like Ctrl+Enter).
    -   Optional: Multi-tab support, SQL formatting.
-   **Result Viewer:**
    -   **Table View:** Displays query results in a data grid/table. Should handle large results reasonably (scrolling, potential pagination/virtualization). Displays column headers and rows. Handles non-SELECT results (e.g., showing affected row counts) and query errors.
    -   **Visualization View:** Toggles to display a chart based on the result data using Vega-Lite. Initial implementation might offer default charts (e.g., bar chart for categorical/quantitative data) or simple user controls (selecting X/Y axes).
-   **State Management:** Global state (using Zustand) manages the selected database, schema, current query, results, and auth token, ensuring components are synchronized.
-   **Security:** User authentication via JWT ensures only authorized users can access the API and execute queries.
