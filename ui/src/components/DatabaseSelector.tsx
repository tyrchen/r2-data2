import { useEffect } from 'react';
// Import correct types from store
import { useAppStore, AppState, DatabaseEntry } from '@/store/useAppStore';
// Import shadcn/ui Select components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DatabaseSelector() {
  // Use correct types in hooks
  const databases = useAppStore((state: AppState) => state.availableDatabases);
  const selectedDatabase = useAppStore((state: AppState) => state.selectedDatabase);
  // Use correct action names
  const fetchDatabases = useAppStore((state: AppState) => state.fetchAvailableDatabases);
  const setSelectedDatabase = useAppStore((state: AppState) => state.setSelectedDatabase);

  const isLoading = useAppStore((state: AppState) => state.isLoadingSchema); // Use correct loading state
  const error = useAppStore((state: AppState) => state.schemaError); // Use correct error state
  // Remove local loading/error states as they are now in the store
  // const [isLoading, setIsLoading] = useState(false);
  // const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Call the fetch action from the store
    fetchDatabases();
  }, [fetchDatabases]); // Dependency array includes fetch action from store

  // No separate handler needed for shadcn Select, use setter directly in onValueChange
  // const handleSelectChange = (value: string) => {
  //   setSelectedDatabase(value);
  // };

  return (
    <div className="p-2">
      <h3 className="mb-2 text-lg font-semibold">Select Database</h3>
      {isLoading && <p>Loading databases...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      {!isLoading && !error && (
        <Select value={selectedDatabase || ''} onValueChange={setSelectedDatabase}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a database" />
          </SelectTrigger>
          <SelectContent>
            {databases.map((db: DatabaseEntry) => (
              <SelectItem key={db.name} value={db.name}>
                {db.name} ({db.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        /* Remove the old HTML select and placeholders */
        // <>
        //   <p>Available databases: {databases.map((db: DatabaseEntry) => db.name).join(', ')}</p>
        //   <p>Selected: {selectedDatabase || 'None'}</p>
        //   <select value={selectedDatabase || ''} onChange={(e) => handleSelectChange(e.target.value)} className="mt-2 border p-1">
        //     <option value="" disabled>Select a database</option>
        //     {databases.map((db: DatabaseEntry) => (
        //       <option key={db.name} value={db.name}>{db.name} ({db.type})</option>
        //     ))}
        //   </select>
        // </>
      )}
    </div>
  );
}
