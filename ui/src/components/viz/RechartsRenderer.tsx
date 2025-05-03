import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { useAppStore } from '@/store/useAppStore'; // Import store
import { ChartType } from './ChartTypeSelector';
import { aggregateData, AggregationType, renderCustomizedPieLabel } from '@/lib/chartUtils'; // Import utils
import { CustomTooltip } from './CustomTooltip'; // Import custom tooltip

// Predefined colors for multiple series/pie slices
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#8dd1e1', '#a4de6c', '#d0ed57', '#ffc0cb'];

interface RechartsRendererProps {
  data: Record<string, unknown>[];
  chartType: ChartType | null;
}

// Helper function to check if a value can be treated as a number
function isNumeric(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value);
}

export function RechartsRenderer({ data, chartType }: RechartsRendererProps) {
  const chartConfig = useAppStore((state) => state.chartConfig);
  const { xAxis: xAxisKey, yAxes = [], aggregation, groupBy, labelKey, valueKey } = chartConfig;

  // --- Initial Checks ---
  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data available for visualization.</div>;
  }
  if (!chartType) {
    return <div className="p-4 text-center text-muted-foreground">Select a chart type.</div>;
  }

  // --- Configuration Validation ---
  let configError: string | null = null;
  const isMultiAxisChart = ['bar', 'line', 'area'].includes(chartType);
  const isPieChart = chartType === 'pie';
  const isScatterChart = chartType === 'scatter';

  if (isMultiAxisChart && (!xAxisKey || yAxes.length === 0)) {
    configError = "Please select X-Axis and at least one Y-Axis.";
  }
  if (isPieChart && (!labelKey || !valueKey)) {
    configError = "Please select Label and Value columns for Pie Chart.";
  }
  if (isScatterChart && (!xAxisKey || yAxes.length === 0)) {
    configError = "Please select X-Axis and at least one Y-Axis for Scatter Plot.";
  }

  // --- Aggregation Validation (only if config is otherwise valid) ---
  let requiresAggregation = !!(aggregation && aggregation !== 'none');
  let canAggregate = false;
  let columnsToAggregate: string[] = [];

  if (!configError && requiresAggregation) {
    if (isPieChart && valueKey) {
      // Check if the first row's value for the valueKey is numeric
      if (data.length > 0 && isNumeric(data[0][valueKey])) {
        canAggregate = true;
        columnsToAggregate = [valueKey]; // Aggregate the value column
      } else {
        configError = `Cannot aggregate non-numeric Value column ('${valueKey}') for Pie Chart.`;
        requiresAggregation = false; // Disable aggregation if type is wrong
      }
    } else if (!isPieChart && yAxes.length > 0) {
      // For other charts, check if *all* selected yAxes are numeric
      const allNumeric = yAxes.every(key => data.length > 0 && isNumeric(data[0][key]));
      if (allNumeric) {
        canAggregate = true;
        columnsToAggregate = yAxes;
      } else {
        configError = "Cannot aggregate non-numeric Y-Axis column(s).";
        requiresAggregation = false; // Disable aggregation if types are wrong
      }
    }
  }

  // Render config error if present
  if (configError) {
    return <div className="p-4 text-center text-muted-foreground h-full flex items-center justify-center">{configError}</div>;
  }

  // --- Data Transformation ---
  // Apply aggregation only if valid and required
  const transformedData = (requiresAggregation && canAggregate)
    ? aggregateData(
      data,
      isPieChart ? labelKey : groupBy, // Group by labelKey for Pie, else groupBy (which defaults to xAxis)
      columnsToAggregate, // Use determined numeric columns
      aggregation as AggregationType | null
    )
    : data; // Use raw data if no aggregation or invalid aggregation

  if (!transformedData || transformedData.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data remaining after processing.</div>;
  }

  // --- Chart Rendering ---
  const renderSpecificChart = () => {
    // Declare variables needed in cases outside the switch if possible
    let scatterYKey: string | undefined;

    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey!} />
            <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
            <Tooltip content={<CustomTooltip xAxisLabel={xAxisKey || 'X'} />} />
            <Legend />
            {yAxes.map((yAxisItem, index) => (
              <Bar key={yAxisItem} yAxisId="left" dataKey={yAxisItem} fill={COLORS[index % COLORS.length]} />
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey!} />
            <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
            <Tooltip content={<CustomTooltip xAxisLabel={xAxisKey || 'X'} />} />
            <Legend />
            {yAxes.map((yAxisItem, index) => (
              <Line key={yAxisItem} yAxisId="left" type="monotone" dataKey={yAxisItem} stroke={COLORS[index % COLORS.length]} activeDot={{ r: 8 }} />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey!} />
            <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
            <Tooltip content={<CustomTooltip xAxisLabel={xAxisKey || 'X'} />} />
            <Legend />
            {yAxes.map((yAxisItem, index) => (
              <Area key={yAxisItem} yAxisId="left" type="monotone" dataKey={yAxisItem} stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]} fillOpacity={0.6} />
            ))}
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie data={transformedData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedPieLabel} outerRadius="80%" fill="#8884d8" dataKey={valueKey!} nameKey={labelKey!}>
              {transformedData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip xAxisLabel={labelKey || 'Label'} />} />
            <Legend />
          </PieChart>
        );
      case 'scatter':
        // Ensure yAxis has at least one key for scatter
        scatterYKey = yAxes[0];
        if (!scatterYKey) {
          return <div className="p-4 text-center text-muted-foreground">Please select a Y-Axis for Scatter Plot.</div>;
        }
        return (
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid />
            {/* Assume numeric axes for scatter for now */}
            <XAxis type="number" dataKey={xAxisKey!} name={xAxisKey!} />
            <YAxis type="number" dataKey={scatterYKey} name={scatterYKey} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip xAxisLabel={xAxisKey || 'X'} />} />
            <Legend />
            <Scatter name="Data Points" data={transformedData} fill={COLORS[0]} />
          </ScatterChart>
        );
      default:
        // This case should not be hit due to earlier checks, but acts as a fallback
        return <div className="p-4 text-center text-muted-foreground">Invalid chart type or configuration.</div>;
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      {renderSpecificChart()}
    </ResponsiveContainer>
  );
}
