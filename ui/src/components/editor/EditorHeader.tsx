// Removed unused React import
// import React from 'react';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import { Button } from "@/components/ui/button";
import { Play, Database, TextQuote } from "lucide-react"; // Icons
import { format } from 'sql-formatter'; // Import formatter

export function EditorHeader() {
  // Global state needed
  const selectedDatabase = useAppStore((state) => state.selectedDatabase);

  // Active tab state needed
  const activeTab = useActiveTabData(); // Get current active tab data
  const executeQueryForTab = useAppStore((state) => state.executeQueryForTab);
  const updateQueryInTab = useAppStore((state) => state.updateQueryInTab);

  // Guard against no active tab (shouldn't happen with init logic)
  if (!activeTab) return <div className="p-2 border-b bg-muted/20 text-muted-foreground text-sm">No active query tab</div>;

  const { id: activeTabId, query: currentQuery, isRunning: isQueryRunning } = activeTab;

  const handleFormatQuery = () => {
    try {
      const formattedQuery = format(currentQuery, { language: 'sql' });
      // Update query in the specific active tab
      updateQueryInTab(activeTabId, formattedQuery);
    } catch (error) {
      console.error("Failed to format query:", error);
    }
  };

  const handleExecuteQuery = () => {
    // Execute query for the specific active tab
    executeQueryForTab(activeTabId);
  };

  return (
    <div className="p-2 flex items-center justify-between border-b bg-muted/20">
      {/* Left side: Selected Database */}
      <div className="flex items-center space-x-2">
        <Database size={16} className="text-muted-foreground" />
        {selectedDatabase ? (
          <span className="text-sm font-medium">{selectedDatabase}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">No database selected</span>
        )}
      </div>

      {/* Right side: Buttons */}
      <div className="flex items-center space-x-2">
        {/* Format Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleFormatQuery}
          title="Format Query"
          disabled={!currentQuery} // Disable if no query in active tab
        >
          <TextQuote size={16} />
        </Button>
        {/* Execute Button */}
        <Button
          onClick={handleExecuteQuery} // Use specific handler
          disabled={isQueryRunning || !selectedDatabase || !currentQuery}
          size="sm"
        >
          <Play size={16} className={`mr-2 ${isQueryRunning ? 'animate-spin' : ''}`} />
          {isQueryRunning ? 'Running...' : 'Execute Query'}
        </Button>
        {/* Add other controls here later (e.g., Cancel, Format) */}
      </div>
    </div>
  );
}
