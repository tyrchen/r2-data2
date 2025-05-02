import React, { useRef, useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // For inline renaming
import { Plus, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function QueryTabBar() {
  const tabs = useAppStore((state) => state.tabs);
  const activeTabId = useAppStore((state) => state.activeTabId);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const addTab = useAppStore((state) => state.addTab);
  const closeTab = useAppStore((state) => state.closeTab);
  const updateTabName = useAppStore((state) => state.updateTabName);

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input when renaming starts
    if (renamingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renamingTabId]);

  const handleRenameStart = (tabId: string, currentName: string) => {
    setRenamingTabId(tabId);
    setEditName(currentName);
  };

  const handleRenameConfirm = () => {
    if (renamingTabId && editName.trim()) {
      updateTabName(renamingTabId, editName.trim());
    }
    setRenamingTabId(null);
  };

  const handleRenameCancel = () => {
    setRenamingTabId(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleRenameConfirm();
    } else if (event.key === 'Escape') {
      handleRenameCancel();
    }
  };

  // Ensure activeTabId has a valid value for Tabs component
  const validActiveTabId = activeTabId && tabs.some(t => t.id === activeTabId) ? activeTabId : (tabs[0]?.id || '');

  return (
    <div className="flex items-center border-b px-1 py-1 space-x-1">
      <Tabs value={validActiveTabId} onValueChange={setActiveTab} className="flex-grow">
        <TabsList className="h-8">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="h-7 text-xs px-2 relative group"
              onDoubleClick={() => handleRenameStart(tab.id, tab.name)}
            >
              {renamingTabId === tab.id ? (
                <Input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={handleRenameConfirm} // Save on blur
                  onKeyDown={handleKeyDown}
                  className="h-5 px-1 text-xs w-24"
                />
              ) : (
                <span className="truncate max-w-[150px]">{tab.name}</span>
              )}
              {/* Show close button only if more than one tab exists */}
              {tabs.length > 1 && (
                <span
                  role="button"
                  aria-label="Close tab"
                  className="h-4 w-4 absolute top-1/2 right-1 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 inline-flex items-center justify-center rounded-sm hover:bg-muted hover:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <X size={12} />
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* TabsContent is not needed here as content is rendered elsewhere */}
      </Tabs>
      {/* Add New Tab Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0"
        onClick={() => addTab(true)} // Add and activate new tab
        title="New Query Tab"
      >
        <Plus size={16} />
      </Button>
    </div>
  );
}
