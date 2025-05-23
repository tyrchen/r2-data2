import React from 'react';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import { SqlEditor } from '@/components/SqlEditor';
import { CommandEditor } from './CommandEditor'; // Import CommandEditor
import { JsonEditor } from './JsonEditor';   // Import JsonEditor

export const DynamicEditor: React.FC = () => {
  const selectedDatabase = useAppStore((state) => state.selectedDatabase);
  const fullSchemaData = useAppStore((state) => state.fullSchemaData);
  const { activeTab } = useActiveTabData();
  const updateQueryInTab = useAppStore((state) => state.updateQueryInTab);

  if (!activeTab) {
    return <div className="p-4">No active tab selected.</div>;
  }

  if (!selectedDatabase) {
    return (
      <div className="p-4">
        No database selected. Please select a database to see the editor.
        {/* Render a default editor or a more prominent message */}
        <SqlEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue)} />
      </div>
    );
  }

  if (!fullSchemaData || fullSchemaData.databases.length === 0) {
    return (
      <div className="p-4">
        Schema not loaded yet. Loading editor...
        {/* Render a default editor or a loading state */}
        <SqlEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue)} />
      </div>
    );
  }

  const databaseSchema = fullSchemaData.databases.find(
    (db) => db.name === selectedDatabase
  );

  if (!databaseSchema) {
    return (
      <div className="p-4">
        Schema for {selectedDatabase} not found. Defaulting to SQL editor.
        <SqlEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue)} />
      </div>
    );
  }

  const dbType = databaseSchema.db_type;

  switch (dbType) {
    case 'postgres':
    case 'mysql':
    case 'scylladb': // ScyllaDB uses CQL, which is SQL-like
      return <SqlEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue)} />;
    case 'redis':
      return <CommandEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue)} />;
    case 'opensearch':
      // Ensure onChange for JsonEditor (Monaco) provides string | undefined
      return <JsonEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue || '')} />;
    default:
      return (
        <div className="p-4">
          Unsupported database type: {dbType}. Defaulting to SQL editor.
          <SqlEditor value={activeTab.query} onChange={(newValue) => updateQueryInTab(activeTab.id, newValue)} />
        </div>
      );
  }
};
