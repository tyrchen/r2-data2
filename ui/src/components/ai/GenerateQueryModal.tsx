import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  // DialogTrigger, // Trigger is handled externally
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from '@/store/useAppStore'; // Import the store
// No shallow import needed
import { Loader2 } from "lucide-react"; // Import loader icon

export function GenerateQueryModal() {
  // Get state and actions individually
  const isGenerateQueryModalOpen = useAppStore((state) => state.isGenerateQueryModalOpen);
  const closeGenerateQueryModal = useAppStore((state) => state.closeGenerateQueryModal);
  const generateQueryPrompt = useAppStore((state) => state.generateQueryPrompt);
  const setGenerateQueryPrompt = useAppStore((state) => state.setGenerateQueryPrompt);
  const generateQuery = useAppStore((state) => state.generateQuery);
  const generateQueryLoading = useAppStore((state) => state.generateQueryLoading);
  const generateQueryError = useAppStore((state) => state.generateQueryError);

  const handleGenerate = () => {
    if (!generateQueryPrompt.trim() || generateQueryLoading) return;
    generateQuery();
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGenerateQueryPrompt(event.target.value);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      closeGenerateQueryModal();
    }
    // Opening is handled by the trigger elsewhere (button/shortcut)
  };

  return (
    // Use state variable for open prop and connect onOpenChange
    <Dialog open={isGenerateQueryModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Generate SQL with AI</DialogTitle>
          <DialogDescription>
            Describe what data you want to query in plain language. The AI will attempt to generate the corresponding SQL.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 gap-4 items-center">
            <Label htmlFor="prompt" className="text-left sr-only">
              Prompt
            </Label>
            <Textarea
              id="prompt"
              placeholder="e.g., Show me all users who joined last month, ordered by name."
              value={generateQueryPrompt}
              onChange={handlePromptChange}
              className="col-span-3 min-h-[100px]"
              disabled={generateQueryLoading}
            />
          </div>
          {/* Display error message if present */}
          {generateQueryError && <p className="text-sm text-destructive">Error: {generateQueryError}</p>}
        </div>
        <DialogFooter>
          {/* Show loading indicator in button */}
          <Button
            variant="outline"
            type="button"
            onClick={handleGenerate}
            disabled={generateQueryLoading || !generateQueryPrompt.trim()}
          >
            {generateQueryLoading && (
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
            )}
            {generateQueryLoading ? "Generating..." : "Generate SQL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
