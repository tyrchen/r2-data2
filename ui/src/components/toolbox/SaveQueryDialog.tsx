import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from '@/store/useAppStore';

interface SaveQueryDialogProps {
  children: React.ReactNode;
}

export function SaveQueryDialog({ children }: SaveQueryDialogProps) {
  const [queryName, setQueryName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const currentQuery = useAppStore((state) => state.currentQuery);

  const handleSave = () => {
    console.log(`Saving query as: ${queryName}`);
    console.log(`Query content: ${currentQuery}`);
    setQueryName('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save Query</DialogTitle>
          <DialogDescription>
            Enter a name for your current SQL query to save it for later use.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Active Users Report"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={!queryName.trim()}>Save Query</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
