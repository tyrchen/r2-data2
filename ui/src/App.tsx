import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { SqlEditor } from "@/components/SqlEditor";
import { ResultViewer } from "@/components/ResultViewer";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ToolboxSidebar } from "@/components/toolbox/ToolboxSidebar";
import { QueryTabBar } from "@/components/editor/QueryTabBar";
import { useAppStore } from '@/store/useAppStore';

function App() {
  useEffect(() => {
    useAppStore.getState().init();
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <ThreeColumnLayout
        toolbox={<ToolboxSidebar />}
        catalog={<CatalogBrowser />}
        editor={
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0"><QueryTabBar /></div>
            <div className="flex-shrink-0"><EditorHeader /></div>
            <div className="flex-grow overflow-hidden p-1">
              <SqlEditor />
            </div>
          </div>
        }
        results={
          <div className="p-1 h-full">
            <ResultViewer />
          </div>
        }
      />
    </DndProvider>
  );
}

export default App;
