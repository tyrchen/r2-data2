import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ColumnInfo } from '@/store/useAppStore'; // Assuming ColumnInfo is exported
import { Badge } from "@/components/ui/badge";
import { Key, Link as LinkIcon } from "lucide-react";

interface FieldDetailPopupProps {
  column: ColumnInfo | null;
  children: React.ReactNode; // The trigger element (e.g., the column node text)
  onOpenChange?: (open: boolean) => void;
}

export function FieldDetailPopup({ column, children, onOpenChange }: FieldDetailPopupProps) {
  if (!column) {
    // If no column data, just render the trigger without popover functionality
    return <>{children}</>;
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">{column.name}</h4>
            <p className="text-sm text-muted-foreground">
              Column Details
            </p>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-muted-foreground">Type</span>
              <span className="col-span-2 font-mono">{column.data_type}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-muted-foreground">Nullable</span>
              <span className="col-span-2">
                {column.is_nullable ? (
                  <Badge variant="outline">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )}
              </span>
            </div>
            {column.is_pk && (
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-muted-foreground">Primary Key</span>
                <span className="col-span-2">
                  <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600">
                    <Key size={12} className="mr-1" /> Yes
                  </Badge>
                </span>
              </div>
            )}
            {column.is_unique && (
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-muted-foreground">Unique</span>
                <span className="col-span-2">
                  <Badge variant="outline">Yes</Badge>
                </span>
              </div>
            )}
            {column.fk_table && (
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-muted-foreground">Foreign Key</span>
                <span className="col-span-2 flex items-center space-x-1">
                  <Badge variant="outline" className="border-blue-500 text-blue-600">
                    <LinkIcon size={12} className="mr-1" />
                    {column.fk_table}.{column.fk_column}
                  </Badge>
                </span>
              </div>
            )}
            {/* Add more details as needed, e.g., default value, description */}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
