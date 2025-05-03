import React from 'react';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import { DataTable } from "@/components/ui/data-table"; // Import the new DataTable
import { ColumnDef } from "@tanstack/react-table"; // Import ColumnDef
import { Button } from "@/components/ui/button"; // For sortable headers
import { ArrowUpDown } from "lucide-react"; // For sortable headers
import { RechartsRenderer } from "./viz/RechartsRenderer"; // Import the new renderer
import { ChartConfigPanel } from "./viz/ChartConfigPanel"; // Import the config panel
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs
import { QueryPlanViewer } from "./viz/QueryPlanViewer"; // Import Plan Viewer

// Generic type for row data
type ResultRow = Record<string, unknown>;

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
          <ArrowUpDown className="ml-2 w-4 h-4" />
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
  // --- Hooks MUST be called unconditionally at the top ---
  const activeTab = useActiveTabData();
  const selectedChartType = useAppStore((state) => state.selectedChartType);
  const [selectedResultTab, setSelectedResultTab] = React.useState("results");

  // Memoize column generation - moved before the guard clause
  const columns = React.useMemo(() => {
    const results = activeTab?.result?.result;
    return results ? generateColumns(results as ResultRow[]) : []; // Type assertion needed after checking
  }, [activeTab?.result?.result]);

  // Memoize data - moved before the guard clause
  const data = React.useMemo(() => activeTab?.result?.result || [], [activeTab?.result?.result]);
  const planData = activeTab?.result?.plan; // Type is unknown from store, handle in QueryPlanViewer
  // --- End Hooks ---

  // Guard if no active tab - Now safe to call *after* hooks
  if (!activeTab) return <div className="p-4 text-muted-foreground">No active tab selected.</div>;

  // Destructure state *after* the guard clause ensures activeTab exists
  const {
    result: queryResult,
    error: queryError,
    isRunning: isQueryRunning
  } = activeTab;

  // These calculations depend on queryResult which exists if activeTab exists
  const rowCount = data.length;
  const executionTime = queryResult?.executionTime;
  const hasData = data.length > 0;
  const hasPlan = !!planData;

  const renderResultsTabContent = () => {
    if (!hasData) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          {queryResult?.message ? queryResult.message : "Query executed successfully, but returned no rows."}
          {typeof executionTime === 'number' && (
            <p className="mt-1 text-xs">Execution Time: {executionTime.toFixed(3)}s</p>
          )}
        </div>
      );
    }
    return <DataTable columns={columns} data={data} />;
  };

  const renderChartTabContent = () => {
    if (!hasData) {
      return <div className="p-4 text-center text-muted-foreground">No data available for visualization.</div>;
    }
    // Show config panel on left, chart on right
    return (
      <div className="flex overflow-hidden flex-row w-full h-full">
        {/* Config Panel (Left) */}
        <ChartConfigPanel />

        {/* Chart Area (Right) */}
        <div className="flex-grow h-full border-l"> {/* Add border */}
          <RechartsRenderer data={data} chartType={selectedChartType} />
        </div>
      </div>
    );
  };

  const renderPlanTabContent = () => {
    return <QueryPlanViewer planData={planData} />;
  };

  const renderMainContent = () => {
    if (isQueryRunning) {
      return <div className="p-4 text-center">Running query...</div>;
    }
    if (queryError) {
      return <div className="p-4 text-center text-destructive">Error: {queryError}</div>;
    }
    if (!queryResult) {
      return <div className="p-4 text-center text-muted-foreground">Run a query to see results here.</div>;
    }

    // Use Tabs for Results, Chart, and Plan
    return (
      <Tabs value={selectedResultTab} onValueChange={setSelectedResultTab} className="flex flex-col h-full">
        <TabsList className="mb-1">
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="chart" disabled={!hasData}>Chart</TabsTrigger>
          <TabsTrigger value="plan" disabled={!hasPlan}>Explain Plan</TabsTrigger>
        </TabsList>
        <TabsContent value="results" className="overflow-auto flex-grow">
          {renderResultsTabContent()} {/* Render results/viz */}
        </TabsContent>
        <TabsContent value="chart" className="flex overflow-auto flex-col flex-grow">
          {renderChartTabContent()}
        </TabsContent>
        <TabsContent value="plan" className="overflow-auto flex-grow">
          {renderPlanTabContent()}
        </TabsContent>
      </Tabs>
    );
  };


  return (
    <div className="flex flex-col p-2 h-full">
      <div className="flex flex-shrink-0 justify-between items-center mb-2 space-x-4">
        {/* Header Section: Stats ONLY */}
        <div className="flex flex-shrink-0 items-center space-x-4">
          {queryResult && !queryError && (
            <span className="text-sm text-muted-foreground">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'}
              {typeof executionTime === 'number' && ` in ${executionTime.toFixed(3)}s`}
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area (Tabs) */}
      <div className="overflow-auto flex-grow">
        {renderMainContent()}
      </div>
    </div>
  );
}
