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
  columns?: string[]; // Column names (if using array of arrays)
  rows?: any[][]; // Array of arrays
  result?: Record<string, any>[]; // Or array of objects (preferred format from design)
  message?: string; // For non-SELECT queries
  affectedRows?: number;
  executionTime?: number; // Add optional execution time field
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
  executeQueryForTab: (tabId: string) => Promise<void>;
  // --- END REFACTOR ---

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

        } catch (error: any) {
          console.error("Failed to fetch full schema:", error);
          set({ fullSchemaError: error.message || 'An unknown error occurred', isFetchingFullSchema: false });
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

        } catch (error: any) {
          console.error("Query execution failed:", error);
          set({ queryError: error.message || 'An unknown error occurred during query execution.', isQueryRunning: false });
        }
      },

      addQueryToHistory: (query: string) => // Add action definition
        set((state) => ({
          queryHistory: [query, ...state.queryHistory.slice(0, 49)], // Keep last 50
        })),

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

      executeQueryForTab: async (tabId) => {
        const tab = get().tabs.find(t => t.id === tabId);
        const dbName = get().selectedDatabase; // Using global DB for now
        const token = get().authToken;

        if (!tab || !dbName || !token) {
          const errorMsg = !tab ? `Tab ${tabId} not found.` :
            !dbName ? 'No database selected.' :
              'Missing authentication token.';
          set((state) => ({
            tabs: state.tabs.map(t => t.id === tabId ? { ...t, isRunning: false, error: errorMsg } : t)
          }));
          return;
        }

        const query = tab.query;

        // Set loading state for the specific tab
        set((state) => ({
          tabs: state.tabs.map(t => t.id === tabId ? { ...t, isRunning: true, result: null, error: null } : t)
        }));

        // Add to history? Maybe move history management inside tab state?
        // const addQueryToHistoryAction = get().addQueryToHistory;
        // if (addQueryToHistoryAction) { addQueryToHistoryAction(query); }

        try {
          const response = await fetch(`${API_BASE_URL}/api/execute-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ db_name: dbName, query })
          });
          const resultData = await response.json();
          if (!response.ok) {
            throw new Error(resultData.error || resultData.message || `Query execution failed. Status: ${response.status}`);
          }

          // Update result for the specific tab
          set((state) => ({
            tabs: state.tabs.map(t => t.id === tabId ? { ...t, isRunning: false, result: resultData, error: null } : t)
          }));

        } catch (error: any) {
          console.error("Query execution failed:", error);
          // Update error for the specific tab
          set((state) => ({
            tabs: state.tabs.map(t => t.id === tabId ? { ...t, isRunning: false, result: null, error: error.message || 'Unknown error' } : t)
          }));
        }
      },
      // --- END REFACTOR ---

      // Initialize activeTabId after store hydration
      init: () => {
        const initialTabs = get().tabs;
        if (initialTabs.length > 0 && !get().activeTabId) {
          set({ activeTabId: initialTabs[0].id });
        }
        if (initialTabs.length === 0) { // Ensure at least one tab exists
          const newTab = createNewTab();
          set({ tabs: [newTab], activeTabId: newTab.id });
        }
        // Fetch schema if token exists
        if (get().authToken) {
          get().fetchFullSchema();
        }
      },
    }),
    {
      name: 'AppStorePersistence',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        authToken: state.authToken,
        tabs: state.tabs.map(tab => ({ ...tab, result: null, error: null, isRunning: false })),
        activeTabId: state.activeTabId,
        // Persist selected DB, but not the full schema (fetch on load)
        selectedDatabase: state.selectedDatabase,
        layoutSizes: state.layoutSizes,
        collapsedPanels: state.collapsedPanels,
        chartConfig: state.chartConfig,
        // Do not persist fullSchemaData, errors, loading states
      }),
    }
  )
  ));

// Helper function to get the state of the currently active tab
export const useActiveTabData = () => {
  const tabs = useAppStore((state) => state.tabs);
  const activeTabId = useAppStore((state) => state.activeTabId);
  return tabs.find(tab => tab.id === activeTabId);
};
