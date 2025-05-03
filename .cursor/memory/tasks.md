# Task List: SQL Query Interface

## Phase: Implementation

### Backend Setup & Core API (Rust/Axum)

-   [x] **Task B.1:** Set up Rust project structure (`Cargo.toml`, `src/main.rs`).
-   [x] **Task B.2:** Add initial dependencies (Axum, Tokio, SQLx, Serde, `jsonwebtoken`, `sqlparser`, config reader).
-   [x] **Task B.3:** Implement basic Axum server startup and configuration loading (e.g., database connection strings).
-   [x] **Task B.4:** Implement database connection pooling (e.g., `papaya::HashMap<String, DbPool>` in Axum state).
-   [x] **Task B.5:** Implement JWT authentication middleware.
-   [x] **Task B.6:** Implement `/api/databases` endpoint.
-   [x] **Task B.7:** Implement `/api/databases/{db_name}/tables` endpoint (PostgreSQL initially).
-   [x] **Task B.8:** Implement `/api/databases/{db_name}/tables/{table_name}/schema` endpoint (PostgreSQL initially).
    -   [x] Fetch basic column info (name, type, nullable)
    -   [x] Fetch constraint info (PK, Unique, FK)
-   [x] **Task B.9:** Implement `/api/execute-query` endpoint (PostgreSQL initially), including query parsing/sanitization (`sqlparser`) and execution using `sqlx`.
-   [x] **Task B.10:** Implement backend error handling and consistent JSON responses.
-   [x] **Task B.11:** Configure CORS middleware.

### Frontend Setup & UI (React)

-   [x] **Task F.1:** Set up React project structure (using Vite) with TypeScript.
    -   [x] Install Tailwind CSS
    -   [x] Install shadcn/ui
-   [x] **Task F.2:** Add initial dependencies (React, Zustand, `@sqlrooms/sql-editor`, `react-vega`).
-   [x] **Task F.3:** Implement Zustand store structure (`useAppStore.ts`).
-   [x] **Task F.4:** Implement basic application layout (multi-panel structure).
-   [x] **Task F.5:** Implement `DatabaseSelector` component (fetch/display databases from `/api/databases`).
-   [x] **Task F.6:** Implement `SchemaBrowser` component (fetch/display tables from `/api/databases/{dbName}/tables`).
-   [x] **Task F.7:** Implement `SqlEditor` component wrapper around `<SqlMonacoEditor>`.
    -   [x] **Subtask F.7.1:** Integrate editor with `currentQuery` state.
    -   [x] **Subtask F.7.2:** Fetch schema details (`/api/.../schema`) and pass to editor's `tableSchemas` prop for autocompletion.
    -   [x] **Subtask F.7.3:** Implement "Execute" button logic (call `/api/execute-query`).
-   [x] **Task F.8:** Implement `ResultsTable` component for displaying query results.
-   [ ] **Task F.9:** Implement `Visualization/Chart` component using `react-vega`.
-   [x] **Task F.10:** Implement toggle between Table and Chart views in results panel.
-   [x] **Task F.11:** Implement frontend handling for API calls (including auth headers) and error display.
-   [ ] **Task F.12:** Implement basic authentication flow (e.g., storing/using JWT from state, handling 401).

### Integration & Testing

-   [x] **Task T.1:** Write basic unit/integration tests for backend API endpoints.
    -   [x] **Subtask T.1.1:** Implement tests for `/api/databases` endpoint.
    -   [x] **Subtask T.1.2:** Implement tests for `/api/databases/{db_name}/tables` endpoint.
    -   [x] **Subtask T.1.3:** Implement tests for `/api/databases/{db_name}/tables/{table_name}/schema` endpoint.
    -   [x] **Subtask T.1.4:** Implement tests for `/api/execute-query` endpoint.
-   [ ] **Task T.2:** Write basic unit/component tests for frontend components.
-   [ ] **Task T.3:** Perform end-to-end testing of the core query workflow (select DB -> browse schema -> write query -> execute -> view results).
-   [ ] **Task T.4:** Test responsiveness and basic usability.

## Future Considerations (Post-MVP)

-   [ ] Support for additional database types (e.g., MySQL).
-   [ ] Implement optional `/api/.../indexes` endpoint and UI display.
-   [ ] Implement optional `/api/login` endpoint.
-   [ ] Advanced editor features (multiple tabs, formatting).
-   [ ] Advanced result table features (client-side sort/filter, pagination/virtualization).
-   [ ] More sophisticated chart generation/configuration options.
-   [ ] Query cancellation mechanism.
-   [ ] Query history feature.
-   [ ] Export results (CSV).

## UI Enhancement Plan

> **Note**: Detailed UI specifications are available in `.cursor/memory/UI_ENHANCEMENT_SPEC.md`, component architecture in `.cursor/memory/COMPONENT_ARCHITECTURE.md`, and UI mockups in `.cursor/memory/UI_MOCKUP.md`.

### Phase 1: Core Layout & Structure (High Priority)

-   [x] **Task U.1:** Implement three-column layout system.
    -   [x] **Subtask U.1.1:** Create `ThreeColumnLayout` component replacing current layout.
    -   [x] **Subtask U.1.2:** Implement improved resize handles with minimum width constraints.
    -   [x] **Subtask U.1.3:** Add column collapse/expand functionality with memory.

### Phase 2: Enhanced Schema Browser (High Priority)

-   [ ] **Task U.2:** Implement enhanced catalog browser.
    -   [x] **Subtask U.2.1:** Create `SearchFilterBar` component with debounced filtering.
    -   [x] **Subtask U.2.2:** Add `RefreshButton` with loading state for schema reload.
    -   [ ] **Task U.2.3:** Implement `DatabaseTree` component with virtualized rendering for performance.
        -   [x] **Subtask U.2.3.1:** Create basic `CatalogBrowser` and custom `DatabaseTree` structure.
        -   [ ] **Subtask U.2.3.2:** Integrate a tree library (e.g., react-complex-tree) or build custom virtualized tree. (Skipped for now)
    -   [x] **Subtask U.2.4:** Create `FieldDetailPopup` component with comprehensive field metadata.
    -   [x] **Subtask U.2.5:** Add visual indicators for primary/foreign keys in the tree view.

### Phase 3: Editor and Results Improvements (High Priority)

-   [x] **Task U.3:** Enhance SQL Editor and Results panel.
    -   [x] **Subtask U.3.1:** Create `EditorHeader` component showing current database and controls.
    -   [x] **Subtask U.3.2:** Complete schema-aware completion in Monaco editor.
    -   [x] **Subtask U.3.3:** Implement `ResultsTable` with sorting, filtering and pagination.
    -   [x] **Subtask U.3.4:** Add export options (CSV/JSON) to results panel.
    -   [x] **Subtask U.3.5:** Implement query statistics display (row count, execution time).

### Phase 4: Toolbox Sidebar (Medium Priority)

-   [x] **Task U.4:** Implement toolbox sidebar.
    -   [x] **Subtask U.4.1:** Create `ToolboxSidebar` container component.
    -   [x] **Subtask U.4.2:** Implement `ActionIcons` with tooltips (save, history, settings).
    -   [x] **Subtask U.4.3:** Add `SaveQueryDialog` for naming and storing queries.
    -   [x] **Subtask U.4.4:** Create `QueryHistoryPanel` as a slide-out panel.

### Phase 5: Visualization Features (Medium Priority)

-   [~] **Task U.5:** Implement visualization capabilities using Recharts (Basic charts implemented).
    -   [x] **Subtask U.5.1:** Create `ChartTypeSelector` for choosing visualization types.
    -   [x] **Subtask U.5.2:** Implement `RechartsRenderer` (bar, line, area, pie, scatter) using selected chart type and configuration.
    -   [x] **Subtask U.5.3:** Add `ChartConfigPanel` for customizing visualization options (X/Y axes, aggregation, pie config).
    -   [x] **Subtask U.5.4:** Create data transformation utilities for chart-friendly formats (Aggregation implemented).

### Phase 6: Advanced Features (Lower Priority)

-   [x] **Task U.6:** Implement advanced features.
    -   [x] **Subtask U.6.1:** Add drag-and-drop from schema tree to editor.
    -   [ ] **Subtask U.6.2:** Implement keyboard shortcuts system.
    -   [ ] **Subtask U.6.3:** Create dark/light theme toggle with theme detection. (Skipped due to issues)
    -   [x] **Subtask U.6.4:** Add query formatting capability.
    -   [x] **Subtask U.6.5:** Implement query tabs for multiple concurrent queries.

### Phase 7: Responsive & Mobile (Lower Priority)

-   [ ] **Task U.7:** Enhance responsive behavior.
    -   [ ] **Subtask U.7.1:** Implement mobile view with collapsing panels.
    -   [ ] **Subtask U.7.2:** Create touch-friendly controls for mobile.
    -   [ ] **Subtask U.7.3:** Add responsive breakpoints for different device sizes.
    -   [ ] **Subtask U.7.4:** Implement alternative navigation for small screens.

### Phase 8: Polish & Optimization (Final Phase)

-   [ ] **Task U.8:** Implement final polish and optimization.
    -   [ ] **Subtask U.8.1:** Add subtle loading states and transitions.
    -   [ ] **Subtask U.8.2:** Optimize component rendering with React.memo where appropriate.
    -   [ ] **Subtask U.8.3:** Implement error boundary components for resilience.
    -   [ ] **Subtask U.8.4:** Add comprehensive accessibility attributes (ARIA).
    -   [ ] **Subtask U.8.5:** Perform final performance audit and optimization.

# Feature Planning Document: AI SQL Generation

## Requirements Analysis
- **Core Requirements:**
  - [ ] Frontend: Implement a keyboard shortcut (CMD/CTRL+K) to trigger the AI query generation feature.
  - [ ] Frontend: Add a UI element (e.g., button near Execute) to trigger the feature.
  - [ ] Frontend: Display a non-intrusive modal/popup for the user to input a natural language prompt.
  - [ ] Frontend: Modal should include a text area for the prompt and a "Generate SQL" button.
  - [ ] Frontend: On "Generate SQL" click, send the prompt and the currently selected database name to a new backend endpoint (`/api/gen-query`).
  - [ ] Frontend: Show loading state while waiting for the backend response.
  - [ ] Frontend: On receiving the generated SQL, replace the content in the active SQL editor tab.
  - [ ] Frontend: Display errors from the backend if generation fails.
  - [ ] Frontend: Close the modal upon successful generation or explicit user action.
  - [ ] Backend: Create a new POST endpoint `/api/gen-query`.
  - [ ] Backend: Endpoint accepts JSON body: `{ "db_name": "string", "prompt": "string" }`.
  - [ ] Backend: Endpoint requires authentication (use existing JWT middleware).
  - [ ] Backend: Retrieve the full schema for the specified `db_name` (using existing schema fetching/caching logic).
  - [ ] Backend: Format the schema into a suitable string representation for an LLM prompt.
  - [ ] Backend: Construct a prompt for OpenAI's GPT-4o model, including the schema representation and the user's natural language prompt. Use a clear prompt template.
  - [ ] Backend: Call the OpenAI API (Chat Completions) using the configured API key and model (GPT-4o).
  - [ ] Backend: Extract the generated SQL query string from the OpenAI response.
  - [ ] Backend: Return the generated SQL query in a JSON response: `{ "query": "string" }`.
  - [ ] Backend: Handle potential errors during schema fetching, OpenAI API calls, and response parsing. Return appropriate error responses.
  - [ ] Configuration: Add `OPENAI_API_KEY` to the application configuration (`config.toml` or environment variables).
- **Technical Constraints:**
  - [ ] OpenAI API usage has associated costs.
  - [ ] OpenAI API has rate limits.
  - [ ] Potential for large schema sizes exceeding OpenAI context window limits.
  - [ ] Generated SQL is not guaranteed to be correct or optimal; user must review.

## Component Analysis
- **Affected Components:**
  - **Frontend:**
    - `App.tsx`: Add global keyboard shortcut listener, render new modal component.
    - `EditorHeader.tsx`: Add new trigger button (e.g., Wand icon).
    - `SqlEditor.tsx`: No direct changes, but its content will be updated via state.
    - `useAppStore.ts`: Add state for modal visibility, loading status, error message, user prompt. Add actions for opening/closing modal, setting prompt, calling the new backend endpoint, and updating the active tab's query.
    - *New Component*: `GenerateQueryModal.tsx`: Contains the dialog UI, text area, button, loading/error display.
  - **Backend:**
    - `src/main.rs`: Add route for `/api/gen-query`.
    - `src/handlers/mod.rs`: Add new handler function `gen_query`.
    - `src/state.rs`: Add `rig::providers::openai::Client` to `AppState`. Modify `AppState::new` for initialization (using `Client::from_env()`).
    - `src/config.rs` (`AppConfig` struct): `openai_api_key` field might be less critical if using `Client::from_env()`, but keep for potential explicit initialization.
    - `config.toml` (or `.env`): `OPENAI_API_KEY` environment variable required by `rig-core`.
    - *New Module*: `src/ai/mod.rs` and `src/ai/rig.rs`: Contains schema formatting logic and API call function (`generate_sql_query`) using `rig-core`.
    - `Cargo.toml`: Ensure `rig-core` dependency is present.
    - `src/error.rs`: Potentially add new `AppError` variants for AI-related errors (e.g., `RigError`).

## Design Decisions
- **Architecture:**
  - [x] Use the `rig-core` crate for interacting with the OpenAI API.
  - [x] Store OpenAI API key securely via configuration, not hardcoded.
  - [x] Initialize OpenAI client once and store in `AppState` for reuse.
  - [x] Reuse existing schema fetching/caching logic (`get_full_schema`) in the new backend handler.
  - [x] Format schema as Markdown for the OpenAI prompt (provides structure, relatively token-efficient).
  - [x] Use GPT-4o model (currently recommended for balance of capability and cost).
  - [x] Implement basic error handling for OpenAI API calls (e.g., network issues, API errors).
- **UI/UX:**
  - [x] Use a non-modal `Dialog` from shadcn/ui for the input prompt to be less intrusive.
  - [x] Provide clear loading indication within the dialog.
  - [x] Automatically close the dialog on successful query generation.
  - [x] Ensure keyboard focus is managed correctly when opening/closing the dialog.
- **Algorithms:**
  - [ ] N/A (No complex custom algorithms needed for this feature).

## Implementation Strategy
1.  **Phase 1: Backend Setup & OpenAI Integration**
    -   [x] Ensure `rig-core` dependency is in `Cargo.toml`.
    -   [x] Ensure `OPENAI_API_KEY` environment variable is documented/settable.
    -   [x] Implement `src/ai/rig.rs` module with `generate_sql_query` function using `rig-core` client, agent, and prompt methods (including schema formatting and prompt templating).
    -   [x] Update `AppState` in `src/state.rs` to include and initialize the `rig::providers::openai::Client` (likely using `Client::from_env()`).
    -   [x] Implement the `gen_query` handler in `src/handlers/mod.rs`, calling the function from `src/ai/rig.rs`.
    -   [x] Add the `/api/gen-query` route in `src/main.rs`.
    -   [x] Write initial backend tests (mocking `rig-core` interactions if possible, or focusing on handler logic).
2.  **Phase 2: Frontend UI & Integration**
    -   [x] Create the `GenerateQueryModal.tsx` component using shadcn `Dialog`, `Textarea`, `Button`.
    -   [x] Update `useAppStore.ts` with new state and actions (`isGenerateQueryModalOpen`, `generateQueryLoading`, `generateQueryError`, `generateQueryPrompt`, `openGenerateQueryModal`, `closeGenerateQueryModal`, `setGenerateQueryPrompt`, `generateQuery`).
    -   [x] Implement the `generateQuery` action to call the backend endpoint and handle responses/errors, updating the active tab's query on success.
    -   [x] Add the trigger button to `EditorHeader.tsx`.
    -   [x] Add the global keyboard shortcut listener (e.g., in `App.tsx`).
    -   [x] Render the `GenerateQueryModal` component in `App.tsx`.
    -   [ ] Test the end-to-end flow.

## Testing Strategy
- **Unit Tests:**
  - [ ] Backend: Test schema formatting logic in `src/ai/rig.rs`.
  - [ ] Backend: Test prompt template construction.
  - [ ] Backend: Test `gen_query` handler logic with mocked `rig-core` interactions (success and error cases).
  - [ ] Frontend: Test Zustand store actions related to the feature (`generateQuery`, modal state updates).
  - [ ] Frontend: Test `GenerateQueryModal` component rendering and interactions (e.g., button disabled states).
- **Integration Tests:**
  - [ ] Backend: Test the `/api/gen-query` endpoint directly (requires mocking `rig-core` interactions if possible, or using a test key with caution).
  - [ ] Frontend: Test the flow from triggering the modal -> entering prompt -> clicking generate -> seeing editor update or error message.

## Documentation Plan
- [ ] Add details about the `OPENAI_API_KEY` **environment variable** requirement to `README.md` or deployment guides.
- [ ] Briefly document the `/api/gen-query` endpoint (request/response format) in API documentation (if any).
- [ ] Add comments in `src/ai/rig.rs` explaining the prompt structure.
