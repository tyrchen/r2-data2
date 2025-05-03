import { ScrollArea } from '@/components/ui/scroll-area';

interface QueryPlanViewerProps {
  planData: unknown; // Use unknown instead of any
}

export function QueryPlanViewer({ planData }: QueryPlanViewerProps) {
  if (!planData) {
    return <div className="p-4 text-muted-foreground">No query plan available.</div>;
  }

  // Simple JSON stringifier with indentation
  const formattedPlan = JSON.stringify(planData, null, 2);

  return (
    <ScrollArea className="h-full w-full p-2">
      <pre className="text-xs whitespace-pre-wrap break-words">
        {formattedPlan}
      </pre>
    </ScrollArea>
  );
}
