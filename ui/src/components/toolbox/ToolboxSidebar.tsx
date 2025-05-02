import React, { forwardRef } from 'react';
import { Save, History, Settings } from 'lucide-react'; // Import actual icons
// Import Tooltip components
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SaveQueryDialog } from './SaveQueryDialog'; // Import the dialog
import { QueryHistoryPanel } from './QueryHistoryPanel'; // Import the panel

interface ActionItemProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

// Updated Action Item with Tooltip and forwardRef
const ActionItem = forwardRef<
  HTMLButtonElement, // Type of the element the ref points to (the button)
  ActionItemProps
>(({ icon: Icon, label, onClick }, ref) => {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref} // Forward the ref to the button element
            onClick={onClick}
            className="flex flex-col items-center justify-center p-2 space-y-1 rounded hover:bg-accent w-full text-xs"
            aria-label={label} // Add aria-label for accessibility
          >
            <Icon className="h-5 w-5 text-muted-foreground" />
            {/* Hide label visually, show in tooltip */}
            {/* <span className="text-muted-foreground">{label}</span> */}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ActionItem.displayName = 'ActionItem'; // Add display name for better debugging

// Main Toolbox Sidebar Component
export function ToolboxSidebar() {
  const handleSettings = () => console.log('Settings clicked');

  return (
    <div className="h-full flex flex-col items-center p-1 space-y-2 bg-muted/40">
      {/* Wrap Save ActionItem with SaveQueryDialog */}
      <SaveQueryDialog>
        {/* Pass the ActionItem as the child trigger */}
        <ActionItem icon={Save} label="Save Query" />
        {/* onClick is handled by DialogTrigger now */}
      </SaveQueryDialog>

      {/* Wrap History ActionItem with QueryHistoryPanel */}
      <QueryHistoryPanel>
        {/* Pass the ActionItem as the child trigger */}
        <ActionItem icon={History} label="Query History" />
        {/* onClick is handled by SheetTrigger now */}
      </QueryHistoryPanel>

      <ActionItem icon={Settings} label="Settings" onClick={handleSettings} />

      {/* Add User controls/spacer at the bottom if needed */}
      <div className="mt-auto">{/* Spacer */}</div>
    </div>
  );
}
