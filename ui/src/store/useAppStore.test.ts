import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, QueryTab, FullSchema, QueryResultData } from './useAppStore'; // Import the store and types

// Mock the fetch API globally
global.fetch = vi.fn();

// Helper to create a mock successful response
const createFetchResponse = (data: unknown, status = 200, ok = true) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)), // Add text method for error parsing
  } as Response);
};

// Helper to create a mock failed response
const createFetchErrorResponse = (data: unknown, status = 500) => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};


describe('useAppStore - AI Query Generation', () => {
  // Reset store state before each test
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true); // Reset to initial state
    vi.clearAllMocks(); // Clear fetch mocks
  });

  it('openGenerateQueryModal should open modal and clear prompt/error', () => {
    // Set initial state with modal closed and some prompt/error
    useAppStore.setState({ isGenerateQueryModalOpen: false, generateQueryPrompt: 'old', generateQueryError: 'old error' });

    useAppStore.getState().openGenerateQueryModal();

    expect(useAppStore.getState().isGenerateQueryModalOpen).toBe(true);
    expect(useAppStore.getState().generateQueryPrompt).toBe('');
    expect(useAppStore.getState().generateQueryError).toBe(null);
  });

  it('closeGenerateQueryModal should close modal', () => {
    useAppStore.setState({ isGenerateQueryModalOpen: true });
    useAppStore.getState().closeGenerateQueryModal();
    expect(useAppStore.getState().isGenerateQueryModalOpen).toBe(false);
  });

  it('setGenerateQueryPrompt should update the prompt', () => {
    useAppStore.getState().setGenerateQueryPrompt('new prompt');
    expect(useAppStore.getState().generateQueryPrompt).toBe('new prompt');
  });

  describe('generateQuery action', () => {
    const initialTab: QueryTab = {
      id: 'tab1',
      name: 'Query 1',
      query: 'SELECT 1;',
      result: null,
      error: null,
      isRunning: false,
    };

    beforeEach(() => {
      // Setup common initial state for these tests
      useAppStore.setState({
        authToken: 'test-token',
        selectedDatabase: 'test-db',
        tabs: [initialTab],
        activeTabId: 'tab1',
        generateQueryPrompt: 'show me the data',
        isGenerateQueryModalOpen: true,
        generateQueryLoading: false,
        generateQueryError: null,
      });
    });

    it('should successfully generate query and update active tab', async () => {
      const mockGeneratedQuery = 'SELECT * FROM test_table;';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        createFetchResponse({ query: mockGeneratedQuery })
      );

      await useAppStore.getState().generateQuery();

      // Check fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gen-query'), // Check base URL + endpoint
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify({ db_name: 'test-db', prompt: 'show me the data' }),
        })
      );

      // Check final state
      const state = useAppStore.getState();
      expect(state.generateQueryLoading).toBe(false);
      expect(state.generateQueryError).toBe(null);
      expect(state.isGenerateQueryModalOpen).toBe(false); // Modal closes on success
      expect(state.generateQueryPrompt).toBe(''); // Prompt cleared on success
      // Check active tab query update
      const updatedTab = state.tabs.find(t => t.id === 'tab1');
      expect(updatedTab?.query).toBe(mockGeneratedQuery);
    });

    it('should handle backend error response', async () => {
      const errorMsg = 'Failed on backend';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        createFetchErrorResponse({ message: errorMsg }, 500)
      );

      await useAppStore.getState().generateQuery();

      expect(fetch).toHaveBeenCalledTimes(1);

      const state = useAppStore.getState();
      expect(state.generateQueryLoading).toBe(false);
      expect(state.generateQueryError).toContain(errorMsg);
      expect(state.isGenerateQueryModalOpen).toBe(true); // Modal stays open on error
    });

    it('should handle network error during fetch', async () => {
      const networkError = new Error('Network failure');
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(networkError);

      await useAppStore.getState().generateQuery();

      expect(fetch).toHaveBeenCalledTimes(1);

      const state = useAppStore.getState();
      expect(state.generateQueryLoading).toBe(false);
      expect(state.generateQueryError).toBe(networkError.message);
      expect(state.isGenerateQueryModalOpen).toBe(true); // Modal stays open on error
    });

    it('should set error if no active tab', async () => {
      useAppStore.setState({ activeTabId: null });
      await useAppStore.getState().generateQuery();
      expect(fetch).not.toHaveBeenCalled();
      expect(useAppStore.getState().generateQueryError).toBe('No active query tab found.');
      expect(useAppStore.getState().generateQueryLoading).toBe(false);
    });

    it('should set error if no selected database', async () => {
      useAppStore.setState({ selectedDatabase: null });
      await useAppStore.getState().generateQuery();
      expect(fetch).not.toHaveBeenCalled();
      expect(useAppStore.getState().generateQueryError).toBe('No database selected.');
      expect(useAppStore.getState().generateQueryLoading).toBe(false);
    });

    it('should set error if prompt is empty', async () => {
      useAppStore.setState({ generateQueryPrompt: '   ' }); // Empty or whitespace
      await useAppStore.getState().generateQuery();
      expect(fetch).not.toHaveBeenCalled();
      expect(useAppStore.getState().generateQueryError).toBe('Prompt cannot be empty.');
      expect(useAppStore.getState().generateQueryLoading).toBe(false);
    });

    it('should set error if no auth token', async () => {
      useAppStore.setState({ authToken: null });
      await useAppStore.getState().generateQuery();
      expect(fetch).not.toHaveBeenCalled();
      expect(useAppStore.getState().generateQueryError).toBe('Authentication token is missing.');
      expect(useAppStore.getState().generateQueryLoading).toBe(false);
    });

    it('should set loading state during fetch', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
        // Check loading state *during* the fetch mock
        expect(useAppStore.getState().generateQueryLoading).toBe(true);
        return createFetchResponse({ query: 'SELECT 1;' });
      });

      await useAppStore.getState().generateQuery();

      // Final loading state check (should be false)
      expect(useAppStore.getState().generateQueryLoading).toBe(false);
    });
  });
});

// --- NEW: Schema Tests ---
describe('useAppStore - Schema Actions', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    vi.clearAllMocks();
    // Initial state setup
    useAppStore.setState({ authToken: 'test-token' });
  });

  it('fetchFullSchema should fetch and update schema state on success', async () => {
    const mockSchema: FullSchema = {
      databases: [
        {
          name: 'db1',
          db_type: 'duckdb',
          tables: [
            { table_name: 'table1', columns: [{ name: 'col1', data_type: 'INTEGER', is_nullable: false }] },
            { table_name: 'table2', columns: [{ name: 'colA', data_type: 'VARCHAR', is_nullable: true }] },
          ],
        },
        {
          name: 'db2',
          db_type: 'postgres',
          tables: [{ table_name: 'table3', columns: [{ name: 'id', data_type: 'BIGINT', is_nullable: false, is_pk: true }] }],
        },
      ],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createFetchResponse(mockSchema));

    await useAppStore.getState().fetchFullSchema();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/schema'), expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' },
    }));

    const state = useAppStore.getState();
    expect(state.isFetchingFullSchema).toBe(false);
    expect(state.fullSchemaError).toBe(null);
    expect(state.fullSchemaData).toEqual(mockSchema);
    expect(state.availableDatabases).toEqual([
      { name: 'db1', db_type: 'duckdb' },
      { name: 'db2', db_type: 'postgres' },
    ]);
    // Check derived state is initially empty as no db selected
    expect(state.tables).toEqual([]);
    expect(state.tableSchemas).toEqual({});
  });

  it('fetchFullSchema should handle fetch error', async () => {
    const errorMsg = 'Schema fetch failed';
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createFetchErrorResponse({ message: errorMsg }, 500));

    await useAppStore.getState().fetchFullSchema();

    expect(fetch).toHaveBeenCalledTimes(1);
    const state = useAppStore.getState();
    expect(state.isFetchingFullSchema).toBe(false);
    expect(state.fullSchemaError).toContain(errorMsg);
    expect(state.fullSchemaData).toBe(null);
    expect(state.availableDatabases).toEqual([]);
  });

  it('fetchFullSchema should set error if no auth token', async () => {
    useAppStore.setState({ authToken: null });
    await useAppStore.getState().fetchFullSchema();
    expect(fetch).not.toHaveBeenCalled();
    expect(useAppStore.getState().fullSchemaError).toBe('Authentication token is missing.');
    expect(useAppStore.getState().isFetchingFullSchema).toBe(false);
  });

  it('setSelectedDatabase should update selected db and derived tables/schemas', async () => {
    // First, fetch the schema
    const mockSchema: FullSchema = {
      databases: [
        {
          name: 'db1',
          db_type: 'duckdb',
          tables: [
            { table_name: 'table1', columns: [{ name: 'col1', data_type: 'INTEGER', is_nullable: false }] },
            { table_name: 'table2', columns: [{ name: 'colA', data_type: 'VARCHAR', is_nullable: true }] },
          ],
        },
        {
          name: 'db2',
          db_type: 'postgres',
          tables: [{ table_name: 'table3', columns: [{ name: 'id', data_type: 'BIGINT', is_nullable: false, is_pk: true }] }],
        },
      ],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createFetchResponse(mockSchema));
    await useAppStore.getState().fetchFullSchema();

    // Now, select a database
    useAppStore.getState().setSelectedDatabase('db1');

    const state = useAppStore.getState();
    expect(state.selectedDatabase).toBe('db1');
    expect(state.tables).toEqual([{ name: 'table1' }, { name: 'table2' }]);
    expect(state.tableSchemas).toEqual({
      table1: { table_name: 'table1', columns: [{ name: 'col1', data_type: 'INTEGER', is_nullable: false }] },
      table2: { table_name: 'table2', columns: [{ name: 'colA', data_type: 'VARCHAR', is_nullable: true }] },
    });

    // Select another database
    useAppStore.getState().setSelectedDatabase('db2');
    const state2 = useAppStore.getState();
    expect(state2.selectedDatabase).toBe('db2');
    expect(state2.tables).toEqual([{ name: 'table3' }]);
    expect(state2.tableSchemas).toEqual({
      table3: { table_name: 'table3', columns: [{ name: 'id', data_type: 'BIGINT', is_nullable: false, is_pk: true }] },
    });

    // Select null database
    useAppStore.getState().setSelectedDatabase(null);
    const state3 = useAppStore.getState();
    expect(state3.selectedDatabase).toBe(null);
    expect(state3.tables).toEqual([]);
    expect(state3.tableSchemas).toEqual({});
  });
});

// --- NEW: Tab Management Tests ---
describe('useAppStore - Tab Management', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    // Ensure init sets the active tab ID correctly
    useAppStore.getState().init();
  });

  it('should initialize with one tab and set it as active', () => {
    const state = useAppStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.activeTabId).toBe(state.tabs[0].id);
    expect(state.tabs[0].name).toMatch(/Query \d{1,2}:\d{2}:\d{2} (AM|PM)/); // Check default name format
  });

  it('addTab should add a new tab and optionally activate it', () => {
    const newTabId = useAppStore.getState().addTab(true); // Add and activate

    const state = useAppStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe(newTabId);
    expect(state.tabs.find(t => t.id === newTabId)).toBeDefined();

    const anotherTabId = useAppStore.getState().addTab(false); // Add but don't activate
    const state2 = useAppStore.getState();
    expect(state2.tabs.length).toBe(3);
    expect(state2.activeTabId).toBe(newTabId); // Should still be the previously activated one
    expect(state2.tabs.find(t => t.id === anotherTabId)).toBeDefined();
  });

  it('closeTab should remove a tab and activate another', () => {
    const tab1 = useAppStore.getState().tabs[0];
    const tab2Id = useAppStore.getState().addTab(true); // Add tab2 and activate
    const tab3Id = useAppStore.getState().addTab(false); // Add tab3

    // Close inactive tab (tab1)
    useAppStore.getState().closeTab(tab1.id);
    let state = useAppStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.tabs.find(t => t.id === tab1.id)).toBeUndefined();
    expect(state.activeTabId).toBe(tab2Id); // Active tab remains tab2

    // Close active tab (tab2)
    useAppStore.getState().closeTab(tab2Id);
    state = useAppStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs.find(t => t.id === tab2Id)).toBeUndefined();
    // Should activate the remaining tab (tab3) - it was the only one left
    expect(state.activeTabId).toBe(tab3Id);
  });

  it('closeTab should create a new tab if the last one is closed', () => {
    const lastTabId = useAppStore.getState().activeTabId;
    expect(lastTabId).not.toBeNull(); // Ensure there's an active tab

    if (lastTabId) {
      useAppStore.getState().closeTab(lastTabId);
    }

    const state = useAppStore.getState();
    expect(state.tabs.length).toBe(1); // Should create a new one
    expect(state.activeTabId).toBe(state.tabs[0].id); // The new one should be active
    expect(state.activeTabId).not.toBe(lastTabId); // It should be a *new* tab ID
  });

  it('setActiveTab should change the active tab ID', () => {
    const tab1Id = useAppStore.getState().activeTabId;
    const tab2Id = useAppStore.getState().addTab(false);

    useAppStore.getState().setActiveTab(tab2Id);
    expect(useAppStore.getState().activeTabId).toBe(tab2Id);

    useAppStore.getState().setActiveTab(tab1Id);
    expect(useAppStore.getState().activeTabId).toBe(tab1Id);
  });

  it('updateQueryInTab should update the query for the specified tab', () => {
    const tabId = useAppStore.getState().activeTabId;
    const newQuery = 'SELECT count(*) FROM my_table;';
    useAppStore.getState().updateQueryInTab(tabId!, newQuery); // Non-null assertion as init sets it

    const updatedTab = useAppStore.getState().tabs.find(t => t.id === tabId);
    expect(updatedTab?.query).toBe(newQuery);
  });

  it('updateTabName should update the name for the specified tab', () => {
    const tabId = useAppStore.getState().activeTabId;
    const newName = 'My Important Query';
    useAppStore.getState().updateTabName(tabId!, newName);

    const updatedTab = useAppStore.getState().tabs.find(t => t.id === tabId);
    expect(updatedTab?.name).toBe(newName);
  });
});

// --- NEW: Query Execution Tests ---
describe('useAppStore - executeQueryForTab', () => {
  let initialTab: QueryTab;

  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    vi.clearAllMocks(); // Clear mocks here
    // DO NOT call init() here to prevent initial schema fetch
    // Manually set required state
    initialTab = {
      id: 'tab1',
      name: 'Query 1',
      query: 'SELECT 1;',
      result: null,
      error: null,
      isRunning: false,
    };
    useAppStore.setState({
      authToken: 'test-token',
      selectedDatabase: 'test-db',
      tabs: [initialTab],
      activeTabId: initialTab.id,
      // Ensure fullSchemaData is null or mock it if needed by the tested function indirectly
      fullSchemaData: null,
    });
  });

  it('should execute query successfully and update tab state', async () => {
    const mockResult: QueryResultData = { result: [{ col1: 1 }, { col1: 2 }], executionTime: 0.123 };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createFetchResponse(mockResult));

    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);

    expect(fetch).toHaveBeenCalledTimes(1); // Should now be 1
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/execute-query'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ query: initialTab.query, db_name: 'test-db', limit: 100 }),
      })
    );

    const state = useAppStore.getState();
    const updatedTab = state.tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.isRunning).toBe(false);
    expect(updatedTab?.error).toBe(null);
    // Compare result excluding execution time which is calculated client-side
    expect(updatedTab?.result?.result).toEqual(mockResult.result);
    expect(updatedTab?.result?.message).toBeUndefined();
    expect(updatedTab?.result?.executionTime).toBeGreaterThan(0); // Check that it's set
    // Check query history
    expect(state.queryHistory).toContain(initialTab.query);
  });

  it('should handle successful execution with message (e.g., INSERT)', async () => {
    const mockResultWithMessage: QueryResultData = { message: "Rows affected: 1", affectedRows: 1, executionTime: 0.05 };
    const insertQuery = "INSERT INTO my_table VALUES (1);";
    useAppStore.getState().updateQueryInTab(initialTab.id, insertQuery);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createFetchResponse(mockResultWithMessage));

    await useAppStore.getState().executeQueryForTab(initialTab.id, 50);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/execute-query'),
      expect.objectContaining({ body: JSON.stringify({ query: insertQuery, db_name: 'test-db', limit: 50 }) })
    );

    const updatedTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.isRunning).toBe(false);
    expect(updatedTab?.error).toBe(null);
    expect(updatedTab?.result?.result).toBeUndefined(); // No result array for INSERT
    expect(updatedTab?.result?.message).toBe("Rows affected: 1");
    expect(updatedTab?.result?.affectedRows).toBe(1);
    expect(updatedTab?.result?.executionTime).toBeGreaterThan(0);
  });

  it('should handle query execution error from backend', async () => {
    const errorMsg = 'Syntax error in SQL';
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(createFetchErrorResponse({ message: errorMsg }, 400));

    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);

    expect(fetch).toHaveBeenCalledTimes(1); // Should now be 1
    const updatedTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.isRunning).toBe(false);
    expect(updatedTab?.error).toContain(errorMsg);
    expect(updatedTab?.result).toBe(null);
  });

  it('should handle network error during query execution', async () => {
    const networkError = new Error('Connection refused');
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(networkError);

    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);

    expect(fetch).toHaveBeenCalledTimes(1); // Should now be 1
    const updatedTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.isRunning).toBe(false);
    expect(updatedTab?.error).toBe(networkError.message);
    expect(updatedTab?.result).toBe(null);
  });

  it('should set error if no selected database', async () => {
    useAppStore.setState({ selectedDatabase: null });
    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);
    expect(fetch).not.toHaveBeenCalled(); // Should remain not called
    const updatedTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.error).toBe('No database selected.');
    expect(updatedTab?.isRunning).toBe(false);
  });

  it('should set error if query is empty', async () => {
    useAppStore.getState().updateQueryInTab(initialTab.id, ''); // Set empty query
    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);
    expect(fetch).not.toHaveBeenCalled(); // Should remain not called
    const updatedTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.error).toBe('Query is empty.');
    expect(updatedTab?.isRunning).toBe(false);
  });

  it('should set error if no auth token', async () => {
    useAppStore.setState({ authToken: null });
    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);
    expect(fetch).not.toHaveBeenCalled(); // Should remain not called
    const updatedTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(updatedTab?.error).toBe('Authentication token is missing.');
    expect(updatedTab?.isRunning).toBe(false);
  });

  it('should set running state during execution', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      // Check state *during* mocked fetch
      const tab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
      expect(tab?.isRunning).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network delay
      return createFetchResponse({ result: [] });
    });

    await useAppStore.getState().executeQueryForTab(initialTab.id, 100);

    // Check final state
    const finalTab = useAppStore.getState().tabs.find(t => t.id === initialTab.id);
    expect(finalTab?.isRunning).toBe(false);
  });
});
