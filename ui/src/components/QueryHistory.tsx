import { useAppStore, AppState } from '@/store/useAppStore';

export function QueryHistory() {
  const queryHistory = useAppStore((state: AppState) => state.queryHistory);
  const setCurrentQuery = useAppStore((state: AppState) => state.setCurrentQuery);

  if (!queryHistory || queryHistory.length === 0) {
    return <p className="text-sm text-gray-500 p-2">No query history yet.</p>;
  }

  return (
    <div className="p-1 border-t">
      <h4 className="mb-1 text-xs font-medium text-gray-500 uppercase">History</h4>
      <ul className="space-y-1 max-h-24 overflow-y-auto"> {/* Limit height and allow scroll */}
        {queryHistory.map((query: string, index: number) => (
          <li key={index}
            className="text-xs p-1 hover:bg-gray-100 rounded cursor-pointer truncate"
            title={query} // Show full query on hover
            onClick={() => setCurrentQuery(query)} // Set as current query on click
          >
            {query}
          </li>
        ))}
      </ul>
    </div>
  );
}
