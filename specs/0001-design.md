# R2 Data 2 Design Document: React + Rust/Axum SQL Query Interface

## Overview

This document outlines the implementation-ready design for a **SQL Query Interface** with a React frontend and a Rust (Axum) backend. The application allows users to select a database, browse its schema (tables and columns), write SQL queries with autocompletion and syntax highlighting, execute the queries on a server, and view the results (including optional visualizations). Key features include a multi-panel UI (database selector, schema browser, SQL editor, results viewer) and secure backend API with JWT-based authentication. The initial database support will focus on PostgreSQL, but the design is abstracted to accommodate multiple SQL database types in the future. All aspects of the design – from UI components to API endpoints – are detailed below for frontend and backend engineers to begin implementation.

## Frontend Design

### UI Layout and Components

The frontend will be built with **React** and will utilize the `@sqlrooms/sql-editor` package for the SQL editor component. The interface is organized into multiple panels for ease of use and clarity. The layout is roughly as follows (all panels visible simultaneously in a responsive layout):

- **Database Selector**: A sidebar section that lets the user choose from available databases. This could be a dropdown or list. Selecting a database triggers loading of its schema (tables) via the API.
- **Schema Browser**: A panel (likely on the left side below the database selector) that lists the tables (and possibly views) in the selected database. This can be a tree or list; if needed, it can later show nested schema or expand to show columns. The schema browser allows the user to browse tables and maybe click a table to insert its name into the editor or view its details.
- **SQL Editor**: The main panel where the user writes SQL queries. This will use a Monaco-based SQL editor component (from `@sqlrooms/sql-editor`). It provides SQL-specific syntax highlighting and autocompletion. We can use either the high-level `<SqlEditor>` component (which includes a full editor UI) or the lower-level `<SqlMonacoEditor>` for more custom layout control. In this design, we plan to integrate the editor into our layout (not just as a modal) for a seamless multi-panel experience. The editor panel will also include an "Execute" action (e.g., a Run button or hitting Ctrl+Enter) to send the query to the backend.
- **Result Viewer**: A panel (typically below or beside the editor) that displays query results. Results will default to a **data table** view showing rows returned by the query. We will integrate a React data table/grid component for features like pagination, scrolling, and possibly the ability to sort/filter client-side. If a query returns no result set (e.g. an `UPDATE`), this panel can show an affected rows count or a success message. This panel will also support a **visualization view**: the user can toggle to a chart view for the result data. The chart view will use a library like Vega-Lite for rich visualizations.
- **Additional Controls**: We will include any necessary controls such as a query history or multiple query tabs (optional). The `@sqlrooms/sql-editor` package supports multiple query tabs out of the box, and we can expose this feature (e.g., an "Add Tab" button to write and switch between multiple queries). Another control is exporting results (e.g., to CSV), which can be offered via a button if needed (the sqlrooms editor has an API for CSV export as well ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=,Update))).

All these components will be arranged in a flexible layout. For example, a typical arrangement is a left sidebar for **Database Selector** and **Schema Browser**, and a right section divided into top and bottom: the top for the **SQL Editor** and the bottom for the **Result Viewer**. This ensures the schema list and editor are visible together, and results appear below the query for context. The panels should be resizable (using CSS flex or a library for split panes) so that users can adjust the space for editor vs. results, etc. The design will also be responsive: on narrower screens, the schema browser might collapse into a dropdown or accordion.

**Component Responsibilities:**

- **DatabaseSelector Component**: Provides a UI (dropdown or list) of available databases. On selection, it updates the global state with the chosen database and triggers fetching the schema (tables) for that database via the API. It should display the current database name and possibly an icon or type (e.g., "PostgreSQL").
- **SchemaBrowser Component**: Displays the list of tables (and potentially views) for the selected database. It fetches data from `GET /api/databases/{dbName}/tables` and renders the list. Each entry could be clickable to insert the table name into the editor or to fetch its schema details. Optionally, the SchemaBrowser can allow expansion to show a table’s columns (which would use `GET /api/databases/{dbname}/tables/{tablename}/schema` for that table). This component may be implemented using the provided `SqlQueryDataSourcesPanel` from the SQLRooms library for convenience ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=SqlQueryDataSourcesPanel)) ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=,ProjectBuilderProvider)). The `SqlQueryDataSourcesPanel` can display data sources and tables and accept a callback for when a table is selected (to, for example, insert the table name into the query editor) ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=,ProjectBuilderProvider)). Using this ready-made component (wrapped in the required provider) can speed up development, but a custom implementation gives more control. For our design, either approach is viable – we can decide during implementation.
- **SqlEditor Component**: The code editor for SQL input. Using `@sqlrooms/sql-editor`, we have two options:
  - `<SqlEditor>`: a full-featured component that includes the editor and possibly built-in schema panel and results handling. It requires wrapping in a `ProjectBuilderProvider` with a configured store. This might provide a lot of functionality out of the box (multiple tabs, etc.) but gives us slightly less control over layout.
  - `<SqlMonacoEditor>`: a lighter-weight component that just renders the Monaco editor for SQL. We will use this inside our own editor panel, coupled with our own Run button and results panel logic. This component supports important props for our needs. We will supply the current query text (`value` and `onChange` handler) and crucially the **autocompletion schema**. The `SqlMonacoEditor` accepts a prop `tableSchemas` which is an array of table definitions used to power autocomplete suggestions ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=SqlMonacoEditor%20Props)). We will populate this with the tables and columns from the backend. The editor will provide SQL syntax highlighting by default, and using `tableSchemas` will allow it to suggest table names and column names appropriately as the user types (e.g., after typing `SELECT * FROM ` or after a table alias and dot).

  The editor panel will also include an **Execute button** (or similar) to run the query. The button will call the backend API (`POST /api/execute-query`) with the current query and then trigger updating the results panel with the response. We will also handle keyboard shortcuts (e.g., Ctrl+Enter to run) by listening to editor key events or using Monaco’s keybinding support. Additionally, we might include a "Format SQL" button if using a SQL formatter (optional enhancement).
- **ResultsTable Component**: Responsible for displaying query results in tabular form. It will receive the data returned from the backend (likely as an array of rows with column metadata) and render it. For a professional look and functionality, using a data grid library is recommended (for example, **MUI DataGrid**, **AG Grid**, or a lightweight table from Ant Design or Chakra UI). At minimum, the component should display column headers and rows of data, and handle a large number of rows efficiently (possibly via virtualization or pagination). For MVP, we can display up to a certain number of rows (e.g., first 1000) with a message if more rows are truncated. The ResultsTable should also handle scenarios like:
  - No results (e.g., an empty array) – show a message "No results".
  - Error in query – show the error message (this might be displayed here or in a separate "message" area).
  - Non-select queries (UPDATE/INSERT) – show a summary like "Query OK, 5 rows affected".
- **Visualization/Chart Component**: This component (could be within the results panel, perhaps as a tab or toggle) will render a chart based on the query results. We propose using **Vega-Lite** (via the `react-vega` wrapper) as the visualization library. Vega-Lite is a high-level grammar of interactive graphics with a declarative JSON spec for charts ([A High-Level Grammar of Interactive Graphics | Vega-Lite](https://vega.github.io/vega-lite/#:~:text=Vega,for%20data%20analysis%20and%20presentation)). It allows quickly creating a wide range of visualizations (bar charts, line charts, scatter plots, etc.) by specifying how data fields map to graphical properties. Using Vega-Lite will make it easier to support different chart types without hand-coding each one. The chart component will take the result data (likely an array of objects) and a chosen chart specification. In the simplest case, we might auto-generate a default chart: for example, if the result has numeric columns, create a bar chart of the first numeric column grouped by the first column. A more advanced approach is to let the user pick which columns to use for X/Y axes or other encodings via a UI. Initially, we can provide a few preset options (like "Bar chart" or "Line chart") and use Vega-Lite specs for those, plugging in the data. The charts should update when new results come in or when the user selects a different chart type. We might integrate a small UI in the results panel to choose chart vs. table view. The `react-vega` library can render a Vega or Vega-Lite spec directly in a React component, which fits our needs.

All components will be built to work together with shared state (for selected database, loaded schema, current query, etc.). We will use **Zustand** for state management to keep the app logic simple and efficient.

### State Management with Zustand

We will manage frontend state using the **Zustand** library. Zustand is a lightweight and fast state management solution that is easy to learn and doesn’t require the boilerplate of Redux ([Zustand 101: A Beginner's Guide to Global State Management in React - DEV Community](https://dev.to/jaredm/zustand-101-a-beginners-guide-to-global-state-management-in-react-lml#:~:text=Zustand%20is%20a%20state%20management,a%20simple%20and%20intuitive%20way)). It allows us to create a global store for our application state and use it via hooks in React components.

**State Structure:** We will maintain a global store object that holds the following state slices:

- **Authentication State**: e.g. `authToken` (the JWT) and maybe `currentUser` info. This token will be needed to authorize API calls. We might store the token in memory via Zustand (and also in `localStorage` for persistence between sessions if needed).
- **Database/Schema State**:
  - `availableDatabases`: list of databases (fetched from `/api/databases`). This could be an array of objects like `{ name, type }` or just names.
  - `selectedDatabase`: the identifier/name of the currently chosen database (defaults to none or a last used).
  - `tables`: list of tables for the selected database. This could be an array of table objects or just names. If we include type info (table or view), each item can be `{ name: string, type: string }`.
  - `tableSchemas`: schema details for tables. This can be a map/object where keys are table names and values are the column info (or an array of such structures). For example, `tableSchemas["users"] = { columns: [ ... ], constraints: ... }`. This state is used to feed autocompletion. We might populate this on demand (when a table is clicked or when first needed for autocomplete) or preload for all tables when the DB is selected. Preloading all table schemas for a large database could be heavy, so a strategy is: fetch the list of tables first, and only fetch column details when the user expands a table in the browser or when the editor’s autocomplete triggers a request. We can implement on-demand loading easily with Zustand by updating state when new info comes in. The `SqlMonacoEditor` also allows a callback `getLatestSchemas` ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=readOnly%20boolean%20false%20Whether%20the,Monaco%20editor%20options)) which we can use to fetch fresh schema data when needed (for example, if the user manually refreshes the schema).
- **Query State**:
  - `currentQuery`: the SQL query text currently in the editor. (If multiple tabs are supported, this could be part of an array of queries with an active index).
  - `queryResult`: the last query result data. This could hold `{ columns: string[], rows: any[][] }` or similar. Alternatively, store `queryResultRows` and `queryResultColumns` separately. We will store it in a format convenient for the table component and visualization (e.g., an array of objects where keys are column names might be convenient for charts, whereas an array of arrays with a separate columns list is convenient for table display. We can store both if needed or convert on the fly).
  - `queryError`: any error message from the last query execution (if it failed). This can be displayed in the results panel.
  - `isQueryRunning`: boolean to indicate a query execution in progress (to, for example, disable the Run button and show a loading spinner).
- **UI State**:
  - This includes flags like `showVisualization` (true if the user has switched the result view to chart mode), `selectedTable` (if the user selects a table in the schema browser, we might highlight it and possibly show its columns or sample data), and panel sizes (if we implement resizable panels and want to preserve sizes).

Using Zustand, we create the store with an initial state and define state-updating functions (actions) that modify these slices. For example, `setSelectedDatabase(dbName)` will update `selectedDatabase` and typically trigger fetching the tables and resetting query state. We also have `setCurrentQuery(query)` (or we could bind the editor directly to the store state), `setQueryResult(data)`, etc. Zustand allows organizing state logic in one place without the need for context providers or Redux dispatch boilerplate. Components will use the `useStore` (or a custom hook from Zustand) to access the pieces of state they need. For instance, the DatabaseSelector uses `useStore(state => state.availableDatabases)` and `useStore(state => state.selectedDatabase)` and an action to change it. The SqlEditor component can either store its text internally or be controlled by the `currentQuery` state; we'll likely have the editor component use an `onChange` to update `currentQuery` in the store, so that the latest query is always in global state (which can be useful for other components or for saving the query, etc.).

The **Zustand store** may be set up in a separate file (e.g., `useAppStore.ts`) and we might enable the Redux DevTools extension for debugging by using the Zustand middleware. This helps track state changes during development. The state is kept minimal but sufficient to coordinate between components. The use of Zustand ensures that, for example, when `queryResult` is updated after a fetch, the ResultsTable component (which uses that state) will re-render with the new data.

*Note:* The `@sqlrooms/sql-editor` library itself appears to use Zustand under the hood (via `ProjectBuilderProvider` and slices) to manage queries and schema. We have two possible approaches:
1. Use the library’s store by wrapping our app (or parts of it) in `ProjectBuilderProvider` and extending their store slices with our own. This would allow us to use components like `<SqlQueryDataSourcesPanel>` and `<SqlEditor>` which rely on that store. The example from SQLRooms shows how to combine slices ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=config.sqlEditor.queries%20%3D%20%5B%20,%5D%3B%20config.sqlEditor.selectedQueryId%20%3D%20%27default)) ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=%2F%2F%20other%20config%20options%20,createSqlEditorSlice%28%29%2C)).
2. Manage our own Zustand store completely and use mostly the low-level components (`SqlMonacoEditor` etc.) which don't require the provider.

For clarity and control, this design leans towards managing our own state and using `SqlMonacoEditor`. This means we'll manually handle feeding schema info to the editor and handling query execution results, which is what we want for a custom interface. Zustand will cleanly handle this shared state without complexity.

### SQL Editor & Autocompletion Integration

A major feature is **autocompletion and syntax highlighting** in the SQL editor. We rely on the Monaco-based editor from the SQLRooms library to provide the foundation. Monaco will handle SQL keyword highlighting out of the box. For autocompletion of database object names, we will integrate with the backend-provided schema:

- After the user selects a database, we load its tables via `/api/databases/{dbName}/tables`. We then optionally load column info for those tables (either eagerly or lazily). We will construct an array of table schema objects to pass to the editor. Each **table schema object** will include the table name and its columns (and possibly the table's schema or database name if needed in a multi-db context, though since the editor is focused on the current DB, schema qualification may not be needed except for multiple schemas inside a DB). An example structure in JavaScript could be:

  ```js
  const tableSchemas = [
    {
      name: "users",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true, nullable: false },
        { name: "name", type: "TEXT", nullable: false },
        { name: "email", type: "TEXT", nullable: true, unique: true },
        // ... other columns
      ]
    },
    {
      name: "orders",
      columns: [
        { name: "order_id", type: "UUID", primaryKey: true, nullable: false },
        { name: "user_id", type: "INTEGER", nullable: false, foreignKey: "users.id" },
        { name: "amount", type: "DECIMAL", nullable: false },
        // ... etc.
      ]
    }
    // ... more tables
  ];
  ```
  We will define a consistent **schema format** for these objects. For each column we can include properties: `name`, `type` (as a string, using the database's type or a normalized type), `nullable` (boolean), `primaryKey` (boolean), and possibly `unique` or `foreignKey` references in a human-readable form. The backend will supply this information in its API responses (see **Backend Design** below). The frontend may need to transform the API JSON into the exact shape needed by the editor component.

- We will pass this `tableSchemas` array to the `<SqlMonacoEditor>` component via its props. According to the library docs, `SqlMonacoEditor` accepts a prop `tableSchemas: DataTable[]` for autocompletion ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=SqlMonacoEditor%20Props)). Each `DataTable` presumably corresponds to one table and its columns. With this in place, the Monaco editor will suggest table names when appropriate (e.g., after typing `FROM ` it will list tables) and after a table name and a dot, it will list that table’s columns. The autocompletion will also include SQL keywords and functions by default, and the library allows adding custom keywords or functions if needed ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=SqlMonacoEditor%20Props)) (we might not need to add any for now).

- The schema info can be kept updated: if the user switches the database, the tableSchemas prop will change. If the database schema changes during the session (unlikely unless multiple users or an admin creates new tables), the user can press a "refresh schema" button which would refetch `/api/databases/{dbName}/tables` and update state; the editor’s `getLatestSchemas` callback could be used to trigger that refresh on demand.

- If using the `SqlQueryDataSourcesPanel` (optional), it might automatically use the same schema data from the store to display the tables. In our design, if we integrate it, we must ensure it knows about our data. That likely means using the `ProjectBuilderProvider` and feeding the data source information into the store slice provided by `createProjectSlice` and `createSqlEditorSlice`. For simplicity, a custom SchemaBrowser (as described) is straightforward. The autocompletion does not depend on using that panel; it just needs the schema array.

- **Monaco Editor configuration**: We will instantiate the Monaco editor in SQL mode. We can set some options like font size, theme (light/dark based on app theme), and configure the editor to have minimal distractions (line numbers, etc.). We will enable the relevant Monaco language for SQL (the library likely does this internally). If needed, we can register custom Monaco completion providers or use the one built-in via `tableSchemas`. (If we weren’t using the library, we could register our own completion provider as shown in some examples ([Building a SQL Editor for our Subsetting Feature](https://www.neosync.dev/blog/subset-sql-editor#:~:text=const%20suggestions%20%3D%20Array.from%28columnSet%29.map%28%28name%29%20%3D,insertText%3A%20name%2C%20range%3A%20range%2C)), but the library saves us that effort by taking `tableSchemas`).

- **Executing Queries**: When the user runs a query, the frontend will collect the current query text (from state or directly from the editor via `sqlEditor.getCurrentQuery()` if using their API ([@sqlrooms/sql-editor - npm](https://www.npmjs.com/package/@sqlrooms/sql-editor#:~:text=query%20text%20,Get%20current%20query%20text)) or simply from our `currentQuery` state) and send it to the backend. We will call the `/api/execute-query` endpoint with a POST request containing the query. We also need to tell the backend which database to execute against; since the UI has a selected database, we include that in the request (either in the URL, query params, or body as per API spec, see Backend section). We must also include the JWT in the Authorization header for authentication. Our state has `authToken`, so the request will have header `Authorization: Bearer <token>`.

- While the query is running, we set `isQueryRunning=true` in the state to possibly show a loading indicator (e.g., disable the Run button and maybe show a spinner in the results panel or on the button).

- On receiving the response, if successful, it will contain the results data. We update `queryResult` state with this data and `queryError` to null, and set `isQueryRunning=false`. The ResultsTable component will automatically show the new data. If the response indicates an error (HTTP error or an error field), we update state to reflect that (e.g., set `queryError` with the message and ensure `queryResult` is cleared or stale data is not shown). The editor might also visually highlight an error if we wanted (for example, Monaco could be instructed to show a red underline if the error had a position, but that's an advanced feature and not in scope for initial implementation).

- **UI/UX considerations**: The interface should make it clear which database is in use (perhaps showing the DB name in the editor header or results panel). If multiple query tabs are implemented, each tab might run on the same selected database context. If we needed to allow multiple DBs at once (not required now), we could tie a selected DB to each query tab, but that complicates the UI and is unnecessary unless explicitly needed.

- Additionally, we should handle that very long-running queries might still be running when the user triggers another action. Ideally, provide a way to cancel queries. Cancellation in SQL (for Postgres) could be done via a secondary connection to issue `pg_cancel_backend`, but that’s advanced. For now, the user can refresh or we rely on them to not run extremely long queries in a UI context. We will document that heavy queries might impact responsiveness.

### Query Results and Visualization

Once a query executes, the results need to be presented clearly:

**Tabular Results View:**

- The results will be shown in a scrollable table. We will display a header row with column names. If the backend provides column types or other metadata, we might show tooltips or allow toggling a schema view of the result (not crucial, but potentially helpful if types are important).
- We will ensure that the table layout is responsive: columns can auto-size, and horizontal scrolling is enabled if there are many columns. We might use a fixed header so the header stays visible while scrolling through rows.
- If using a library like MUI DataGrid, we get features like sorting by column (client-side) and maybe filtering. We can choose to enable those if it doesn't conflict with size (for large result sets, client-side sorting might be slow; the user should really do sorting in SQL).
- We also consider pagination: If a query returns thousands of rows, rendering them all can be slow. A simple strategy is to limit the number of rows returned by the backend (or the UI can request a limit). But since this is a SQL interface, we will by default show whatever the query returns. We might implement a safeguard such as "only first 1000 rows are shown" and let the user know if more were truncated. Implementing server-side pagination for arbitrary queries is non-trivial (since it requires modifying the query or wrapping it), so likely not in initial scope. Instead, rely on user to limit queries or handle large data carefully. In the future, we could integrate virtual scrolling to handle large datasets smoothly.

- The results panel should also display any error message if the query failed. This can be styled in a red text area. For example, "Error: syntax error at or near 'FROM'" if the query was malformed. This error text will come from the backend (we’ll pass the DB error message through). If the error includes a specific position, that could be highlighted in the editor (some SQL clients do that), but implementing that requires parsing the error message. We will simply show the error string.

- For non-select queries (UPDATE/INSERT/DELETE), the backend can return the number of affected rows. The UI will show something like "Executed successfully. Affected rows: X." possibly in the results panel or as a transient notification.

**Visualization (Charts) View:**

- When the user switches to the visualization mode for a result, the same data should be available to the chart component. We will likely transform the data into an array of objects (if not already in that form). For example, if the result columns are ["country", "total_sales"], we create an array of objects like `[ { country: "USA", total_sales: 1000 }, { country: "Canada", total_sales: 800 }, ... ]`. This format is convenient for Vega-Lite, which expects an array of JSON objects for data.

- We will recommend using **Vega-Lite** for charts due to its flexibility and React integration. Vega-Lite uses a declarative JSON specification to define charts, allowing quick iteration on visualization without imperative drawing code ([A High-Level Grammar of Interactive Graphics | Vega-Lite](https://vega.github.io/vega-lite/#:~:text=Vega,for%20data%20analysis%20and%20presentation)). We can integrate it via the `react-vega` package or `react-vega-lite` (which can take a Vega-Lite spec and render it). The visualization component could either use a fixed spec or generate one based on user input:
  - A simple implementation: If a result has exactly two columns, assume the first is an X category and second is a Y value and draw a bar chart. If more than two columns, we might not auto-render unless the user picks. For example, if a result has a time column and a value, a line chart might be appropriate.
  - Provide UI controls: For more flexibility, have dropdowns in the chart panel: one for "X axis", one for "Y axis", populated with the numeric columns or categorical columns accordingly. Then generate a Vega-Lite spec from those choices. The spec creation can be as simple as:
    ```js
    const spec = {
      data: { values: resultDataArray },
      mark: "bar",
      encoding: {
        x: { field: selectedXField, type: "nominal" },
        y: { field: selectedYField, type: "quantitative" }
      }
    };
    ```
    This spec would produce a bar chart. We can enhance it by checking data types (if X is temporal, use type "temporal" and mark could be line for a time series, etc.). Vega-Lite's default handling of axes and legends will take care of making it readable.

- We will include a library like `react-vega` to render the chart. The chart container should be allowed to resize (maybe make it fill the results panel area). Vega-Lite charts can be made responsive or we can dynamically set width/height.

- If needed, add a button to download chart as image or to open in Vega Editor (not necessary initially, but Vega-Lite specs can be exported).

- The UI should let the user easily switch back and forth between table and chart. This could be a toggle button or two tabs labeled "Data" and "Chart".

- We also need to consider that some query results may not be suitable for visualization (e.g., too many columns, or non-numeric data only). In such cases, the chart tab can show a message like "Select at least one numeric column to visualize" or simply be disabled. As an initial heuristic, we could enable the chart view if there's at least one numeric column in the result.

- **Library alternatives**: If not using Vega-Lite, alternatives include Chart.js (with a React wrapper) or Recharts. Those are simpler for basic charts but less flexible for arbitrary data shapes. Vega-Lite is recommended here due to its expressiveness, as it can handle many chart types through configuration rather than custom code.

## Backend Design

### Technology Stack and Architecture

The backend will be implemented in **Rust** using the **Axum** web framework (built on **Tokio** for async). Axum is well-suited for building APIs and provides a straightforward way to define routes, extract request data, and manage state. It also integrates easily with middleware for features like authentication. In fact, Axum “makes it a lot easier to build complex web API authentication systems” with tools like JWT middleware ([Using Rust and Axum to build a JWT authentication API - LogRocket Blog](https://blog.logrocket.com/using-rust-axum-build-jwt-authentication-api/#:~:text=Building%20a%20non,complex%20web%20API%20authentication%20systems)), which aligns with our need for JWT-based auth.

We will structure the backend as a REST API with the specified endpoints under a common path (e.g., `/api`). The key responsibilities of the backend are: authenticate requests, connect to the appropriate database, retrieve schema information (databases, tables, columns, indexes), execute SQL queries safely, and return results or errors.

**Project structure** (in Rust terms):
- We will have an `Axum` router with routes for each endpoint (`/api/databases`, `/api/databases/{dbName}/tables`, etc.).
- We will manage a global state (using Axum's state mechanism) that holds the database connection information (connection pools to the configured databases, etc.) and perhaps JWT keys if needed for validation.
- We will use a database driver library. The likely choice is **SQLx** (an async Rust SQL toolkit) because it supports multiple databases (PostgreSQL, MySQL, SQLite, etc.) under one API and uses connection pooling. We can compile SQLx with the PostgreSQL feature for now, and later enable others. SQLx also has an `Any` driver that can route to different database types at runtime ([AnyConnection in sqlx - Rust](https://docs.rs/sqlx/latest/sqlx/struct.AnyConnection.html#:~:text=A%20connection%20to%20any%20SQLx,database)), which could be useful for a unified approach. Alternatively, we might manage separate connection pools for each database type and choose at runtime (for example, keep a `PgPool` for Postgres databases, and if we add MySQL, a `MySqlPool` for those). The design will abstract this so adding a new DB type is localized.
- The backend should be structured for **extensibility**: adding a new supported SQL dialect should not require massive changes. This suggests using traits or at least separating the SQL logic by database type. For schema queries (listing tables, etc.), we might implement separate SQL for each type (since the system tables differ), but present a unified output format to the frontend.

**Database Connections:**
- We will maintain a list of database connections that the application can use. This could be configured via a config file. For example, we might have in a config:
  ```toml
  [[databases]]
  name = "main"
  type = "PostgreSQL"
  conn_string = "postgres://user:pass@host:5432/mydb"

  [[databases]]
  name = "analytics"
  type = "MySQL"
  conn_string = "mysql://user:pass@host:3306/analytics_db"
  ```
  Each entry has a friendly name (to show in UI and use as an identifier) and the connection details. On startup, the backend will iterate through this config and initialize a connection pool for each (using the appropriate SQLx connect based on type). We store these in a map, e.g., `HashMap<String, DatabasePool>` where `DatabasePool` could be an enum holding either a `PgPool`, `MySqlPool`, etc., or using SQLx `AnyPool`.
- The `/api/databases` endpoint will basically return the list of database names (and possibly their types). This list corresponds to what's configured and successfully connected. If a connection fails at startup, we may exclude it or mark it unavailable.
- **Connection Pool**: Using a pool (like `sqlx::Pool`) is important for performance and to manage concurrent queries. Each incoming query request will fetch a connection from the pool, execute the query, and then return it. SQLx pools internally manage a number of DB connections and queue requests if all are busy.

**Data Model and Format:**
- We define a **schema format** for table and column info (as mentioned in the frontend section). The backend will query the database's system catalogs or information_schema to get tables and columns.
- For PostgreSQL:
  - To list databases: we can use `SELECT datname FROM pg_database` (with some conditions to skip template DBs) or rely on config (preferred if we restrict which DBs are accessible).
  - To list tables: `SELECT table_name, table_type FROM information_schema.tables WHERE table_catalog='<db>' AND table_schema='public'` (if focusing on public schema, or remove schema filter to list all schemas' tables). But likely, we assume one schema (like public) for now or just aggregate by schema. We can decide to include schema names in our output if needed (for now, maybe not, unless the DB has multiple user schemas).
  - To get table schema (columns): `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='<table>' AND table_schema='<schema>';`. For constraints, we might need to query `information_schema.table_constraints` and related tables for primary keys, etc. For simplicity, we can identify primary key by checking `constraint_type='PRIMARY KEY'` in table_constraints and joining to key column usage to get the column. Not null can be inferred from `is_nullable='NO'`. Unique constraints could be fetched similarly. We will compile this info into our response.
  - To get indexes (optional): In Postgres, use `pg_indexes` or `pg_class` joins. But since it's optional, we can implement a simple version: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='<table>';` and parse indexdef to get columns and uniqueness. Or use `pg_constraint` for primary/unique.
- For MySQL (if added later):
  - Listing databases: `SHOW DATABASES;` (or query information_schema.schemata).
  - Listing tables: `SHOW TABLES;` (or information_schema.tables).
  - Columns: `SHOW COLUMNS FROM <table>;` or information_schema.
  - Indexes: `SHOW INDEX FROM <table>;`.
  - The format of data would be different, but we will map it to the same JSON structure.
- For SQLite (if ever needed): SQLite has a single database (the file), listing tables via `sqlite_master` table etc. We likely won't focus on that now.

The **unified structure** for schema data (JSON format sent to frontend):
- **Database list** (`GET /api/databases`): an array of objects like:
  ```json
  [
    { "name": "main", "type": "PostgreSQL" },
    { "name": "analytics", "type": "MySQL" }
  ]
  ```
  or simply `["main", "analytics"]` if type is not needed on front (type might be used to show an icon or so, but not critical).
- **Table list** (`GET /api/databases/{dbName}/tables`): returns tables in the specified database. Table name should contain schema if db has schema concept. JSON could be:
  ```json
  {
    "tables": [
      { "name": "public.users", "type": "TABLE" },
      { "name": "public.orders", "type": "TABLE" },
      { "name": "finance.sales", "type": "VIEW" },
      { "name": "finance.revenue", "type": "MVIEW" }
    ]
  }
  ```
  Here we included `type` to distinguish views, but the UI might not treat them differently except maybe an icon. If the database has multiple schemas (namespaces), we could include schema name as well (like `"schema": "public"`), or prepend schema in name. For initial design, assume a single schema of interest (like public).
- **Table schema** (`GET /api/databases/{dbname}/tables/{tablename}/schema`): returns column definitions and constraints for the given table. JSON structure example:
  ```json
  {
    "table": "users",
    "columns": [
      { "name": "id", "type": "integer", "nullable": false, "primaryKey": true },
      { "name": "name", "type": "varchar(100)", "nullable": false },
      { "name": "email", "type": "varchar(100)", "nullable": true, "unique": true },
      { "name": "created_at", "type": "timestamp", "nullable": false, "default": "CURRENT_TIMESTAMP" }
    ],
    "constraints": {
      "primaryKey": ["id"],
      "unique": ["email"],
      "foreignKeys": [
        { "column": "dept_id", "references": { "table": "departments", "column": "id" } }
      ]
    }
  }
  ```
  In this format, we redundantly mark primary keys and unique in each column and also list them in a constraints object for clarity. We can simplify if needed (for example, the frontend might not need the separate `"constraints"` block if the column entries have flags, but it can be useful for composite keys or to list foreign keys which span multiple columns). The **schema formatting** is chosen to be general: all names are lowercase, `type` is exactly as the DB reports (or a normalized string), booleans for `nullable`, etc. This ensures that regardless of the underlying DB, the front end gets a consistent format. (For instance, MySQL "varchar(100)" vs Postgres "character varying(100)" could both be reported as "varchar(100)" or we just pass the DB-specific type string. Probably passing the DB-specific type verbatim is fine for display. For usage in editor, it's not needed except as informational tooltip perhaps.)
- **Table indexes** (`GET /api/databases/{dbname}/tables/{tablename}/indexes`): If implemented, returns index info. JSON example:
  ```json
  {
    "table": "users",
    "indexes": [
      { "name": "users_pkey", "columns": ["id"], "unique": true, "primary": true },
      { "name": "users_email_key", "columns": ["email"], "unique": true, "primary": false }
    ]
  }
  ```
  This may overlap with constraints info (primary key and unique indexes). It's optional; if provided, the frontend could display indexes in the schema browser or allow the user to see index details. It’s mostly for informational purposes.

- **Execute query** (`POST /api/execute-query`): Executes a SQL query. The request will be JSON, e.g.:
  ```json
  {
    "db": "main",
    "query": "SELECT * FROM users WHERE id = 1;"
  }
  ```
  We include the `db` identifier to indicate which database connection to use (if the UI only works with one selected DB at a time, this could be derived from state; but including it makes the API stateless and explicit). We also might allow an optional `"schema"` field if the user wants to specify a specific schema within the database (for Postgres, e.g., `"schema": "sales"` to run the query with search_path set or to fully qualify names). In initial implementation, we can assume the default schema (e.g., "public") unless specified.

  The response for a successful query will contain the results. We have design options:
  - Return an object with `columns` and `rows`, as mentioned earlier. Example:
    ```json
    {
      "columns": ["id", "name", "email"],
      "rows": [
        [1, "Alice", "[email protected]"],
        [2, "Bob", "[email protected]"]
      ]
    }
    ```
    This format is efficient (no repeating keys for every row). However, for the frontend, an array of objects might be more convenient for charting. We can easily convert one to the other on either side. We might also include types for columns if needed, but since we have schema info separately, this might be redundant. If the query is a JOIN or an ad-hoc query, the front-end might not know the types. But typically not critical for display, so we skip types here.
  - Alternatively, return an array of objects:
    ```json
    [
      { "id": 1, "name": "Alice", "email": "[email protected]" },
      { "id": 2, "name": "Bob", "email": "[email protected]" }
    ]
    ```
    This is very convenient for JavaScript usage. The downside is the payload is larger for many rows. But given this is an internal tool likely, clarity might trump slight performance cost. We can choose either; let's assume **array of objects** for now, as it's easier to feed into charts and maybe into some table libraries. We will clearly document whichever we choose.
  - If the query has no result (e.g., DDL or DML without a RETURNING), we can return `{ "message": "Query executed successfully.", "affectedRows": 5 }` for an UPDATE/DELETE, etc., instead of `columns` and `rows`. The front-end will check: if `rows` is absent and `affectedRows` is present, it can display that message. We could also standardize and always return a similar shape, e.g., include `affectedRows` even for selects (would be 0 or irrelevant). But simplest is to make it part of the same JSON when applicable.
  - On error (like SQL syntax error or runtime error), we will return an error response. This could be an HTTP 400 with a body like `{ "error": "Syntax error at or near ..."` }. Or we could still return 200 with an `"error"` field. However, using HTTP error codes is more standard for something that didn't execute properly. We will likely use a 400 Bad Request for SQL errors (since the query is client-provided and invalid), or 500 if something failed on the server side. The body will contain an `"error"` message detail. The front-end will handle these by checking response.ok and reading the JSON. In either case, we need to ensure the error message from the DB is conveyed.

**Execution Logic:**
- In the handler for `/api/execute-query`, after authentication, we will look up the connection pool for the specified database. If not found, return 404 or 400.
- Then we will use sqlparser to parse the query, only allow single statement and only allow SELECT query. Regenerate the query with sqlparser and wrap it with a proper CTE like:
```sql
WITH q AS (
  {original_query}
)
SELECT JSON_AGG(q.*) data FROM query;
```
This CTE could be deserialized to:
```rust
#[derive(sqlx::FromRow)]
struct QueryResult {
  data: sqlx::types::Json<serde_json::Value>,
}
```
- Then we will use SQLx to execute the query. Because the query is dynamic (not known at compile time), we will use `sqlx::query(&query_string)` (which returns a query that can be executed) rather than compile-time macros. We have to be careful: this will allow any SQL. Since this tool is for interactive querying, that's expected. We should consider **safety**.
- We call `.fetch_all(&pool).await` and deserialize the result to `QueryResult`.
- The response JSON will be constructed and sent with content type `application/json`. We will ensure to set correct CORS headers if the frontend is served from a different origin (for development, likely we need to allow the dev server origin). We can use Axum’s CORS middleware to allow the expected origin and credentials if needed.

### API Endpoints Specification

Below is a summary of the API endpoints with their request and response formats. All endpoints are prefixed with `/api` and will be protected by JWT auth (except possibly the auth token retrieval itself).

- **POST /api/login** (if implemented for auth):
  - **Description:** Authenticate a user (with credentials) and issue a JWT. *This is optional in this design.* If we have a user system, this endpoint would accept a username/password in JSON, verify them (perhaps against a database or another service), and return a JWT token (and maybe a refresh token). For simplicity, we might stub this or assume an existing auth mechanism. If implemented:
  - **Request:** JSON `{"username": "...", "password": "..."}`.
  - **Response:** JSON `{"token": "<JWT token string>"}`.
  - This endpoint would not require an Authorization header (obviously). It would use a secret key to sign JWTs (e.g., using HMAC SHA256). The token will encode the user’s identity (and possibly roles or permitted databases) in its claims.

- **GET /api/databases**:
  - **Description:** List the available database connections the user can use. The user must be authenticated (JWT required). The backend might further filter this list based on the user's permissions (for example, a claim in JWT could specify allowed DBs).
  - **Request:** No body. Just a GET. (JWT auth header required.)
  - **Response:** JSON array of databases. As discussed, this could be an array of name/type objects. For example:
    ```json
    [
      { "name": "main", "type": "PostgreSQL" },
      { "name": "analytics", "type": "MySQL" }
    ]
    ```
    If the type is not needed on frontend, we could shorten to `["main","analytics"]`. However, including type might be helpful for display or logging. We will also eventually need the distinction to use the right driver.
    - In case of error (e.g., no databases configured or user not authorized for any), we might return an empty list or an error. Typically, if unauthorized (no token or invalid), this would be a 401 Unauthorized with an error message.
  - **Example:** A successful response might look like:
    ```json
    {
      "databases": [
        { "name": "main", "type": "PostgreSQL" },
        { "name": "testdb", "type": "PostgreSQL" }
      ]
    }
    ```
    (Wrapping in an object with a key is also fine for extensibility, but a raw array is also acceptable.)

- **GET /api/databases/{dbName}/tables**:
  - **Description:** Retrieve the list of tables (and views) in the specified database. The `db` query parameter corresponds to one of the database names returned by /api/databases. This also implies the user has selected a DB in the UI.
  - **Request:** No body; the database name is provided as a query parameter.
  - **Response:** JSON listing tables. For example:
    ```json
    {
      "database": "main",
      "tables": [
        { "name": "users", "type": "BASE TABLE" },
        { "name": "orders", "type": "BASE TABLE" },
        { "name": "user_orders_view", "type": "VIEW" }
      ]
    }
    ```
    We include `database` for clarity. Each table entry has a `name` and `type`. `type` could be values like "BASE TABLE", "VIEW", "FOREIGN TABLE" (for Postgres) etc., or simplified to "table" vs "view". The frontend schema browser might use this to differentiate icons or possibly list views separately.
  - The backend will implement this by querying the information schema or database catalog. For Postgres, likely `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public'` (plus maybe `WHERE table_type='BASE TABLE' OR table_type='VIEW'` to exclude system tables).
  - **Example:** If the user has a Postgres database "main" with two tables and one view, the response could be as above. If the `dbName` is not found or not allowed, return 404 or 403.

- **GET /api/databases/{dbName}/tables/{tableName}/schema**:
  - **Description:** Get column information and constraints for a specific table. This is typically called when the user wants details on a table or for populating autocompletion data. If the database has multiple schemas and the table name alone isn’t unique, we might need an additional param for schema name (like `&schema=public`). In our initial design, we assume a default schema context (like public for Postgres). We can extend the API to `/api/table-schema?db=x&schema=y&table=z` if needed later.
  - **Request:** No body, just the query params for db and table.
  - **Response:** JSON with detailed schema info. As defined earlier:
    ```json
    {
      "table": "<tableName>",
      "columns": [
        { "name": "<col1>", "type": "<datatype>", "nullable": <bool>, "primaryKey": <bool>, "unique": <bool>, "default": "<default expr or null>" },
        { "name": "<col2>", "type": "<datatype>", ... },
        ...
      ],
      "constraints": {
        "primaryKey": [ "<col1>", ... ],
        "foreignKeys": [
          { "column": "<colX>", "references": { "table": "<refTable>", "column": "<refCol>" } }
        ],
        "unique": [ "<colY>", ... ]
      }
    }
    ```
    The `constraints` section is optional but can be helpful. If a table has composite primary key (multiple columns), `primaryKey` array will list all part of it and each column entry will have `primaryKey:true` as well. Foreign keys could list multiple if present. If we don't want a nested structure, we could instead add a `foreignKey` field to column objects, e.g., `"foreignKey": "departments.id"` in the column where applicable. Either approach works; the nested one is more structured.
  - The backend will gather this data by joining information_schema tables:
    - Columns: information_schema.columns.
    - Primary keys: information_schema.table_constraints + key_column_usage.
    - Foreign keys: information_schema.referential_constraints + key_column_usage.
    - Unique: table_constraints where unique, etc.
    - Or use database-specific catalogs if needed for precision (like PG's pg_constraint).
  - **Example:** For table "users":
    ```json
    {
      "table": "users",
      "columns": [
        { "name": "id", "type": "serial", "nullable": false, "primaryKey": true },
        { "name": "name", "type": "varchar(100)", "nullable": false },
        { "name": "email", "type": "varchar(100)", "nullable": true, "unique": true },
        { "name": "dept_id", "type": "int4", "nullable": true, "foreignKey": true }
      ],
      "constraints": {
        "primaryKey": ["id"],
        "foreignKeys": [
          { "column": "dept_id", "references": { "table": "departments", "column": "id" } }
        ],
        "unique": ["email"]
      }
    }
    ```
    This tells us `id` is primary key, `email` has a unique constraint, and `dept_id` references departments.id. In the column list, we marked foreignKey: true for dept_id (we could even include the referenced table in the column, but it's also in the constraints).

- **GET /api/databases/{dbName}/tables/{tableName}/indexes** (optional):
  - **Description:** Provides index information for the given table. This may overlap with constraints but can include non-unique indexes which are not covered above.
  - **Request:** Similar params as table-schema.
  - **Response:** JSON such as:
    ```json
    {
      "table": "<tableName>",
      "indexes": [
        { "name": "<index1>", "columns": ["colA", "colB"], "unique": false },
        { "name": "<index2>", "columns": ["colC"], "unique": true }
      ]
    }
    ```
    We might indicate if an index is primary (or just infer by name).
  - The backend for Postgres can query `pg_indexes` or use `pg_class` joins to get index definitions. For MySQL, use `SHOW INDEX`.
  - If this is not a priority, we may implement it later. The design leaves room for it. The UI could display indexes perhaps in the table detail view.

- **POST /api/execute-query**:
  - **Description:** Execute a SQL query on the specified database and return the results or error. This is the core execution endpoint the SQL editor will call.
  - **Request:** JSON body with at least the `query` string. Including the `db` (database name/ID) is recommended for explicitness. Example:
    ```json
    { "db": "main", "query": "SELECT * FROM users LIMIT 10;" }
    ```
    If we want to allow specifying a schema (namespace) in a multi-schema DB, we could allow `"schema": "sales"` which the backend could use to set the search_path (for Postgres) or fully qualify the query (not trivial to inject, so likely better the user writes `schema.table` if needed).
  - **Response:** On success (a SELECT or other query that returns rows):
    - Status: 200 OK.
    - Body: JSON containing result data. As discussed, we will likely return an array of objects for each row (or an object with columns & rows). Let's assume array-of-objects format for clarity:
      ```json
      {
        "columns": ["id", "name", "email"],
        "rows": [
          [1, "Alice", "[email protected]"],
          [2, "Bob", "[email protected]"]
        ]
      }
      ```
      *Or*
      ```json
      {
        "result": [
          { "id": 1, "name": "Alice", "email": "[email protected]" },
          { "id": 2, "name": "Bob", "email": "[email protected]" }
        ]
      }
      ```
      Either way, the frontend will adapt. The first format keeps schema separate (which we already know from columns), the second is self-contained per row.

  - **Response (Error):** If the query failed:
    - Status: 400 (if it's a bad query or user error), or 500 if something on server side broke.
    - Body: JSON like:
      ```json
      { "error": "relation \"public.usrs\" does not exist" }
      ```
      The error message will come from the database driver (e.g., Postgres error message). We should sanitize it if necessary (but generally it's fine to show to the user since they wrote the query). We won't include too much internal info beyond what DB provides.
    - The frontend will catch non-200 and display the error message to the user.

  - **Authentication:** The user must include the JWT in the `Authorization` header. If missing or invalid, the request will be rejected (401). We'll handle auth via middleware (see next section).

  - **Example:** User writes `SELECT count(*) FROM orders;`. Frontend POSTs `{"db": "main", "query": "SELECT count(*) FROM orders;"}`. Backend executes and returns `{"result": [ { "count": 42 } ] }`. Frontend shows a table with one row, one column ("count" = 42).

### Database Abstraction for Multiple DB Support

Although initially we target PostgreSQL, the backend is designed to support multiple SQL databases (PostgreSQL, MySQL/MariaDB, etc.). To achieve this, we abstract the database operations:

- **Configuration**: As mentioned, each database in the config has a `type`. We will use that to determine how to handle schema queries and connection setup. For example, `type = "PostgreSQL"` or `"MySQL"` or `"SQLite"`.
- **Connection Management**: we manage separate pools by define an enum:
  ```rust
  enum DbPool {
      Postgres(PgPool),
      MySql(MySqlPool),
      SQLite(SqlitePool)
  }
  ```
  and store `papaya::HashMap<String, DbPool>` in state. Then, when executing a query for a given db, match on the pool type and use the corresponding SQLx query execution.
- **Schema queries differences**: We will likely write separate code paths for each DB type for endpoints like `/api/databases/{dbName}/tables` and `/api/databases/{dbname}/tables/{tablename}/schema`:
  - For Postgres, as discussed, use information_schema or pg_catalog queries.
  - For MySQL, adjust queries (MySQL's information_schema is similar but types might differ).
  - We can hide this behind a trait, e.g., define a trait `DatabaseIntrospector` with methods `list_tables(&self) -> Vec<TableInfo>` and `get_table_schema(&self, table) -> TableSchemaInfo`. Then implement that trait for each DB type. Or simpler, use if/else in the handler based on type.
  - The output (TableInfo, TableSchemaInfo) can be our internal structs that we then serialize to JSON. This ensures a unified format. For instance, `TableInfo { name, type }` and `ColumnInfo { name, type, nullable, default: Option<String>, is_primary: bool, is_unique: bool, foreign_key: Option<ForeignKeyInfo> }`.
  - By doing this, the frontend doesn't need to know which kind of database it is beyond maybe an icon; the JSON format is the same.

- **Query execution differences**: Not all SQL is identical. If a user tries to run a Postgres-specific query on a MySQL database, it will fail (but that's user error). We don't need to abstract query language, just pass it through. One thing to be cautious: some DBs require different handling for returning inserted ID (but we can ignore that; if user wants that, they can write database-specific SQL).
  - For retrieving results, `PgRow` vs `MySqlRow` have similar interfaces through the `Row` trait. So we can still write code against `sqlx::Row` trait to fetch by index and get an `Option<..>` or so. We might need some adjustments but likely okay.

- **Transactions**: Not explicitly needed in this interface. We only allow single queries.

- **Future DBs**: If adding support for, say, MS SQL or Oracle via ODBC or other crates, we'd extend similarly. But for now, focusing on PostgreSQL for the initial release is enough.

### JWT Authentication and Security

Security is critical since this interface can potentially run destructive commands. We enforce **JWT-based authentication** on all API endpoints. The design assumes that users will have to log in and obtain a JWT (JSON Web Token) which encodes their identity and possibly permissions. The backend will verify this token on each request.

**JWT Implementation:**

- We will use a crate like `jsonwebtoken` to decode and verify tokens. We have a secret key (HMAC) or a key pair for signing (if using RSA). For simplicity, an HMAC secret (like a 256-bit random string) can be configured on the server. Tokens will be signed with HS256 algorithm by default. The token might contain claims like `sub` (subject/username), `exp` (expiration time), and maybe a claim for allowed database names if we want to restrict access (e.g., `dbs: ["main","analytics"]`). If not, all listed DBs are accessible to any logged-in user.
- On each request, we expect an HTTP header: `Authorization: Bearer <token>`. We will implement an Axum extractor or middleware that does something like:
  - Check for the Authorization header.
  - If missing or not starting with Bearer, return 401.
  - If present, parse the token after "Bearer ".
  - Use `jsonwebtoken::decode` with the secret to validate signature and parse claims.
  - If invalid (signature mismatch, expired, etc.), return 401.
  - If valid, allow request to proceed, and perhaps attach the decoded claims to the request extensions for use in handlers (for example, to know the user ID or allowed DBs).

Axum provides a couple ways to do this:
  - Using a middleware layer: e.g., `tower_http::auth::RequireAuthorizationLayer::bearer("secret")` can check a static token but not JWT. Instead, we write a custom middleware via `axum::middleware::from_fn` that performs the steps above.
  - Alternatively, we can create an extractor struct `AuthUser` that in its `from_request` does the check and if Ok, yields `AuthUser` containing user info. Then our handlers can have signature like `async fn list_tables(AuthUser(user): AuthUser, State(app_state): State<AppState>, Query(params): Query<Params>)`. This might be clean, as the logic is encapsulated in `AuthUser::from_request`.

We should implement a middleware for protected routes, as illustrated in many examples ([Using Rust and Axum to build a JWT authentication API - LogRocket Blog](https://blog.logrocket.com/using-rust-axum-build-jwt-authentication-api/#:~:text=Middleware%20for%20protected%20routes)) ([Using Rust and Axum to build a JWT authentication API - LogRocket Blog](https://blog.logrocket.com/using-rust-axum-build-jwt-authentication-api/#:~:text=.route%28)). All routes under `/api` except `/api/login` will use this middleware. In Axum, we can do:
```rust
let api_routes = Router::new()
    .route("/databases", get(list_databases))
    .route("/tables", get(list_tables))
    ... // other routes
    .route("/execute-query", post(execute_query))
    .layer(middleware::from_fn(authenticate_jwt));
```
Where `authenticate_jwt` is our function that performs the steps to validate the token. This function will return either `Ok(request)` (to continue) or an `Err(Rejection)` if unauthorized. We can define a custom rejection that yields a 401 response with a JSON error.

**JWT Storage and Refresh:**
- The client will receive the JWT after login (the login could be a separate page or modal in the UI). We should store it in memory (Zustand state) and possibly in `localStorage` so that it persists and can be reused until expiry.
- We should secure the token; if the UI is served on the same domain, we could use httpOnly cookies to store it to avoid JS access, but since this is likely a standalone API and UI, a stateless JWT in localStorage might be acceptable. XSS would be a risk, but assuming this is an internal tool used by trusted users, localStorage is fine.
- Token expiry: We will decide a token validity (e.g., 1 hour or 8 hours). If expired, the server returns 401. The frontend can catch that and redirect the user to login again or attempt a refresh if refresh tokens are implemented. To keep it simple, we might not implement refresh tokens in this design; user re-logs in when expired.
- The login process (if included) might be beyond the scope, but mention it for completeness.

**Role-Based Access (Optional):**
- If needed, JWT could carry roles or accessible resources. For example, an "admin" user might have access to a production database, whereas a "readonly" user only to a staging one. In `availableDatabases` endpoint, we could filter the list based on JWT claims. This is an extension to consider depending on use case.
- The backend can decode JWT and if we included e.g. a `databases` claim (array of allowed names), filter the config list to only those.

**Other Security Measures:**
- **CORS:** We will enable CORS to allow the React frontend (which might be served from a different origin in dev) to call the API. We'll restrict it to the known origin (e.g., `http://localhost:3000` in dev, and the production domain in prod). Axum has `tower_http::cors::CorsLayer` to configure allowed origin, methods, and headers (we must allow Authorization header).
- **SQL Injection:** Normally, SQL injection is a concern when building queries with user input. Here, the user input *is* the entire query. And we use sqlparser to sanitize the query to only allow single query so it's safe.
- **Database Credentials Security:** The backend holds credentials to the databases (in config). Those are kept server-side and not exposed. The user authenticates with JWT to our service, not directly to the database. This way we can also audit or log queries if needed.
- **Logging and Monitoring:** It’s wise to log queries executed (with timestamp, user, database) for auditing. We can implement simple logging in the execute handler (but be careful about not logging sensitive data in queries). For now, note this as a consideration.
- **Error handling:** We ensure that unexpected errors (like inability to connect to DB, or our code panics) are caught and returned as 500 with a generic message, rather than crashing. Axum can use `std::error::Error` for rejections, or we handle Result in each handler and respond accordingly.

### Error Handling Strategy

We will implement consistent error handling in both backend and frontend:

**Backend Errors:**
- As described, authentication failures return 401 Unauthorized with a body `{"error": "Unauthorized"}` or `{"error": "Invalid token"}`. We ensure not to leak internal details (like if token is expired vs invalid; though could say "Token expired" as a hint).
- For validation errors on endpoints (e.g., missing required query param), return 400 Bad Request: `{"error": "Missing parameter 'db'"}`.
- For database operations:
  - If the `db` name given does not exist in our config, return 404 Not Found: `{"error": "Unknown database identifier"}`.
  - If a table name in /table-schema is not found, 404: `{"error": "Table not found"}`.
  - If a query execution fails, as mentioned, 400 with the DB error. Possibly differentiate error codes: some DB errors (like syntax or constraint violation) we treat as 400 (client mistake), but if the database connection itself is down or times out, that's a 500 (server issue). We can inspect error kinds from SQLx. For simplicity, any SQLx error in executing the user's query will be reported back as an error message. We do ensure the API responds even if DB is not responding (maybe with a timeout error after some seconds).
  - Use Axum's error handling to map errors to JSON responses. We might create our own error enum for our app and implement `IntoResponse` to convert to an Axum response with appropriate status and JSON body.
- We also plan to handle panics or unexpected issues gracefully. In Rust, if something panics, by default the server might crash; we can use `std::panic::catch_unwind` in threads or ensure our handlers return Results.

**Frontend Errors:**
- The front-end will use try/catch (or rather `.catch` on promises) for the fetch calls to the API. If the response has `ok=false` or if JSON has an `"error"` field, we will surface that to the user. Likely, we will set the `queryError` state to the error message and display it in the results panel or as a notification.
- If the error is authentication-related (e.g., a 401), we should recognize that and perhaps trigger a logout or re-login. For example, if any API returns 401, we can intercept (maybe in a central fetch wrapper) and redirect to a login page/component. Our application could have a simple login form that calls `/api/login` and stores the token.
- Network errors (can't reach server): show a message like "Unable to connect to server." Possibly prompt the user to check their network or if the service is down.
- UI validation: prevent or warn if user tries to run an empty query. Also, if the user selects a database and it fails to load tables, show an error.
- We will ensure the UI does not crash on any API error; every call should be handled with a user-friendly message.

**JWT Expiry handling:** On the client, if we have the token expiry encoded (JWT typically has `exp` claim), we could proactively log out the user when exp is reached (set a timer). But that's not always reliable. The usual approach: when a 401 happens, assume token expired or invalid and clear it and prompt login again.

**Development vs Production considerations:** In dev mode, we might disable JWT for ease (or have a quick dummy token). But given the design, we'll keep it on to test the full flow.

### Chart/Visualization Library Recommendation

For the visualization needs, we recommend using **Vega-Lite** through a React integration (such as the `react-vega` library). Vega-Lite provides a declarative way to describe charts, which aligns well with our dynamic data scenario. By using Vega-Lite, we can support many types of plots (bar, line, scatter, pie, etc.) without having to manually draw or calculate scales – the library handles it based on the data.

**Why Vega-Lite?** Vega-Lite is a high-level grammar of interactive graphics that uses JSON specs to represent charts. It can produce a wide range of visualizations for data analysis and presentation ([A High-Level Grammar of Interactive Graphics | Vega-Lite](https://vega.github.io/vega-lite/#:~:text=Vega,for%20data%20analysis%20and%20presentation)). This means our frontend can generate a spec (basically a JSON config) from user input or defaults, and Vega-Lite will handle rendering. It also supports interactions (like tooltips, selections) if we choose to enable them, and can even do aggregations or filtering internally if needed for summary charts.

**React integration:** The `react-vega` package (or `react-vega-lite`) allows us to pass a Vega/Vega-Lite spec and data as props to a `<Vega>` component. Under the hood it uses the Vega javascript runtime to draw the chart on an HTML5 canvas or SVG. Since our use-case is relatively straightforward (no streaming data, just static query results), Vega-Lite is a great fit. The library is fairly mature and used in many projects.

Alternatively, if Vega-Lite was not available, we could consider:
- **Recharts**: a React library that provides premade chart components (e.g., `<BarChart>`, `<LineChart>` etc.). It is easy for typical cases, but less flexible if we want to quickly change chart types based on data shape.
- **Chart.js** with react wrapper (react-chartjs-2): good for standard charts, but again, each chart type has to be coded/configured separately in JS rather than a unified JSON approach.
- **D3.js**: powerful but too low-level for our needs, and would require manual DOM manipulation or using a library built on D3.
Given these, Vega-Lite's approach of simply specifying encodings is preferable.

We will proceed with Vega-Lite and possibly cite an example spec. E.g., if a user wants to visualize sales by country:
```js
const spec = {
  data: { values: resultData }, // resultData is array of objects
  mark: "bar",
  encoding: {
    x: { field: "country", type: "nominal", axis: { title: "Country" } },
    y: { field: "total_sales", type: "quantitative", axis: { title: "Total Sales" } },
    tooltip: [ { field: "country", type: "nominal" }, { field: "total_sales", type: "quantitative" } ]
  }
};
```
Then `<VegaLite spec={spec} />` (using react-vega). This would create a bar chart. We can programmatically change `mark` to "line" if needed, or the fields based on user selection.

**Additional Visualization notes:**
- We should ensure the data passed to Vega-Lite is not too large, as very large datasets could slow down the rendering. If a query returns tens of thousands of rows, plotting all might be slow. The user should ideally aggregate in SQL or we might limit chart to some sample or require them to aggregate first.
- Vega-Lite is capable of aggregation itself (with `aggregate` and `groupby` in spec), but using that might overlap with what the database can do. Typically, it’s best to let the DB do heavy aggregation (since the user can write that query).
- The interface could, in future, allow user to write a query and then do some quick chart without rewriting the query by using Vega-Lite's aggregate. For instance, user selects a table, the tool could automatically count rows per category and plot, etc. But that’s beyond initial scope.

**Library Integration Effort:** We'll add `react-vega` via npm. The component `<VegaLite>` can be used to render a spec. We will prepare some helper code to generate simple specs for given data and user choice of chart type. This modular approach means adding a new chart type is as easy as writing a new spec template.

## Conclusion

In summary, this design provides a comprehensive blueprint for building a React + Rust/Axum SQL query interface. The frontend is organized into clear components (database selector, schema browser, editor, results/visualization) and leverages powerful libraries (Monaco-based SQL editor with autocompletion, Zustand for state, Vega-Lite for charts). The backend defines clean RESTful endpoints for all required data and operations, ensures security via JWT auth, and abstracts database specifics behind a unified interface. The JSON data formats for schema and results are consistent and implementation-ready, facilitating smooth communication between frontend and backend.

Both frontend and backend engineers can follow this document to implement their respective parts:
- Frontend developers should set up the React app with the outlined components, integrate the `@sqlrooms/sql-editor` and `react-vega` libraries, and manage state with Zustand as specified.
- Backend developers should implement the Axum routes and handlers, using SQLx or equivalent for database interaction, and handle authentication and errors as described.

By adhering to this design, the end result will be a robust, user-friendly SQL playground where users can explore and query their databases with ease and confidence.
