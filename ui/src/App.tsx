import React, { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
// Remove direct imports of components used inside CatalogBrowser
// import { DatabaseSelector } from "@/components/DatabaseSelector";
// import { SchemaBrowser } from "@/components/SchemaBrowser";
import { SqlEditor } from "@/components/SqlEditor";
import { ResultViewer } from "@/components/ResultViewer";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser"; // Import the new browser
import { EditorHeader } from "@/components/editor/EditorHeader"; // Import EditorHeader
import { ToolboxSidebar } from "@/components/toolbox/ToolboxSidebar"; // Import ToolboxSidebar
import { QueryTabBar } from "@/components/editor/QueryTabBar"; // Import QueryTabBar
import { useAppStore } from '@/store/useAppStore'; // Import the store

function App() {
  // Initialize the store state (e.g., set initial active tab)
  useEffect(() => {
    useAppStore.getState().init();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <DndProvider backend={HTML5Backend}>
      <ThreeColumnLayout
        toolbox={<ToolboxSidebar />} // Pass the actual component
        catalog={<CatalogBrowser />} // Use the new CatalogBrowser component
        editor={
          // Group EditorHeader and SqlEditor vertically
          <div className="h-full flex flex-col">
            <QueryTabBar />
            <EditorHeader />
            <div className="flex-grow overflow-hidden">
              <SqlEditor />
            </div>
          </div>
        }
        results={<ResultViewer />}
      />
    </DndProvider>
  );
}

export default App;
