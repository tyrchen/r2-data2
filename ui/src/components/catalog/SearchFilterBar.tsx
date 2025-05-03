import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input"; // Correct path for shadcn/ui
import { Button } from "@/components/ui/button"; // Import Button
import { RefreshCw } from "lucide-react"; // Import Refresh icon
import debounce from 'lodash.debounce';

interface SearchFilterBarProps {
  onSearchChange: (term: string) => void;
  placeholder?: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export function SearchFilterBar({
  onSearchChange,
  placeholder = "Search...",
  onRefresh,
  isLoading
}: SearchFilterBarProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Use useRef to hold the debounced function to avoid dependency issues
  const debouncedSearchRef = useRef(
    debounce((term: string) => {
      onSearchChange(term);
    }, 300)
  );

  useEffect(() => {
    // Update the debounced function if onSearchChange changes
    debouncedSearchRef.current = debounce((term: string) => {
      onSearchChange(term);
    }, 300);
  }, [onSearchChange]);

  useEffect(() => {
    // Call the debounced function from the ref
    debouncedSearchRef.current(searchTerm);

    // Cleanup the debounced function on component unmount
    return () => {
      debouncedSearchRef.current.cancel();
    };
  }, [searchTerm]); // Only depends on searchTerm now

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
      <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading} title="Refresh Schema">
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
