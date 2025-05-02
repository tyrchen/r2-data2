import { TooltipProps } from 'recharts';
import { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

// Define the props for the custom tooltip
interface CustomTooltipContentProps extends TooltipProps<ValueType, NameType> {
  // Add any extra props you might need, e.g., axis labels
  xAxisLabel?: string;
}

export const CustomTooltip = ({ active, payload, label, xAxisLabel }: CustomTooltipContentProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-md shadow-sm p-2 text-sm">
        <p className="label font-semibold mb-1">{`${xAxisLabel || 'X'}: ${label}`}</p>
        {payload.map((pld, index) => (
          <div key={`item-${index}`} style={{ color: pld.color }}>
            {`${pld.name}: ${pld.value}`}
          </div>
        ))}
      </div>
    );
  }

  return null;
};
