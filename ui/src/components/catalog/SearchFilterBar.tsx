import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input"; // Correct path for shadcn/ui
import { Button } from "@/components/ui/button"; // Import Button
import { RefreshCw } from "lucide-react"; // Import Refresh icon
import debounce from 'lodash.debounce';
import { useAppStore } from '@/store/useAppStore'; // Import store to get loading state

interface SearchFilterBarProps {
  onSearchChange: (term: string) => void;
  placeholder?: string;
}

export function SearchFilterBar({
  onSearchChange,
  placeholder = "Search...",
}: SearchFilterBarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce the callback function
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      onSearchChange(term);
    }, 300),
    [onSearchChange]
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
      <Button variant="outline" size="icon">
        <RefreshCw className="h-4 w-4 animate-spin" />
      </Button>
    </div>
  );
}
