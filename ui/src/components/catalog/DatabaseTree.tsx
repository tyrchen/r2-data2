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
import { useAppStore, ColumnInfo, DatabaseSchema, TableSchema } from '@/store/useAppStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// import { FieldDetailPopup } from "./FieldDetailPopup"; // Comment out
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

// Update buildTreeNodes to be non-recursive and store minimal data
const buildTreeNodes = (
  dbSchemas: DatabaseSchema[],
  selectedDatabase: string | null
): TreeNode[] => {
  return dbSchemas.map((dbSchema) => {
    // --- Database Node ---
    const dbNode: TreeNode = {
      id: `db-${dbSchema.name}`,
      name: dbSchema.name,
      type: 'database',
      // Store only essential primitive data
      data: { name: dbSchema.name, db_type: dbSchema.db_type },
      children: [],
    };

    // --- Table Nodes (if selected DB matches) ---
    if (selectedDatabase === dbSchema.name) {
      dbNode.children = dbSchema.tables.map((tableSchema: TableSchema) => {
        // --- Table Node ---
        const tableNode: TreeNode = {
          id: `table-${dbSchema.name}-${tableSchema.table_name}`,
          name: tableSchema.table_name,
          type: 'table',
          // Store only essential primitive data
          data: { name: tableSchema.table_name },
          children: [],
        };

        // --- Column Nodes ---
        if (tableSchema.columns) {
          tableNode.children = tableSchema.columns.map((col: ColumnInfo) => ({
            id: `col-${dbSchema.name}-${tableSchema.table_name}-${col.name}`,
            name: col.name,
            type: 'column',
            // Store only essential primitive data + is_pk/fk_table for icons
            data: {
              name: col.name,
              data_type: col.data_type,
              is_pk: col.is_pk,
              fk_table: col.fk_table
            },
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
// Re-add TreeNodeItemProps and React.memo
interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  selectedDatabase: string | null; // Pass selected DB as prop
}
const TreeNodeItem: React.FC<TreeNodeItemProps> = React.memo(({ node, level, selectedDatabase }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  // Only subscribe to the action, not the selectedDatabase state itself
  const setSelectedDatabase = useAppStore((state) => state.setSelectedDatabase);
  // We don't need tableSchemas here anymore, can rely on node.children presence
  // const tableSchemas = useAppStore((state) => state.tableSchemas);

  // Use prop for selected DB check
  const hasChildren = node.children && node.children.length > 0;
  const isSelectedDb = node.type === 'database' && selectedDatabase === node.name;

  // --- Drag Source Hook --- (Commented out for debugging)
  const dragRef = React.useRef(null); // Dummy ref
  const isDragging = false; // Dummy state
  /* const [{ isDragging }, dragRef] = useDrag(() => ({
    type: ItemTypes.SCHEMA_ITEM,
    item: { name: node.name, type: node.type }, // Data to pass on drop
    collect: (monitor) => ({
    // Only allow dragging tables and columns
    canDrag: node.type === 'table' || node.type === 'column',
  }), [node.name, node.type]); // Dependencies
  */

  const handleExpandToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (node.type === 'database') {
      setSelectedDatabase(node.name); // Action call is fine
    }
    // Rely only on presence of children now for tables
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleNodeClick = () => {
    if (node.type === 'database') {
      setSelectedDatabase(node.name); // Action call is fine
      if (hasChildren) setIsExpanded(true);
    } else if (node.type === 'table') {
      if (hasChildren) {
        setIsExpanded(true);
      }
    } else if (node.type === 'column') {
      // Logic for popup can be added back later
      console.log("Column clicked:", node.data);
    }
  }

  let IconComponent = Columns;
  if (node.type === 'database') IconComponent = Database;
  if (node.type === 'table') IconComponent = Table;

  // Get column data from node.data if needed for icons
  const columnData = node.type === 'column' ? node.data : null;

  const indent = level * 16;

  const isExpandable = node.type === 'database' || node.type === 'table';

  const combinedRef = dragRef; // Use dummy ref

  return (
    // Outer div for the node and its potential children
    <div>
      {/* The main row for the node itself */}
      <div
        className={`flex items-center space-x-1 p-1 rounded hover:bg-muted ${isSelectedDb ? 'bg-muted' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Expand/Collapse Chevron */}
        {isExpandable ? (
          <span
            onClick={handleExpandToggle}
            className="w-4 h-4 flex items-center justify-center cursor-pointer"
          >
            {hasChildren ? ( // Only rely on actual children for chevron
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-4"></span> // Placeholder if no children
            )}
          </span>
        ) : (
          <span className="w-4"></span> // Indent non-expandable
        )}

        {/* Icon */}
        <IconComponent size={14} className="flex-shrink-0 text-muted-foreground mr-1" />

        {/* Node Name (conditionally rendered span) */}
        {/* Removed FieldDetailPopup wrapper, removed cursor-grab */}
        {node.type === 'column' ? (
          <span ref={combinedRef} className="text-sm truncate flex-grow cursor-default" onClick={handleNodeClick}>
            {node.name}
          </span>
        ) : node.type === 'table' ? (
          <span ref={combinedRef} className="text-sm truncate flex-grow cursor-default" onClick={handleNodeClick}>
            {node.name}
          </span>
        ) : (
          <span className="text-sm truncate flex-grow cursor-pointer" onClick={handleNodeClick}>
            {node.name}
          </span>
        )}

        {/* PK/FK Icons - Tooltips removed for debugging */}
        <div className="ml-auto flex items-center space-x-1 pr-1">
          {columnData?.is_pk && (
            <Key size={12} className="flex-shrink-0 text-yellow-500" />
          )}
          {columnData?.fk_table && (
            <LinkIcon size={12} className="flex-shrink-0 text-blue-500" />
          )}
        </div>
      </div>

      {/* Render Children if Expanded */}
      {isExpanded && hasChildren && (
        <div className="ml-0">
          {node.children?.map((child) => (
            // Pass selectedDatabase prop down
            <TreeNodeItem key={child.id} node={child} level={level + 1} selectedDatabase={selectedDatabase} />
          ))}
        </div>
      )}

      {/* Remove loading indicator as columns are now included directly */}
      {/* {node.type === 'table' && isExpanded && !tableSchemas[node.name] && !hasChildren && (...)} */}
    </div>
  );
}); // End of React.memo wrapper

export function DatabaseTree({ filterTerm }: DatabaseTreeProps) {
  const selectedDatabase = useAppStore((state) => state.selectedDatabase);
  const fullSchemaData = useAppStore((state) => state.fullSchemaData);
  const isLoadingFullSchema = useAppStore((state) => state.isFetchingFullSchema);
  const fullSchemaError = useAppStore((state) => state.fullSchemaError);

  // Memoize tree building and filtering
  const treeNodes = React.useMemo(() => {
    const dbSchemas = fullSchemaData?.databases || [];
    return buildTreeNodes(dbSchemas, selectedDatabase);
  }, [fullSchemaData, selectedDatabase]);

  const filteredNodes = React.useMemo(() =>
    filterTree(treeNodes, filterTerm),
    [treeNodes, filterTerm]
  );

  // Loading/Error states remain the same
  if (isLoadingFullSchema && !fullSchemaData) {
    return <div className="p-4 text-muted-foreground">Loading schema...</div>;
  }
  if (fullSchemaError) {
    return <div className="p-4 text-destructive">Error loading schema: {fullSchemaError}</div>;
  }
  if (filteredNodes.length === 0 && !filterTerm) {
    return <div className="p-4 text-muted-foreground">No databases found.</div>;
  }
  if (filteredNodes.length === 0 && filterTerm) {
    return <div className="p-4 text-muted-foreground">No matching items found for "{filterTerm}".</div>;
  }

  return (
    // Ensure TooltipProvider wraps the list
    <TooltipProvider delayDuration={300}>
      <div className="p-1">
        {filteredNodes.map((node) => (
          // Pass selectedDatabase prop
          <TreeNodeItem key={node.id} node={node} level={0} selectedDatabase={selectedDatabase} />
        ))}
      </div>
    </TooltipProvider>
  );
}
