import React from 'react'; // Add React import
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import { Button } from "@/components/ui/button";
import { Play, Database, TextQuote, Wand2 } from "lucide-react"; // Remove unused Rows icon
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; // Import Label
import { format } from 'sql-formatter'; // Import formatter

export function EditorHeader() {
  // Global state needed
  const selectedDatabase = useAppStore((state) => state.selectedDatabase);
  // Get limit state and setter
  const queryLimit = useAppStore((state) => state.queryLimit);
  const setQueryLimit = useAppStore((state) => state.setQueryLimit);
  // Action to open the AI modal
  const openGenerateQueryModal = useAppStore((state) => state.openGenerateQueryModal);

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
    // Parse and validate the limit from the store
    let finalLimit = 500; // Default limit
    const currentLimit = queryLimit; // Get from store

    if (typeof currentLimit === 'number' && !isNaN(currentLimit)) {
      // Ensure positive and apply max
      finalLimit = Math.max(1, Math.min(currentLimit, 5000));
    } // else, keep the default 500

    // Execute query for the specific active tab, passing the validated limit
    executeQueryForTab(activeTabId, finalLimit);
  };

  const handleLimitChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    // Allow empty input temporarily, parse to number or keep default
    const newLimit = value === '' ? 500 : parseInt(value, 10);
    // Ensure it's a positive number, default to 500 if invalid
    setQueryLimit(isNaN(newLimit) || newLimit <= 0 ? 500 : newLimit);
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

      {/* Right side: Buttons and Limit Input */}
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
        {/* AI Generate Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={openGenerateQueryModal}
          title="Generate SQL with AI (Cmd/Ctrl+K)"
          disabled={!selectedDatabase} // Disable if no DB selected
        >
          <Wand2 size={16} />
        </Button>
        {/* Limit Input */}
        <div className="flex items-center space-x-1.5">
          <Label htmlFor="query-limit" className="text-xs text-muted-foreground whitespace-nowrap">
            Limit:
          </Label>
          <Input
            id="query-limit"
            type="number"
            min="1"
            value={queryLimit} // Use state value
            onChange={handleLimitChange} // Update state on change
            className="h-8 w-20 text-sm px-2" // Adjust size
            disabled={isQueryRunning}
          />
        </div>
        {/* Execute Button */}
        <Button
          variant="outline"
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
