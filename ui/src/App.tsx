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
