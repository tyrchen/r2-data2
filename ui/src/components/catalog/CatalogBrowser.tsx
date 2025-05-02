import React from 'react';
import { SearchFilterBar } from './SearchFilterBar';
import { DatabaseTree } from './DatabaseTree.tsx';
import { useAppStore } from '@/store/useAppStore';

export function CatalogBrowser() {
  // TODO: Connect search term to actual filtering logic in DatabaseTree
  const [filterTerm, setFilterTerm] = React.useState('');

  const handleSearchChange = (term: string) => {
    console.log("Search term:", term);
    setFilterTerm(term);
  };

  // Refresh action - Fetches databases and selected DB's tables
  const handleRefresh = async () => {
    console.log("Refresh clicked");
    const fetchDatabases = useAppStore.getState().fetchAvailableDatabases;
    const fetchTables = useAppStore.getState().fetchTablesForSelectedDB;
    await fetchDatabases(); // Re-fetch databases
    // Re-fetch tables only if a database is selected
    if (useAppStore.getState().selectedDatabase) {
      await fetchTables();
    }
  };

  return (
    // Use flex-col and h-full to manage height
    <div className="h-full flex flex-col bg-background">
      {/* Non-scrolling header area for search/refresh */}
      <div className="flex-shrink-0">
        <SearchFilterBar
          onSearchChange={handleSearchChange}
          onRefresh={handleRefresh}
          placeholder="Search databases, tables..."
        />
      </div>
      {/* Scrollable area for the tree */}
      <div className="flex-grow overflow-y-auto">
        <DatabaseTree filterTerm={filterTerm} />
      </div>
    </div>
  );
}
