import React from 'react';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import { ChartTypeSelector, ChartType } from "@/components/viz/ChartTypeSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const AGGREGATION_TYPES = ['none', 'sum', 'average', 'count', 'min', 'max'];
const availableChartTypes: ChartType[] = ['bar', 'line', 'pie', 'area', 'scatter'];

export function ChartConfigPanel() {
  const activeTab = useActiveTabData();
  const chartConfig = useAppStore((state) => state.chartConfig);
  const setChartConfig = useAppStore((state) => state.setChartConfig);
  const selectedChartType = useAppStore((state) => state.selectedChartType);
  const setSelectedChartType = useAppStore((state) => state.setSelectedChartType);

  const availableColumns = React.useMemo(() => {
    const data = activeTab?.result?.result;
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  }, [activeTab?.result?.result]);

  // --- DEBUG: Log yAxes state ---
  React.useEffect(() => {
    console.log("Current yAxes in ChartConfigPanel:", chartConfig.yAxes);
  }, [chartConfig.yAxes]);
  // --- END DEBUG ---

  const handleXAxisChange = (value: string) => {
    setChartConfig({ ...chartConfig, xAxis: value });
  };

  const handleYAxesChange = (column: string, checked: boolean | string) => {
    const currentYAxes = chartConfig.yAxes || [];
    let newYAxes;
    if (checked) {
      newYAxes = [...currentYAxes, column];
    } else {
      newYAxes = currentYAxes.filter((axis) => axis !== column);
    }
    setChartConfig({ ...chartConfig, yAxes: newYAxes, yAxis: newYAxes[0] || null });
  };

  const handleAggregationChange = (value: string) => {
    const newGroupBy = value !== 'none' ? chartConfig.xAxis : null;
    setChartConfig({ ...chartConfig, aggregation: value === 'none' ? null : value, groupBy: newGroupBy });
  };

  const handleLabelKeyChange = (value: string) => {
    setChartConfig({ ...chartConfig, labelKey: value });
  };

  const handleValueKeyChange = (value: string) => {
    setChartConfig({ ...chartConfig, valueKey: value });
  };

  if (availableColumns.length === 0) {
    return (
      <div className="p-2 space-y-2 border-l w-64 flex-shrink-0">
        <h4 className="text-sm font-bold mb-2">Chart Configuration</h4>
        <p className="text-xs text-muted-foreground">No data to configure.</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2 border-l w-64 flex-shrink-0 overflow-y-auto">
      <h4 className="text-sm font-bold mb-2">Chart Configuration</h4>

      <div className="space-y-1">
        <Label htmlFor="chart-type-select">Chart Type</Label>
        <ChartTypeSelector
          availableTypes={availableChartTypes}
          selectedType={selectedChartType}
          onTypeChange={setSelectedChartType}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="x-axis-select">X-Axis</Label>
        <Select value={chartConfig.xAxis ?? ''} onValueChange={handleXAxisChange}>
          <SelectTrigger id="x-axis-select">
            <SelectValue placeholder="Select X Axis" />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map((col) => (
              <SelectItem key={`x-${col}`} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Y-Axis / Metrics</Label>
        <div className="space-y-1 pl-2 max-h-60 overflow-y-auto">
          {availableColumns.map((col) => (
            <div key={`y-${col}`} className="flex items-center space-x-2">
              <Checkbox
                id={`y-checkbox-${col}`}
                checked={chartConfig.yAxes?.includes(col)}
                onCheckedChange={(checked) => handleYAxesChange(col, checked)}
              />
              <Label htmlFor={`y-checkbox-${col}`} className="text-sm font-normal">
                {col}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="aggregation-select">Aggregation</Label>
        <Select value={chartConfig.aggregation ?? 'none'} onValueChange={handleAggregationChange}>
          <SelectTrigger id="aggregation-select">
            <SelectValue placeholder="Select Aggregation" />
          </SelectTrigger>
          <SelectContent>
            {AGGREGATION_TYPES.map((agg) => (
              <SelectItem key={`agg-${agg}`} value={agg}>{agg}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedChartType === 'pie' && (
        <>
          <div className="space-y-1">
            <Label htmlFor="label-key-select">Label Column (Pie)</Label>
            <Select value={chartConfig.labelKey ?? ''} onValueChange={handleLabelKeyChange}>
              <SelectTrigger id="label-key-select">
                <SelectValue placeholder="Select Label Column" />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((col) => (
                  <SelectItem key={`label-${col}`} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="value-key-select">Value Column (Pie)</Label>
            <Select value={chartConfig.valueKey ?? ''} onValueChange={handleValueKeyChange}>
              <SelectTrigger id="value-key-select">
                <SelectValue placeholder="Select Value Column" />
              </SelectTrigger>
              <SelectContent>
                {availableColumns.map((col) => (
                  <SelectItem key={`value-${col}`} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
