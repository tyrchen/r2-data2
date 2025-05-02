import React from 'react';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table"; // Import the new DataTable
import { ColumnDef } from "@tanstack/react-table"; // Import ColumnDef
import { Button } from "@/components/ui/button"; // For sortable headers
import { ArrowUpDown } from "lucide-react"; // For sortable headers
import { ChartTypeSelector, ChartType } from "@/components/viz/ChartTypeSelector"; // Import selector
import { RechartsRenderer } from "./viz/RechartsRenderer"; // Import the new renderer
import { ChartConfigPanel } from "./viz/ChartConfigPanel"; // Import the config panel

// Generic type for row data
type ResultRow = Record<string, any>;

// Helper to generate columns dynamically for DataTable
const generateColumns = (data: ResultRow[]): ColumnDef<ResultRow>[] => {
  if (!data || data.length === 0) {
    return [];
  }

  const columnKeys = Object.keys(data[0]);

  return columnKeys.map((key) => ({
    accessorKey: key,
    header: ({ column }) => {
      // Make header sortable
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          {key}
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const value = row.getValue(key);
      // Simple rendering, handle complex types if needed
      return (
        <div className="text-sm">
          {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? 'NULL')}
        </div>
      );
    },
  }));
};

export function ResultViewer() {
  // Get active tab data
  const activeTab = useActiveTabData();

  // Global UI state (could be moved to tab state if needed)
  const showVisualization = useAppStore((state) => state.showVisualization);
  const setShowVisualization = useAppStore((state) => state.setShowVisualization);
  const selectedChartType = useAppStore((state) => state.selectedChartType);
  const setSelectedChartType = useAppStore((state) => state.setSelectedChartType);

  // Guard if no active tab
  if (!activeTab) return <div className="p-4 text-muted-foreground">No active tab selected.</div>;

  // Destructure state from the active tab
  const {
    result: queryResult,
    error: queryError,
    isRunning: isQueryRunning
  } = activeTab;

  // Memoize column generation
  const columns = React.useMemo(() => {
    const results = queryResult?.result;
    return results ? generateColumns(results) : [];
  }, [queryResult]);

  const data = React.useMemo(() => queryResult?.result || [], [queryResult]);

  // Get row count
  const rowCount = data.length;
  // Placeholder for execution time - needs to be added to store/queryResult
  const executionTime = queryResult?.executionTime; // Example: Assume it exists

  const renderContent = () => {
    if (isQueryRunning) {
      return <div className="p-4 text-center">Running query...</div>;
    }
    if (queryError) {
      return <div className="p-4 text-destructive text-center">Error: {queryError}</div>;
    }
    if (!queryResult) {
      return <div className="p-4 text-center text-muted-foreground">Run a query to see results here.</div>;
    }

    if (showVisualization) {
      // Render chart and config panel side-by-side
      return (
        <div className="flex h-full w-full">
          <div className="flex-grow h-full">
            <RechartsRenderer data={data} chartType={selectedChartType} />
          </div>
          <ChartConfigPanel />
        </div>
      );
    }

    // Handle non-SELECT results
    if (queryResult?.message) { // Check queryResult directly
      return (
        <div className="p-4">
          <p>{queryResult.message}</p>
          {typeof queryResult.affectedRows === 'number' && (
            <p className="text-sm text-muted-foreground">Rows affected: {queryResult.affectedRows}</p>
          )}
          {/* Display execution time if available */}
          {typeof executionTime === 'number' && (
            <p className="text-xs text-muted-foreground mt-1">Execution Time: {executionTime.toFixed(3)}s</p>
          )}
        </div>
      );
    }

    // Handle SELECT results
    if (!data || data.length === 0) {
      return (
        <div className="p-4 text-center">
          Query executed successfully, but returned no rows.
          {typeof executionTime === 'number' && (
            <p className="text-xs text-muted-foreground mt-1">Execution Time: {executionTime.toFixed(3)}s</p>
          )}
        </div>
      );
    }

    // Render DataTable for SELECT results
    return <DataTable columns={columns} data={data} />;
  };

  // Define available chart types (adjust as needed)
  const availableChartTypes: ChartType[] = ['bar', 'line', 'pie', 'area', 'scatter'];

  return (
    <div className="p-2 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        {/* Header Section */}
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Result Viewer</h3>
          {/* Display Stats only for SELECT results with data */}
          {data.length > 0 && !queryResult?.message && (
            <span className="text-sm text-muted-foreground">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'}
              {typeof executionTime === 'number' && ` in ${executionTime.toFixed(3)}s`}
            </span>
          )}
        </div>
        {/* Controls Section (Toggle & Chart Selector) */}
        {data.length > 0 && !queryResult?.message && (
          <div className="flex items-center space-x-4">
            {/* Chart Type Selector - only visible when visualization is active */}
            {showVisualization && (
              <ChartTypeSelector
                availableTypes={availableChartTypes}
                selectedType={selectedChartType}
                onTypeChange={setSelectedChartType}
              />
            )}
            {/* Visualization Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="visualization-toggle"
                checked={showVisualization}
                onCheckedChange={setShowVisualization}
              />
              <Label htmlFor="visualization-toggle">Visualize</Label>
            </div>
          </div>
        )}
      </div>
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}
