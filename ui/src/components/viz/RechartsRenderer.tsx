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
import { aggregateData, AggregationType } from '@/lib/chartUtils'; // Import aggregation utility and type

// Predefined colors for multiple series/pie slices
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#8dd1e1', '#a4de6c', '#d0ed57', '#ffc0cb'];

interface RechartsRendererProps {
  data: Record<string, any>[];
  chartType: ChartType | null;
}

export function RechartsRenderer({ data, chartType }: RechartsRendererProps) {
  // Get chart configuration state from store
  const chartConfig = useAppStore((state) => state.chartConfig);
  const {
    xAxis: xAxisKey,
    yAxes,
    aggregation,
    groupBy,
    labelKey,
    valueKey
  } = chartConfig;

  if (!data || data.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data available for visualization.</div>;
  }

  if (!chartType) {
    return <div className="p-4 text-center text-muted-foreground">Select a chart type.</div>;
  }

  // Check if required configuration is present based on chart type
  const isMultiAxisChart = ['bar', 'line', 'area'].includes(chartType);
  const isPieChart = chartType === 'pie';
  const isScatterChart = chartType === 'scatter';

  if (isMultiAxisChart && (!xAxisKey || !yAxes || yAxes.length === 0)) {
    return <div className="p-4 text-center text-muted-foreground">Please select X-Axis and at least one Y-Axis.</div>;
  }
  if (isPieChart && (!labelKey || !valueKey)) {
    return <div className="p-4 text-center text-muted-foreground">Please select Label and Value columns for Pie Chart.</div>;
  }
  if (isScatterChart && (!xAxisKey || !yAxes || yAxes.length === 0)) {
    return <div className="p-4 text-center text-muted-foreground">Please select X-Axis and at least one Y-Axis for Scatter Plot.</div>;
  }

  // Apply aggregation if configured
  const transformedData = aggregateData(
    data,
    groupBy,
    yAxes || [],
    aggregation as AggregationType | null // Assert type here
  );

  // Ensure data still exists after potential aggregation
  if (!transformedData || transformedData.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">No data remaining after aggregation.</div>;
  }

  // TODO: Handle multiple Y axes scales if needed
  // TODO: Add more sophisticated color handling

  return (
    <ResponsiveContainer width="100%" height="100%">
      <>
        {/* Bar Chart */}
        {chartType === 'bar' && xAxisKey && yAxes && yAxes.length > 0 && (
          <BarChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
            <Tooltip />
            <Legend />
            {yAxes.map((yAxisItem, index) => (
              <Bar
                key={yAxisItem}
                yAxisId="left"
                dataKey={yAxisItem}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </BarChart>
        )}

        {/* Line Chart */}
        {chartType === 'line' && xAxisKey && yAxes && yAxes.length > 0 && (
          <LineChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
            <Tooltip />
            <Legend />
            {yAxes.map((yAxisItem, index) => (
              <Line
                key={yAxisItem}
                yAxisId="left"
                type="monotone"
                dataKey={yAxisItem}
                stroke={COLORS[index % COLORS.length]}
                activeDot={{ r: 8 }}
              />
            ))}
          </LineChart>
        )}

        {/* Area Chart */}
        {chartType === 'area' && xAxisKey && yAxes && yAxes.length > 0 && (
          <AreaChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis yAxisId="left" orientation="left" stroke={COLORS[0]} />
            <Tooltip />
            <Legend />
            {yAxes.map((yAxisItem, index) => (
              <Area
                key={yAxisItem}
                yAxisId="left"
                type="monotone"
                dataKey={yAxisItem}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        )}

        {/* Pie Chart */}
        {chartType === 'pie' && labelKey && valueKey && (
          <PieChart>
            <Pie
              data={transformedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              // label={renderCustomizedLabel} // TODO: Add custom label if needed
              outerRadius="80%" // Adjust radius as needed
              fill="#8884d8"
              dataKey={valueKey}
              nameKey={labelKey}
            >
              {transformedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )}

        {/* Scatter Chart */}
        {chartType === 'scatter' && xAxisKey && yAxes && yAxes.length > 0 && (
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid />
            {/* Assume X axis is numeric for scatter for now */}
            <XAxis type="number" dataKey={xAxisKey} name={xAxisKey} />
            {/* Simple: first Y axis only for now */}
            <YAxis type="number" dataKey={yAxes[0]} name={yAxes[0]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter name="Data Points" data={transformedData} fill="#8884d8">
              {/* TODO: Add ZAxis/coloring later if needed */}
            </Scatter>
          </ScatterChart>
        )}

        {/* Fallback for unimplemented/unconfigured types */}
        {!['bar', 'line', 'area', 'pie', 'scatter'].includes(chartType) && (
          <div className="p-4 text-center text-muted-foreground">
            Chart type '{chartType}' not yet implemented or configuration missing.
          </div>
        )}
      </>
    </ResponsiveContainer>
  );
}
