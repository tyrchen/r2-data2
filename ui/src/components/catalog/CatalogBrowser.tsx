import React from 'react';
import { SearchFilterBar } from './SearchFilterBar';
import { DatabaseTree } from './DatabaseTree.tsx';
import { useAppStore } from '@/store/useAppStore';

export function CatalogBrowser() {
  // TODO: Connect search term to actual filtering logic in DatabaseTree
  const [filterTerm, setFilterTerm] = React.useState('');
  const isLoading = useAppStore((state) => state.isFetchingFullSchema);
  const error = useAppStore((state) => state.fullSchemaError);
  const fetchFullSchema = useAppStore((state) => state.fetchFullSchema);

  const handleSearchChange = (term: string) => {
    console.log("Search term:", term);
    setFilterTerm(term);
  };

  return (
    // Use flex-col and h-full to manage height
    <div className="h-full flex flex-col bg-background p-1">
      {/* Non-scrolling header area for search/refresh */}
      <div className="flex-shrink-0 mb-1">
        <SearchFilterBar
          onSearchChange={handleSearchChange}
          placeholder="Search databases, tables..."
          onRefresh={fetchFullSchema}
          isLoading={isLoading}
        />
      </div>
      {/* Scrollable area for the tree */}
      <div className="flex-grow overflow-y-auto border rounded-sm">
        <DatabaseTree filterTerm={filterTerm} />
      </div>
    </div>
  );
}
