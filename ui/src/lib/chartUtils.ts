// Basic data transformation utilities for charting

type DataRow = Record<string, any>;
export type AggregationType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'none';

/**
 * Aggregates data based on a group-by key and specified aggregation types for metric columns.
 */
export function aggregateData(
  data: DataRow[],
  groupBy: string | null,
  yAxes: string[],
  aggregation: AggregationType | null
): DataRow[] {
  if (!groupBy || !aggregation || aggregation === 'none' || yAxes.length === 0) {
    return data; // Return original data if no aggregation needed
  }

  const groupedData: Record<string, { groupValue: any; metrics: Record<string, number[]>; count: number }> = {};

  // Group data and collect metrics
  data.forEach(row => {
    const groupValue = row[groupBy];
    const key = String(groupValue); // Use string representation for object keys

    if (!groupedData[key]) {
      groupedData[key] = { groupValue, metrics: {}, count: 0 };
      yAxes.forEach(axis => groupedData[key].metrics[axis] = []);
    }

    groupedData[key].count++;
    yAxes.forEach(axis => {
      const value = parseFloat(row[axis]); // Attempt to parse as number
      if (!isNaN(value)) {
        groupedData[key].metrics[axis].push(value);
      }
    });
  });

  // Calculate aggregated values
  const aggregatedResult: DataRow[] = Object.values(groupedData).map(group => {
    const resultRow: DataRow = { [groupBy]: group.groupValue };

    yAxes.forEach(axis => {
      const values = group.metrics[axis];
      if (values.length === 0 && aggregation !== 'count') {
        resultRow[axis] = null; // Or 0, depending on desired behavior
        return;
      }

      switch (aggregation) {
        case 'sum':
          resultRow[axis] = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'average':
          resultRow[axis] = values.reduce((sum, val) => sum + val, 0) / values.length;
          break;
        case 'count':
          // Count might differ per metric if some had non-numeric values
          // Here we use the count of valid numbers for that specific metric
          resultRow[axis] = values.length;
          // Alternative: Use group.count for total rows in group
          // resultRow[axis] = group.count;
          break;
        case 'min':
          resultRow[axis] = Math.min(...values);
          break;
        case 'max':
          resultRow[axis] = Math.max(...values);
          break;
        default:
          resultRow[axis] = null; // Should not happen if aggregation is not 'none'
      }
    });
    return resultRow;
  });

  return aggregatedResult;
}

// Add other utility functions here if needed (e.g., for Pie chart formatting)

// Pie Chart Label Rendering
// NOTE: Returns string, not JSX, as this is a .ts file.
const RADIAN = Math.PI / 180;
interface CustomizedLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  index: number;
}
export const renderCustomizedPieLabel = ({ percent }: CustomizedLabelProps): string | null => {
  // Don't render label if percent is too small
  if (percent < 0.02) {
    return null;
  }
  return `${(percent * 100).toFixed(0)}%`;
  // Original JSX version (requires .tsx file):
  /*
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
  */
};
