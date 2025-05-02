import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define supported chart types
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area';

interface ChartTypeSelectorProps {
  availableTypes: ChartType[];
  selectedType: ChartType | null;
  onTypeChange: (type: ChartType) => void;
}

export function ChartTypeSelector({
  availableTypes,
  selectedType,
  onTypeChange,
}: ChartTypeSelectorProps) {
  // Don't render if no types are available
  if (!availableTypes || availableTypes.length === 0) {
    return null;
  }

  // Format type names for display
  const formatTypeName = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Select
      value={selectedType || ''} // Use empty string if null for Select
      onValueChange={(value) => onTypeChange(value as ChartType)} // Cast back to ChartType
    >
      <SelectTrigger className="w-[180px] h-8 text-xs">
        <SelectValue placeholder="Select chart type" />
      </SelectTrigger>
      <SelectContent>
        {availableTypes.map((type) => (
          <SelectItem key={type} value={type} className="text-xs">
            {formatTypeName(type)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
