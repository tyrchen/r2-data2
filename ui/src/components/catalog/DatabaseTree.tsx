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
  matchesFilter?: boolean; // Indicates if node or descendant matches
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
  const lowerTerm = term.toLowerCase();

  const checkAndMark = (node: TreeNode): boolean => {
    const nameMatch = node.name.toLowerCase().includes(lowerTerm);
    let descendantMatch = false;

    if (node.children) {
      // Recursively check children and update descendantMatch
      descendantMatch = node.children.reduce((acc, child) => {
        return checkAndMark(child) || acc;
      }, false);
    }

    node.matchesFilter = nameMatch || descendantMatch;
    return node.matchesFilter;
  };

  // First pass: mark all nodes that match or have matching descendants
  nodes.forEach(checkAndMark);

  // Second pass: filter out nodes that don't match and have no matching descendants
  const filterVisible = (node: TreeNode): TreeNode | null => {
    if (!node.matchesFilter) {
      return null;
    }
    // If node matches, filter its children
    let visibleChildren: TreeNode[] = [];
    if (node.children) {
      visibleChildren = node.children
        .map(filterVisible)
        .filter((child): child is TreeNode => child !== null);
    }
    // Return the node with potentially filtered children
    return {
      ...node,
      children: visibleChildren.length > 0 ? visibleChildren : undefined,
    };
  };

  return nodes.map(filterVisible).filter((node): node is TreeNode => node !== null);
};

// TreeNode Component for rendering individual nodes
interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  selectedDatabase: string | null;
  isExpanded: boolean; // Receive expanded state from parent
  onToggleExpand: (nodeId: string) => void; // Callback to toggle expansion
}
const TreeNodeItem: React.FC<TreeNodeItemProps> = React.memo(({
  node,
  level,
  selectedDatabase,
  isExpanded, // Use passed prop
  onToggleExpand // Use passed callback
}) => {
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
    event.stopPropagation(); // Prevent event bubbling
    // Always toggle expansion when chevron is clicked for expandable nodes
    onToggleExpand(node.id);
  };

  const handleNodeClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent triggering handlers on parent elements if nested

    if (node.type === 'database') {
      setSelectedDatabase(node.name);
      // Toggle only if it has children
      if (hasChildren) {
        onToggleExpand(node.id);
      }
    } else if (node.type === 'table') {
      // Toggle only if it has children
      if (hasChildren) {
        onToggleExpand(node.id);
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
        // Ensure outer div doesn't accidentally handle clicks meant for children
        // onClick={handleNodeClick} // REMOVED - Clicks handled by specific elements below
        className={`flex items-center space-x-1 p-2 rounded hover:bg-muted ${isSelectedDb ? 'bg-muted' : ''}`}
        style={{ paddingLeft: `${indent}px` }}
      >
        {/* Expand/Collapse Chevron */}
        {isExpandable ? (
          <span
            onClick={handleExpandToggle} // Chevron click only toggles expand
            className="w-4 h-4 flex items-center justify-center cursor-pointer mr-1" // Added mr-1
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : (
              <span className="w-4"></span>
            )}
          </span>
        ) : (
          <span className="w-4 mr-1"></span> // Add mr-1 for alignment
        )}

        {/* Icon with added margin */}
        <IconComponent size={14} className="flex-shrink-0 text-muted-foreground mr-1.5" />

        {/* Node Name spans - Attach click handler here */}
        {node.type === 'column' ? (
          <span ref={combinedRef} className="text truncate flex-grow cursor-default" onClick={handleNodeClick}>
            {node.name}
            {/* Icons directly after column name */}
            <span className="inline-flex items-center ml-1.5 space-x-1">
              {columnData?.is_pk && (
                <Key size={12} className="flex-shrink-0 text-yellow-500" />
              )}
              {columnData?.fk_table && (
                <LinkIcon size={12} className="flex-shrink-0 text-blue-500" />
              )}
            </span>
          </span>
        ) : (
          // Table or Database Name - Attaching click handler here
          <span
            ref={combinedRef} // Attach ref here if needed (though drag is commented out)
            className={`text truncate flex-grow ${isExpandable ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={handleNodeClick} // Handle node click (select DB, toggle expand)
          >
            {node.name}
          </span>
        )}

        {/* Spacer removed as icons are inline now for columns */}
        {/* {node.type !== 'column' && <div className="ml-auto"></div>} */}
      </div>

      {/* Render Children if Expanded */}
      {isExpanded && hasChildren && (
        <div className="ml-0">
          {node.children?.map((child) => (
            // Pass selectedDatabase prop down
            <TreeNodeItem key={child.id} node={child} level={level + 1} selectedDatabase={selectedDatabase} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
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

  // State for expanded node IDs
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const handleToggleExpand = (nodeId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Memoize tree building
  const treeNodes = React.useMemo(() => {
    const dbSchemas = fullSchemaData?.databases || [];
    return buildTreeNodes(dbSchemas, selectedDatabase);
  }, [fullSchemaData, selectedDatabase]);

  // Memoize filtering and update expanded nodes on filter change
  const filteredNodes = React.useMemo(() => {
    const filtered = filterTree(treeNodes, filterTerm);

    // If filter is active, auto-expand matches
    if (filterTerm) {
      const newExpanded = new Set<string>();
      const collectExpanded = (nodes: TreeNode[]) => {
        nodes.forEach(node => {
          if (node.matchesFilter) {
            newExpanded.add(node.id);
            if (node.children) {
              collectExpanded(node.children);
            }
          }
        });
      };
      collectExpanded(filtered); // Use the already filtered tree
      setExpandedIds(newExpanded);
    } else {
      // Optionally reset expansion when filter is cleared, or keep state
      // setExpandedIds(new Set());
    }

    return filtered;
  }, [treeNodes, filterTerm]);

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
          <TreeNodeItem
            key={node.id}
            node={node}
            level={0}
            selectedDatabase={selectedDatabase}
            // Pass down expanded state and toggle handler
            isExpanded={expandedIds.has(node.id)}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
