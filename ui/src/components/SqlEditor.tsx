// Import the standalone Monaco editor component
import { SqlMonacoEditor } from '@sqlrooms/sql-editor';
import { TableColumn, DataTable } from '@sqlrooms/duckdb';
import { useAppStore, useActiveTabData } from '@/store/useAppStore';
import React, { useRef } from 'react';
import { useDrop } from 'react-dnd';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Define item types matching the draggable source
const ItemTypes = {
  SCHEMA_ITEM: 'schemaItem',
};

export function SqlEditor() {
  // --- Hooks MUST be called unconditionally at the top ---
  const activeTab = useActiveTabData();
  const updateQueryInTab = useAppStore((state) => state.updateQueryInTab);
  const allTableSchemas = useAppStore((state) => state.tableSchemas); // Keep global schemas
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Fetch the schemas relevant to the currently selected database
  const editorSchemaArray: DataTable[] = React.useMemo(() => {
    // Note: This depends on allTableSchemas which comes from the store hook above.
    // If activeTab changed, allTableSchemas might also change via setSelectedDatabase.
    // The dependency array correctly captures allTableSchemas.
    return Object.values(allTableSchemas).map(schema => ({
      tableName: schema.table_name,
      columns: schema.columns.map((col): TableColumn => ({
        name: col.name,
        type: col.data_type,
      })),
    }));
  }, [allTableSchemas]);

  // --- Drop Target Hook ---
  const [{ canDrop, isOver }, dropRef] = useDrop(() => ({
    accept: ItemTypes.SCHEMA_ITEM,
    drop: (item: { name: string; type: string }) => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      const position = editor.getPosition();
      if (position) {
        editor.executeEdits('dnd-insert', [
          {
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: item.name,
            forceMoveMarkers: true,
          },
        ]);
        editor.focus();
      }
      console.log(`Dropped: ${item.name} (${item.type})`);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop(),
    }),
  }), [editorRef]); // Dependency on editorRef is fine as it's stable
  // --- End Hooks ---

  // Guard if no active tab - Now safe to call *after* hooks
  if (!activeTab) return <div className="p-4 text-muted-foreground">No active tab selected.</div>;

  const { id: activeTabId, query: currentQuery } = activeTab;

  // Callback for when the editor instance is mounted
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    // Attach the drop ref to the editor's DOM node
    // Note: Accessing DOM node might depend on SqlMonacoEditor implementation
    // If SqlMonacoEditor doesn't expose the node ref, this might need adjustment
    // or wrapping SqlMonacoEditor in a div and applying dropRef to the div.
    const editorDomNode = editor.getDomNode();
    if (editorDomNode) {
      dropRef(editorDomNode);
    }
  };

  const handleEditorChange = (newValue: unknown) => {
    if (typeof newValue === 'string') {
      updateQueryInTab(activeTabId, newValue);
    } else {
      console.warn('Unexpected value type from SqlEditor onChange:', typeof newValue);
    }
  };

  return (
    // Use a key based on activeTabId to force re-mount/reset of Monaco instance on tab change?
    // Might be necessary if editor state doesn't update correctly otherwise.
    // <div key={activeTabId} className={`h-full ... `}>
    <div className={`h-full w-full flex flex-col ${isOver && canDrop ? 'bg-primary/10' : ''}`}> {/* Highlight on hover */}
      {/* Editor area */}
      {/* Remove margin/border if parent handles spacing */}
      <div className="flex-grow relative">
        <SqlMonacoEditor
          // Key might help reset internal state on tab switch
          key={activeTabId}
          value={currentQuery} // Use query from active tab
          onChange={handleEditorChange}
          tableSchemas={editorSchemaArray} // Pass schemas (assuming this is correct)
          height="300px" // Let flexbox handle height
          onMount={handleEditorDidMount} // Capture editor instance
          options={{
            fontSize: 18, // Set font size
            minimap: { enabled: false } // Optionally disable minimap
          }}
        // Ensure editor uses available space
        // Consider adding options like language based on selected DB type
        // language={dbType === 'postgres' ? 'pgsql' : 'sql'}
        />
      </div>

    </div>
  );
}
