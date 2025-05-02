import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input"; // Correct path for shadcn/ui
import { Button } from "@/components/ui/button"; // Import Button
import { RefreshCw } from "lucide-react"; // Import Refresh icon
import debounce from 'lodash.debounce';
import { useAppStore } from '@/store/useAppStore'; // Import store to get loading state

interface SearchFilterBarProps {
  onSearchChange: (searchTerm: string) => void;
  onRefresh: () => Promise<void>;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchFilterBar({
  onSearchChange,
  onRefresh,
  placeholder = "Search schemas...", // Updated placeholder
  debounceMs = 300,
}: SearchFilterBarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const isLoading = useAppStore((state) => state.isLoadingSchema); // Get loading state

  // Debounce the callback function
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      onSearchChange(term);
    }, debounceMs),
    [onSearchChange, debounceMs]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
    // Cleanup the debounced function on component unmount
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <div className="p-2 flex items-center space-x-2 border-b">
      {/* Search Input */}
      <Input
        type="search" // Use type="search" for better semantics and potential browser features
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleInputChange}
        className="flex-grow"
      />
      {/* Refresh Button */}
      <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading}>
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
