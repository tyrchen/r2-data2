import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
// import { Button } from "@/components/ui/button"; // Removed unused
import { ScrollArea } from "@/components/ui/scroll-area"; // Use ScrollArea for long history

interface QueryHistoryPanelProps {
  children: React.ReactNode; // The trigger element (e.g., the History button)
}

export function QueryHistoryPanel({ children }: QueryHistoryPanelProps) {
  const queryHistory = useAppStore((state) => state.queryHistory);
  const setCurrentQuery = useAppStore((state) => state.setCurrentQuery);

  const handleSelectQuery = (query: string) => {
    setCurrentQuery(query);
    // Optionally close the sheet after selection
    // document.getElementById('query-history-close')?.click();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="left"> {/* Slide from left */}
        <SheetHeader>
          <SheetTitle>Query History</SheetTitle>
          <SheetDescription>
            Select a previously executed query to load it into the editor.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-150px)] pr-4"> {/* Adjust height as needed */}
          <div className="py-4 space-y-2">
            {queryHistory.length > 0 ? (
              queryHistory.map((query, index) => (
                <div
                  key={index}
                  className="text-xs p-2 border rounded hover:bg-accent cursor-pointer"
                  onClick={() => handleSelectQuery(query)}
                >
                  <pre className="whitespace-pre-wrap break-words font-mono"><code>{query}</code></pre>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground italic text-center pt-4">History is empty.</p>
            )}
          </div>
        </ScrollArea>
        {/* Hidden close button if needed for programmatic closing */}
        {/* <SheetClose id="query-history-close" className="hidden"></SheetClose> */}
      </SheetContent>
    </Sheet>
  );
}
