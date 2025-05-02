import { useEffect } from 'react';
import { useAppStore, AppState, TableEntry } from '@/store/useAppStore';

export function SchemaBrowser() {
  const selectedDatabase = useAppStore((state: AppState) => state.selectedDatabase);
  const tables = useAppStore((state: AppState) => state.tables);
  const fetchTables = useAppStore((state: AppState) => state.fetchTablesForSelectedDB);
  const isLoading = useAppStore((state: AppState) => state.isLoadingSchema);
  const error = useAppStore((state: AppState) => state.schemaError);

  useEffect(() => {
    if (selectedDatabase) {
      fetchTables();
    }
    // Add fetchTables to dependency array if your linter requires it,
    // but be mindful of potential infinite loops if the function identity changes.
    // Zustand selectors usually return stable functions if defined outside the render.
  }, [selectedDatabase, fetchTables]);

  return (
    <div className="p-2 h-full overflow-y-auto">
      <h3 className="mb-2 text-lg font-semibold">Schema Browser</h3>
      {!selectedDatabase && <p className="text-sm text-gray-500">Select a database first.</p>}
      {isLoading && selectedDatabase && <p>Loading tables...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!isLoading && !error && selectedDatabase && (
        <ul>
          {tables.length === 0 && <li>No tables found.</li>}
          {tables.map((table: TableEntry) => (
            <li key={table.name} className="text-sm hover:bg-gray-100 p-1 rounded cursor-pointer">
              {table.name} ({table.type})
              {/* TODO: Add functionality to fetch/display schema on click */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
