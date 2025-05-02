# SQL Query Interface Component Architecture

## Component Hierarchy

```
App
├── ThreeColumnLayout
│   ├── ToolboxSidebar (Column 1)
│   │   ├── ActionIcons
│   │   │   ├── SaveQueryButton
│   │   │   ├── HistoryButton
│   │   │   ├── SettingsButton
│   │   │   └── HelpButton
│   │   └── UserControls
│   │       ├── ProfileBadge
│   │       └── WorkspaceSelector
│   │
│   ├── CatalogBrowser (Column 2)
│   │   ├── SearchFilterBar
│   │   │   ├── SearchInput
│   │   │   └── RefreshButton
│   │   ├── DatabaseTree
│   │   │   ├── DatabaseNode
│   │   │   ├── TableNode
│   │   │   └── FieldNode
│   │   └── FieldDetailPopup
│   │       ├── FieldTypeInfo
│   │       ├── ConstraintList
│   │       └── RelationshipDiagram
│   │
│   └── EditorResultsPanel (Column 3)
│       ├── EditorHeader
│       │   ├── DatabaseIndicator
│       │   ├── ExecuteButton
│       │   └── EditorControls
│       ├── SqlEditor
│       │   └── MonacoEditorWrapper
│       └── ResultsPanel
│           ├── ResultsTabs
│           ├── ToggleViewControls
│           ├── ResultsTable
│           │   ├── TableHeader
│           │   ├── TableBody
│           │   └── TableFooter
│           ├── ResultsVisualization
│           │   ├── ChartTypeSelector
│           │   └── ChartContainer
│           └── ResultsStatusBar
```

## Component Descriptions

### Core Layout Components

#### `ThreeColumnLayout`
- **Purpose**: Manages the overall layout with three resizable columns
- **Props**:
  - `children`: React nodes for each column
  - `defaultColumnSizes`: Array of initial column widths
  - `minColumnSizes`: Array of minimum column widths
- **State**:
  - Column sizes
  - Column collapse states

### Column 1: Toolbox Components

#### `ToolboxSidebar`
- **Purpose**: Container for action icons and user controls
- **Props**:
  - `isExpanded`: Boolean to control expanded/collapsed state
- **State**:
  - Local expansion state

#### `ActionIcons`
- **Purpose**: Container for action buttons
- **Children Components**:
  - Individual action buttons with tooltips

### Column 2: Catalog Components

#### `CatalogBrowser`
- **Purpose**: Browse and search database schema
- **Props**:
  - `databases`: Array of database objects
- **State**:
  - Search filter text
  - Selected nodes
  - Expanded nodes

#### `SearchFilterBar`
- **Purpose**: Filter catalog items
- **Props**:
  - `onSearchChange`: Function
  - `onRefresh`: Function
- **State**:
  - Search text

#### `DatabaseTree`
- **Purpose**: Display hierarchical database structure
- **Props**:
  - `databases`: Array of database objects
  - `onNodeSelect`: Function
  - `onNodeExpand`: Function
- **State**:
  - Expanded nodes
  - Selected node

#### `FieldDetailPopup`
- **Purpose**: Show detailed information for selected field
- **Props**:
  - `field`: Field object with details
  - `position`: Position to render
- **State**:
  - Visibility

### Column 3: Editor and Results Components

#### `EditorResultsPanel`
- **Purpose**: Container for editor and results
- **Props**:
  - `selectedDatabase`: String
- **State**:
  - Editor/results split size

#### `EditorHeader`
- **Purpose**: Display controls above editor
- **Props**:
  - `selectedDatabase`: String
  - `onExecute`: Function
  - `isExecuting`: Boolean

#### `SqlEditor`
- **Purpose**: Monaco-based SQL editing
- **Props**:
  - `value`: String
  - `onChange`: Function
  - `schema`: Schema object for completion
- **State**:
  - Editor instance
  - Local value

#### `ResultsPanel`
- **Purpose**: Display query results
- **Props**:
  - `results`: Results object
  - `isLoading`: Boolean
  - `error`: Error object
- **State**:
  - View mode (table/visualization)
  - Selected tab

#### `ResultsTable`
- **Purpose**: Display tabular results
- **Props**:
  - `data`: Array of result objects
  - `columns`: Array of column definitions
- **State**:
  - Sort configuration
  - Filter values
  - Page index

#### `ResultsVisualization`
- **Purpose**: Display chart visualization
- **Props**:
  - `data`: Array of result objects
  - `chartType`: String
  - `config`: Visualization config
- **State**:
  - Chart configuration

## State Management

### Zustand Store Slices

#### `databasesSlice`
- Available databases
- Selected database
- Tables in selected database
- Fields in selected tables

#### `editorSlice`
- Current query text
- Query history
- Editor preferences

#### `querySlice`
- Query execution state
- Query results
- Query errors

#### `uiSlice`
- UI preferences
- Layout configuration
- View modes

## Data Flow

1. **Catalog Selection**
   - User selects database → `setSelectedDatabase` → Updates store
   - Store triggers table fetch → Updates `availableTables`
   - User selects table → `setSelectedTable` → Updates store
   - Store triggers fields fetch → Updates `tableFields`

2. **Query Execution**
   - User writes query → `setCurrentQuery` → Updates store
   - User clicks execute → `executeQuery` → Updates `isQueryRunning`
   - Query completes → Updates `queryResult` and `queryError`
   - Results panel reacts to new result/error

3. **UI Interactions**
   - User resizes panels → Updates layout in local state
   - User toggles views → Updates `showVisualization` in store
   - User searches catalog → Filters local tree component state

## Custom Hooks

#### `useSchemaNavigation`
- Manages database/table/field selection
- Handles loading states

#### `useQueryExecution`
- Manages query execution flow
- Handles errors and results

#### `useResultsVisualization`
- Transforms SQL results to visualization format
- Manages chart configuration

## Performance Considerations

- Use virtualized lists for large schemas
- Memoize expensive components
- Lazy load visualization libraries
- Debounce search input
- Use windowing for large result sets
