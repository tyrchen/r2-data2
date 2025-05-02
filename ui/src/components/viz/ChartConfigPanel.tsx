import React from 'react';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
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

export function ChartConfigPanel() {
  const activeTab = useActiveTabData();
  const { chartConfig, setChartConfig, selectedChartType } = useAppStore((state) => ({
    chartConfig: state.chartConfig,
    setChartConfig: state.setChartConfig,
    selectedChartType: state.selectedChartType,
  }));
  // Determine available columns from the active tab's data
  const availableColumns = React.useMemo(() => {
    const data = activeTab?.result?.result;
    if (data && data.length > 0) {
      return Object.keys(data[0]);
    }
    return [];
  }, [activeTab?.result?.result]);

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

  // Render only if there are columns to configure
  if (availableColumns.length === 0) {
    return null; // Or a message indicating no data for configuration
  }

  return (
    <div className="p-2 space-y-2 border-l">
      <h4 className="text-sm font-medium mb-2">Chart Configuration</h4>
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

      {/* Y Axes Selection (Checkboxes) */}
      <div className="space-y-1">
        <Label>Y-Axis / Metrics</Label>
        <div className="space-y-1 pl-2 max-h-40 overflow-y-auto">
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

      {/* Aggregation Selection */}
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

      {/* Conditional Pie Chart Config */}
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

      {/* Add more controls here (e.g., aggregation, color) */}
    </div>
  );
}
