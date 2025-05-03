import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { ChartType } from '@/components/viz/ChartTypeSelector'; // Import ChartType
import { v4 as uuidv4 } from 'uuid'; // For generating unique tab IDs
// Import the backend schema types (assuming they are exported from handlers or a models file)
// If they live elsewhere, adjust the import path
// We might need to create corresponding TS interfaces if direct import isn't feasible
// import type { FullSchema, DatabaseSchema, TableSchema, ColumnInfo } from '../../src/handlers/mod'; // Adjust path if needed -- REMOVED

// --- SCHEMA Interfaces (Matching Rust Structs) ---
export interface ColumnInfo { // Assuming this matches backend TableSchema column
  name: string;
  data_type: string; // Keep simple string type name from backend
  is_nullable: boolean;
  is_pk?: boolean;
  is_unique?: boolean;
  fk_table?: string | null;
  fk_column?: string | null;
}

export interface TableSchema { // Assuming this matches backend DatabaseSchema tables element
  table_name: string;
  columns: ColumnInfo[];
  // Add constraints if available from backend
}

export interface DatabaseSchema { // Assuming this matches backend FullSchema databases element
  name: string;
  db_type: string;
  tables: TableSchema[];
}

export interface FullSchema { // Assuming this matches the root object from /api/schema
  databases: DatabaseSchema[];
}
// --- END SCHEMA Interfaces ---

// Read API base URL from env, default if not set
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3111';

// --- Derived/Legacy Interfaces ---
// Still used by some components, populated from FullSchema
export interface DatabaseEntry {
  name: string;
  db_type: string;
}

export interface TableEntry {
  name: string;
  // table_type: string; // Maybe not needed if we just list names
}
// --- END Derived/Legacy Interfaces ---

// Re-export backend types if needed, or map them in the store
// export type { FullSchema, DatabaseSchema, TableSchema, ColumnInfo }; -- REMOVED

// --- Query Result / Tab Interfaces remain the same ---
export interface QueryResultData {
  // columns?: string[]; // Column names (if using array of arrays) - Keep commented
  // rows?: any[][]; // Array of arrays - Keep commented
  result?: Record<string, unknown>[] | null; // Use unknown
  message?: string; // For non-SELECT queries or errors
  affectedRows?: number;
  executionTime?: number; // In seconds
  plan?: unknown; // Use unknown
}

// --- NEW: Query Tab State Interface ---
export interface QueryTab {
  id: string; // Unique identifier for the tab
  name: string; // Display name (e.g., "Query 1", or user-defined)
  query: string;
  result: QueryResultData | null;
  error: string | null;
  isRunning: boolean;
  // Potentially add tab-specific history or settings later
}

// Keep the original AppState interface and export it
export interface AppState {
  // Auth
  authToken: string | null;
  setAuthToken: (token: string | null) => void;

  // --- REFACTORED: Schema State ---
  fullSchemaData: FullSchema | null;
  isFetchingFullSchema: boolean;
  fullSchemaError: string | null;
  fetchFullSchema: () => Promise<void>;

  // Derived/Selected State (Populated from fullSchemaData)
  availableDatabases: DatabaseEntry[]; // Still useful for DatabaseSelector
  selectedDatabase: string | null;
  tables: TableEntry[]; // Tables for the *selected* database
  tableSchemas: Record<string, TableSchema>; // Schemas for the *selected* database tables
  setSelectedDatabase: (dbName: string | null) => void;
  // --- END REFACTOR ---

  // Query
  currentQuery: string;
  setCurrentQuery: (query: string) => void;
  queryResult: QueryResultData | null;
  queryError: string | null;
  isQueryRunning: boolean;
  executeQuery: () => Promise<void>;
  queryHistory: string[];
  addQueryToHistory: (query: string) => void;
  queryLimit: number;
  setQueryLimit: (limit: number) => void;

  // UI State
  showVisualization: boolean;
  setShowVisualization: (show: boolean) => void;
  selectedChartType: ChartType | null; // Add state for selected chart type
  setSelectedChartType: (type: ChartType | null) => void; // Action to set type

  // --- NEW: Chart Configuration State ---
  chartConfig: {
    xAxis: string | null;
    yAxis: string | null; // Keep for single-select reference? Or remove?
    yAxes: string[]; // Support multiple Y-axes
    aggregation: string | null; // e.g., 'sum', 'average', 'count', 'none'
    groupBy: string | null; // Typically the xAxis when aggregating
    labelKey: string | null; // For Pie chart labels
    valueKey: string | null; // For Pie chart values
    // Add more config options later (e.g., color, multiple Y axes)
  };
  setChartConfig: (config: Partial<AppState['chartConfig']>) => void;
  // --- END: Chart Configuration State ---

  // --- NEW: Layout State ---
  layoutSizes: Record<string, number[]>; // e.g., { horizontal: [15, 25, 60], catalogVertical: [25, 75], editorVertical: [60, 40] }
  setLayoutSizes: (groupId: string, sizes: number[]) => void;
  collapsedPanels: Record<string, boolean>; // e.g., { toolbox: false, catalog: false }
  togglePanelCollapse: (panelId: string) => void;

  // --- REFACTORED: Query Tabs State ---
  tabs: QueryTab[];
  activeTabId: string | null;
  addTab: (makeActive?: boolean) => string; // Returns new tab ID
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateQueryInTab: (tabId: string, query: string) => void;
  updateTabName: (tabId: string, name: string) => void; // Action to rename tab
  executeQueryForTab: (tabId: string, limit: number) => Promise<void>;
  // --- END REFACTOR ---

  // --- NEW: AI Query Generation State ---
  isGenerateQueryModalOpen: boolean;
  generateQueryLoading: boolean;
  generateQueryError: string | null;
  generateQueryPrompt: string;

  // Actions for AI Query Generation
  openGenerateQueryModal: () => void;
  closeGenerateQueryModal: () => void;
  setGenerateQueryPrompt: (prompt: string) => void;
  generateQuery: () => Promise<void>; // Action to trigger backend call
  // --- END: AI Query Generation State ---

  // Add init to interface
  init: () => void;
}

// Helper function to create a new default tab
const createNewTab = (): QueryTab => {
  const newId = uuidv4();
  return {
    id: newId,
    name: `Query ${new Date().toLocaleTimeString()}`, // Default name
    query: 'SELECT * FROM ...;',
    result: null,
    error: null,
    isRunning: false,
  };
};

// Helper function to load layout from localStorage
const loadLayoutFromStorage = () => {
  try {
    const sizes = localStorage.getItem('layoutSizes');
    const collapsed = localStorage.getItem('collapsedPanels');
    return {
      layoutSizes: sizes ? JSON.parse(sizes) : {},
      collapsedPanels: collapsed ? JSON.parse(collapsed) : {},
    };
  } catch (e) {
    console.error("Failed to load layout from localStorage", e);
    return { layoutSizes: {}, collapsedPanels: {} };
  }
};

// Helper function to save layout to localStorage
const saveLayoutToStorage = (state: Partial<AppState>) => {
  try {
    if (state.layoutSizes) {
      localStorage.setItem('layoutSizes', JSON.stringify(state.layoutSizes));
    }
    if (state.collapsedPanels) {
      localStorage.setItem('collapsedPanels', JSON.stringify(state.collapsedPanels));
    }
  } catch (e) {
    console.error("Failed to save layout to localStorage", e);
  }
};

// Use the original AppState with create
export const useAppStore = create<AppState>()(
  devtools(persist(
    (set, get) => ({
      // --- Initial State ---
      authToken: import.meta.env.VITE_AUTH_TOKEN || null,

      // --- REFACTORED: Schema Initial State ---
      fullSchemaData: null,
      isFetchingFullSchema: false,
      fullSchemaError: null,
      availableDatabases: [],
      selectedDatabase: null,
      tables: [],
      tableSchemas: {},
      // --- END REFACTOR ---

      // --- Other initial states ... ---
      currentQuery: 'SELECT * FROM ...;',
      queryResult: null,
      queryError: null,
      isQueryRunning: false,
      showVisualization: false,
      selectedChartType: 'bar', // Default to bar chart initially
      queryHistory: [],
      queryLimit: 500,

      // --- NEW: Chart Config Initial State ---
      chartConfig: {
        xAxis: null,
        yAxis: null, // Keep null or set based on yAxes?
        yAxes: [],
        aggregation: null,
        groupBy: null,
        labelKey: null,
        valueKey: null,
      },
      // --- END: Chart Config Initial State ---

      // Initial tab state
      tabs: [createNewTab()], // Start with one tab
      activeTabId: null, // Will be set after initial tab creation

      // --- NEW: Layout Initial State ---
      ...loadLayoutFromStorage(), // Load initial layout state

      // --- NEW: AI Query Generation Initial State ---
      isGenerateQueryModalOpen: false,
      generateQueryLoading: false,
      generateQueryError: null,
      generateQueryPrompt: "",
      // --- END: AI Query Generation Initial State ---

      // --- Actions ---

      // Auth
      setAuthToken: (token) => set({ authToken: token }),

      // --- REFACTORED: Schema Actions ---
      fetchFullSchema: async () => {
        const token = get().authToken;
        if (!token) {
          set({ fullSchemaError: 'Authentication token is missing.', isFetchingFullSchema: false });
          return;
        }

        set({ isFetchingFullSchema: true, fullSchemaError: null });
        try {
          const response = await fetch(`${API_BASE_URL}/api/schema`, { // Updated endpoint
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}` }));
            throw new Error(errorData.message || `Failed to fetch full schema. Status: ${response.status}`);
          }

          const schemaData: FullSchema = await response.json();

          // --- Populate derived state from full schema ---
          const databases: DatabaseEntry[] = schemaData.databases.map(db => ({
            name: db.name,
            db_type: db.db_type,
          }));

          let selectedDbTables: TableEntry[] = [];
          let selectedDbSchemas: Record<string, TableSchema> = {};
          const currentSelectedDb = get().selectedDatabase;

          if (currentSelectedDb) {
            const dbSchema = schemaData.databases.find(db => db.name === currentSelectedDb);
            if (dbSchema) {
              selectedDbTables = dbSchema.tables.map(t => ({ name: t.table_name /* , table_type: t.table_type */ }));
              selectedDbSchemas = dbSchema.tables.reduce((acc, schema) => {
                acc[schema.table_name] = schema;
                return acc;
              }, {} as Record<string, TableSchema>);
            }
          }
          // --- End Populate derived state ---

          set({
            fullSchemaData: schemaData,
            isFetchingFullSchema: false,
            availableDatabases: databases, // Set derived state
            tables: selectedDbTables,       // Set derived state
            tableSchemas: selectedDbSchemas, // Set derived state
            fullSchemaError: null, // Clear error on success
          });

        } catch (error: unknown) {
          console.error("Failed to fetch full schema:", error);
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          set({ fullSchemaError: errorMessage, isFetchingFullSchema: false });
        }
      },

      setSelectedDatabase: (dbName) => {
        const fullSchema = get().fullSchemaData;
        let selectedDbTables: TableEntry[] = [];
        let selectedDbSchemas: Record<string, TableSchema> = {};

        if (dbName && fullSchema) {
          const dbSchema = fullSchema.databases.find(db => db.name === dbName);
          if (dbSchema) {
            selectedDbTables = dbSchema.tables.map(t => ({ name: t.table_name /*, table_type: t.table_type */ }));
            selectedDbSchemas = dbSchema.tables.reduce((acc, schema) => {
              acc[schema.table_name] = schema;
              return acc;
            }, {} as Record<string, TableSchema>);
          }
        }

        set({
          selectedDatabase: dbName,
          tables: selectedDbTables,
          tableSchemas: selectedDbSchemas,
          // Reset query/results when DB changes?
          // currentQuery: `SELECT * FROM ...;`,
          // queryResult: null,
          // queryError: null,
        });
        // No need to call fetch actions anymore
      },
      // --- END REFACTOR ---

      // Query
      setCurrentQuery: (query: string) => set({ currentQuery: query }),

      executeQuery: async () => {
        const dbName = get().selectedDatabase;
        const query = get().currentQuery;
        const token = get().authToken;

        if (!dbName || !query || !token) {
          set({ queryError: 'Missing database selection, query, or authentication token.' });
          return;
        }

        set({ isQueryRunning: true, queryResult: null, queryError: null });
        // Also add query to history immediately
        // (Should we wait for success? Maybe not, user might want to retry easily)
        const addQueryToHistoryAction = get().addQueryToHistory; // Get action reference
        if (addQueryToHistoryAction) {
          addQueryToHistoryAction(query);
        } else {
          console.warn('addQueryToHistory action not found in store');
        }

        console.log(`Executing query on ${dbName}: ${query}`);
        try {
          // Prepend base URL
          const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ db_name: dbName, query })
          });

          const resultData = await response.json(); // Always try to parse JSON

          if (!response.ok) {
            // Use error message from response body if available
            throw new Error(resultData.error || resultData.message || `Query execution failed. Status: ${response.status}`);
          }

          // Assuming backend returns QueryResultData structure
          set({ queryResult: resultData, isQueryRunning: false });

        } catch (error: unknown) {
          console.error("Query execution failed:", error);
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during query execution.';
          set({ queryError: errorMessage, isQueryRunning: false });
        }
      },

      addQueryToHistory: (query: string) =>
        set((state) => ({
          queryHistory: [query, ...state.queryHistory.slice(0, 49)],
        })),

      setQueryLimit: (limit: number) => set({ queryLimit: limit }),

      // UI State
      setShowVisualization: (show) => {
        // Reset chart type if hiding visualization
        set({ showVisualization: show });
        if (!show) {
          set({ selectedChartType: 'bar' }); // Reset to default when hiding
        }
      },
      setSelectedChartType: (type) => set({ selectedChartType: type }),

      // --- NEW: Layout Actions ---
      setLayoutSizes: (groupId, sizes) => {
        set((state) => {
          const newState = {
            layoutSizes: { ...state.layoutSizes, [groupId]: sizes },
          };
          saveLayoutToStorage(newState); // Save to localStorage
          return newState;
        });
      },

      togglePanelCollapse: (panelId) => {
        set((state) => {
          const newState = {
            collapsedPanels: {
              ...state.collapsedPanels,
              [panelId]: !state.collapsedPanels[panelId],
            },
          };
          saveLayoutToStorage(newState); // Save to localStorage
          return newState;
        });
      },
      // --- END: Layout Actions ---

      // --- NEW: Chart Config Actions ---
      setChartConfig: (configUpdate) => set((state) => ({
        // Ensure yAxes is always an array, even if updating yAxis (optional)
        chartConfig: {
          ...state.chartConfig,
          ...configUpdate,
          // Optionally sync yAxes if yAxis is updated and not yAxes directly
          // yAxes: configUpdate.yAxis && !configUpdate.yAxes ? [configUpdate.yAxis] : (configUpdate.yAxes ?? state.chartConfig.yAxes),
        },
      })),
      // --- END: Chart Config Actions ---

      // --- REFACTORED: Tab Actions ---
      addTab: (makeActive = true) => {
        const newTab = createNewTab();
        set((state) => ({ tabs: [...state.tabs, newTab] }));
        if (makeActive) {
          set({ activeTabId: newTab.id });
        }
        return newTab.id;
      },

      closeTab: (tabId: string) => {
        set((state) => {
          const remainingTabs = state.tabs.filter(tab => tab.id !== tabId);
          let newActiveTabId = state.activeTabId;
          // If the closed tab was active, activate the previous one or the first one
          if (state.activeTabId === tabId) {
            const closingTabIndex = state.tabs.findIndex(tab => tab.id === tabId);
            if (remainingTabs.length > 0) {
              newActiveTabId = remainingTabs[Math.max(0, closingTabIndex - 1)].id;
            } else {
              newActiveTabId = null; // Should be handled by addTab if needed
            }
          }
          // Ensure at least one tab remains
          if (remainingTabs.length === 0) {
            const newTab = createNewTab();
            return { tabs: [newTab], activeTabId: newTab.id };
          }
          return { tabs: remainingTabs, activeTabId: newActiveTabId };
        });
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      updateQueryInTab: (tabId, query) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, query } : tab
          ),
        }));
      },

      updateTabName: (tabId, name) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === tabId ? { ...tab, name } : tab
          ),
        }));
      },

      executeQueryForTab: async (tabId: string, limit: number) => {
        const state = get();
        const tab = state.tabs.find(t => t.id === tabId);
        const database = state.selectedDatabase;
        const token = state.authToken;

        if (!tab) {
          console.error(`Tab with ID ${tabId} not found for execution.`);
          return;
        }
        if (!database) {
          set(prevState => ({ tabs: prevState.tabs.map(t => t.id === tabId ? { ...t, error: "No database selected.", isRunning: false } : t) }));
          return;
        }
        if (!token) {
          set(prevState => ({ tabs: prevState.tabs.map(t => t.id === tabId ? { ...t, error: "Authentication token is missing.", isRunning: false } : t) }));
          return;
        }
        if (!tab.query) {
          set(prevState => ({ tabs: prevState.tabs.map(t => t.id === tabId ? { ...t, error: "Query is empty.", isRunning: false } : t) }));
          return;
        }

        // Update tab state to indicate running
        set(prevState => ({ tabs: prevState.tabs.map(t => t.id === tabId ? { ...t, isRunning: true, error: null, result: null } : t) }));

        const startTime = performance.now(); // Start timer

        try {
          const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ query: tab.query, db_name: database, limit }), // Pass limit in the body
          });

          const endTime = performance.now(); // End timer
          const executionTime = (endTime - startTime) / 1000; // Calculate time in seconds

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            // Attempt to access message, otherwise use default
            const message = typeof errorData === 'object' && errorData !== null && 'message' in errorData && typeof errorData.message === 'string'
              ? errorData.message
              : `HTTP error ${response.status}`;
            throw new Error(message);
          }

          const data: unknown = await response.json(); // Fetch as unknown

          // --- Type checking and processing for backend response --- //
          let resultData: QueryResultData;
          if (Array.isArray(data)) {
            console.warn("Backend returned raw array, wrapping in { result: [...] }");
            // Ensure elements are Records before assigning
            const resultsArray = data.every(item => typeof item === 'object' && item !== null)
              ? data as Record<string, unknown>[]
              : []; // Or handle error differently
            resultData = { result: resultsArray.length > 0 ? resultsArray : null, executionTime };
            if (resultsArray.length === 0) {
              resultData.message = "Query executed successfully, 0 rows returned.";
            }
          } else if (typeof data === 'object' && data !== null) {
            // Assume backend returned the correct structure, assign executionTime
            // We trust the backend structure here, potential runtime error if structure is wrong
            resultData = { ...(data as Partial<QueryResultData>), executionTime };
            // Ensure result is array of records or null
            if (resultData.result && !Array.isArray(resultData.result)) {
              console.error("Backend object response has non-array result field:", resultData.result);
              resultData.result = null; // or throw error
            } else if (resultData.result && Array.isArray(resultData.result) && !resultData.result.every(item => typeof item === 'object' && item !== null)) {
              console.error("Backend object response has result array with non-object elements:", resultData.result);
              resultData.result = null; // or throw error
            }

          } else {
            // Handle unexpected data format
            console.error("Unexpected response format from /api/execute-query:", data);
            throw new Error("Received unexpected data format from server.");
          }
          // --- END Type checking --- //

          // Update tab state with results
          set(prevState => ({
            tabs: prevState.tabs.map(t => t.id === tabId ? { ...t, isRunning: false, result: resultData, error: null } : t),
            // Add to global history as well
            queryHistory: [tab.query, ...prevState.queryHistory.filter(q => q !== tab.query)].slice(0, 50),
          }));

        } catch (error: unknown) {
          // Update tab state with error
          const errorMessage = error instanceof Error ? error.message : 'Failed to execute query';
          set(prevState => ({ tabs: prevState.tabs.map(t => t.id === tabId ? { ...t, isRunning: false, error: errorMessage, result: null } : t) }));
        }
      },
      // --- END REFACTOR ---

      // --- NEW: AI Query Generation Actions ---
      openGenerateQueryModal: () => set({ isGenerateQueryModalOpen: true, generateQueryPrompt: "", generateQueryError: null }),
      closeGenerateQueryModal: () => set({ isGenerateQueryModalOpen: false }),
      setGenerateQueryPrompt: (prompt) => set({ generateQueryPrompt: prompt }),
      generateQuery: async () => {
        const state = get();
        const token = state.authToken;
        const database = state.selectedDatabase;
        const prompt = state.generateQueryPrompt;
        const activeTabId = state.activeTabId;

        if (!activeTabId) {
          set({ generateQueryError: "No active query tab found." });
          return;
        }
        if (!database) {
          set({ generateQueryError: "No database selected." });
          return;
        }
        // Trim the prompt before checking if it's empty
        if (!prompt || !prompt.trim()) {
          set({ generateQueryError: "Prompt cannot be empty." });
          return;
        }
        if (!token) {
          set({ generateQueryError: "Authentication token is missing." });
          return;
        }

        set({ generateQueryLoading: true, generateQueryError: null });

        try {
          const response = await fetch(`${API_BASE_URL}/api/gen-query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ db_name: database, prompt }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
            throw new Error(errorData.message || errorData.error || `Failed to generate query. Status: ${response.status}`);
          }

          const data = await response.json();
          const generatedQuery = data.query; // Assuming backend returns { query: "..." }

          if (!generatedQuery) {
            throw new Error("AI did not return a query.");
          }

          // Update the query in the active tab
          state.updateQueryInTab(activeTabId, generatedQuery);

          // Close modal on success
          set({ generateQueryLoading: false, isGenerateQueryModalOpen: false, generateQueryPrompt: "" });

        } catch (error: unknown) {
          console.error("AI Query generation failed:", error);
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during AI query generation.';
          set({ generateQueryError: errorMessage, generateQueryLoading: false });
        }
      },
      // --- END: AI Query Generation Actions ---

      // Initialize the store
      init: () => {
        // Set active tab ID after initial tabs are potentially loaded from persist
        const initialTabId = get().tabs[0]?.id ?? null;
        if (initialTabId && !get().activeTabId) { // Only set if not already set (e.g., by persist)
          set({ activeTabId: initialTabId });
        }
        // Initial fetch of full schema
        get().fetchFullSchema();
        // Load persisted history (if not handled by persist middleware directly)
        // const history = localStorage.getItem('queryHistory');
        // if (history) {
        //   set({ queryHistory: JSON.parse(history) });
        // }
      },
    }),
    {
      name: 'app-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // Use localStorage
      partialize: (state) => ({
        // Selectively persist state
        authToken: state.authToken,
        selectedDatabase: state.selectedDatabase,
        queryHistory: state.queryHistory,
        tabs: state.tabs.map(tab => ({ // Persist tabs, but reset running state
          id: tab.id,
          name: tab.name,
          query: tab.query,
          result: null, // Don't persist large results
          error: null,
          isRunning: false, // Always reset running state
        })),
        activeTabId: state.activeTabId,
        layoutSizes: state.layoutSizes, // Persist layout
        collapsedPanels: state.collapsedPanels,
        // Do not persist: fullSchemaData, isFetchingFullSchema, etc.
        // Do not persist: chartConfig, showVisualization, selectedChartType (UI state)
      }),
      // onRehydrateStorage removed as it caused issues
    }
  )
  ));

// Selector to get the data for the currently active tab
export const useActiveTabData = () => {
  const tabs = useAppStore((state) => state.tabs);
  const activeTabId = useAppStore((state) => state.activeTabId);
  return tabs.find(tab => tab.id === activeTabId) || null;
};
