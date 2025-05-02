import React from 'react';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Table,
  Columns,
  Key,
  Link as LinkIcon,
} from 'lucide-react';
import { useAppStore, ColumnInfo } from '@/store/useAppStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FieldDetailPopup } from "./FieldDetailPopup";
import { useDrag } from 'react-dnd';

// Define item types for react-dnd
const ItemTypes = {
  SCHEMA_ITEM: 'schemaItem',
};

// Interface for the tree node structure we'll build
interface TreeNode {
  id: string;
  name: string;
  type: 'database' | 'table' | 'column';
  data?: any; // Store original data (db, table, column info)
  children?: TreeNode[];
}

interface DatabaseTreeProps {
  filterTerm: string;
}

// Helper to create tree nodes from store data
const buildTreeNodes = (
  databases: ReturnType<typeof useAppStore.getState>['availableDatabases'],
  tables: ReturnType<typeof useAppStore.getState>['tables'],
  schemas: ReturnType<typeof useAppStore.getState>['tableSchemas'],
  selectedDatabase: string | null
): TreeNode[] => {
  return databases.map((db) => {
    const dbNode: TreeNode = {
      id: `db-${db.name}`,
      name: db.name,
      type: 'database',
      data: db,
      children: [],
    };

    if (selectedDatabase === db.name) {
      dbNode.children = tables.map((table) => {
        const tableNode: TreeNode = {
          id: `table-${db.name}-${table.name}`,
          name: table.name,
          type: 'table',
          data: table,
          children: [],
        };

        const schema = schemas[table.name];
        if (schema && schema.columns) {
          tableNode.children = schema.columns.map((col) => ({
            id: `col-${db.name}-${table.name}-${col.name}`,
            name: col.name,
            type: 'column',
            data: col,
          }));
        }
        return tableNode;
      });
    }
    return dbNode;
  });
};

// Helper to filter tree nodes
const filterTree = (nodes: TreeNode[], term: string): TreeNode[] => {
  if (!term) return nodes;
  const lowerTerm = term.toLowerCase();

  const filterNode = (node: TreeNode): TreeNode | null => {
    const nameMatch = node.name.toLowerCase().includes(lowerTerm);

    let filteredChildren: TreeNode[] = [];
    if (node.children) {
      filteredChildren = node.children
        .map(filterNode)
        .filter((child): child is TreeNode => child !== null);
    }

    // Keep the node if its name matches OR it has matching children
    if (nameMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : undefined, // Only include children if they exist
      };
    }

    return null;
  };

  return nodes.map(filterNode).filter((node): node is TreeNode => node !== null);
};

// TreeNode Component for rendering individual nodes
const TreeNodeItem: React.FC<{ node: TreeNode; level: number }> = ({ node, level }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { fetchSchemaForTable, setSelectedDatabase, selectedDatabase } = useAppStore((state) => ({
    fetchSchemaForTable: state.fetchSchemaForTable,
    setSelectedDatabase: state.setSelectedDatabase,
    selectedDatabase: state.selectedDatabase,
  }));
  const tableSchemas = useAppStore((state) => state.tableSchemas);

  const hasChildren = node.children && node.children.length > 0;
  const isSelectedDb = node.type === 'database' && selectedDatabase === node.name;

  // --- Drag Source Hook ---
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: ItemTypes.SCHEMA_ITEM,
    item: { name: node.name, type: node.type }, // Data to pass on drop
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
    // Only allow dragging tables and columns
    canDrag: node.type === 'table' || node.type === 'column',
  }), [node.name, node.type]); // Dependencies

  const handleExpandToggle = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent click from bubbling up
    if (node.type === 'database') {
      // If clicking on a DB, select it (which triggers table fetch)
      setSelectedDatabase(node.name);
    } else if (node.type === 'table' && node.data) {
      // If clicking on a table, fetch its schema if not already loaded
      if (!tableSchemas[node.name]) {
        fetchSchemaForTable(node.name);
      }
    }
    if (hasChildren || node.type === 'table') { // Allow tables to expand even if children (cols) aren't loaded yet
      setIsExpanded(!isExpanded);
    }
  };

  const handleNodeClick = () => {
    if (node.type === 'database') {
      setSelectedDatabase(node.name);
      if (hasChildren) setIsExpanded(true);
    } else if (node.type === 'table' && node.data) {
      if (!tableSchemas[node.name]) {
        fetchSchemaForTable(node.name);
      }
      if (!tableSchemas[node.name] || hasChildren) {
        setIsExpanded(true);
      }
    } else if (node.type === 'column') {
      console.log("Column clicked, Popover should handle open:", node.data);
    }
  }

  let IconComponent = Columns;
  if (node.type === 'database') IconComponent = Database;
  if (node.type === 'table') IconComponent = Table;

  // Get column info if it's a column node
  const columnInfo = node.type === 'column' ? (node.data as ColumnInfo) : null;

  const indent = level * 16; // 16px indent per level

  const isExpandable = node.type === 'database' || node.type === 'table';

  // Combine refs for the draggable element
  const combinedRef = (el: HTMLSpanElement | null) => {
    dragRef(el); // Attach drag ref
    // Can attach other refs here if needed
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div>
        <div
          className={`flex items-center space-x-1 p-1 rounded hover:bg-muted ${isSelectedDb ? 'bg-muted' : ''} ${isDragging ? 'opacity-50' : ''}`}
          style={{ paddingLeft: `${indent}px` }}
        >
          {isExpandable && (
            <span
              onClick={handleExpandToggle}
              className="w-4 h-4 flex items-center justify-center cursor-pointer"
            >
              {hasChildren || (node.type === 'table' && !tableSchemas[node.name]) ? ( // Show chevron if expandable
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <span className="w-4"></span> // Placeholder for alignment
              )}
            </span>
          )}
          {!isExpandable && <span className="w-4"></span>} {/* Indent columns */}
          <IconComponent size={14} className="flex-shrink-0 text-muted-foreground mr-1" />
          {node.type === 'column' ? (
            <FieldDetailPopup column={columnInfo}>
              <span ref={combinedRef} className="text-sm truncate flex-grow cursor-grab" onClick={handleNodeClick}>
                {node.name}
              </span>
            </FieldDetailPopup>
          ) : node.type === 'table' ? (
            <span ref={combinedRef} className="text-sm truncate flex-grow cursor-grab" onClick={handleNodeClick}>
              {node.name}
            </span>
          ) : (
            <span className="text-sm truncate flex-grow cursor-pointer" onClick={handleNodeClick}>
              {node.name}
            </span>
          )}
          <div className="ml-auto flex items-center space-x-1 pr-1">
            {columnInfo?.is_pk && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Key size={12} className="flex-shrink-0 text-yellow-500" />
                </TooltipTrigger>
                <TooltipContent><p>Primary Key</p></TooltipContent>
              </Tooltip>
            )}
            {columnInfo?.fk_table && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <LinkIcon size={12} className="flex-shrink-0 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent><p>Foreign Key to {columnInfo.fk_table}.{columnInfo.fk_column}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="ml-0"> {/* Let child handle own indentation */}
            {node.children?.map((child) => (
              <TreeNodeItem key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
        {/* Show loading for table columns if expanded but schema not yet loaded */}
        {node.type === 'table' && isExpanded && !tableSchemas[node.name] && !hasChildren && (
          <div style={{ paddingLeft: `${(level + 1) * 16}px` }} className="p-1 text-xs text-muted-foreground italic">
            Loading columns...
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export function DatabaseTree({ filterTerm }: DatabaseTreeProps) {
  const databases = useAppStore((state) => state.availableDatabases);
  const selectedDatabase = useAppStore((state) => state.selectedDatabase);
  const tables = useAppStore((state) => state.tables);
  const schemas = useAppStore((state) => state.tableSchemas);
  const isLoading = useAppStore((state) => state.isLoadingSchema);
  const error = useAppStore((state) => state.schemaError);

  // Memoize tree building and filtering
  const treeNodes = React.useMemo(() =>
    buildTreeNodes(databases, tables, schemas, selectedDatabase),
    [databases, tables, schemas, selectedDatabase]
  );

  const filteredNodes = React.useMemo(() =>
    filterTree(treeNodes, filterTerm),
    [treeNodes, filterTerm]
  );

  if (isLoading && databases.length === 0) {
    return <div className="p-4 text-muted-foreground">Loading databases...</div>;
  }

  if (error) {
    return <div className="p-4 text-destructive">Error: {error}</div>;
  }

  if (filteredNodes.length === 0 && !filterTerm) {
    return <div className="p-4 text-muted-foreground">No databases found. Click refresh?</div>;
  }

  if (filteredNodes.length === 0 && filterTerm) {
    return <div className="p-4 text-muted-foreground">No matching items found for "{filterTerm}".</div>;
  }

  return (
    <div className="p-1">
      {filteredNodes.map((node) => (
        <TreeNodeItem key={node.id} node={node} level={0} />
      ))}
    </div>
  );
}
