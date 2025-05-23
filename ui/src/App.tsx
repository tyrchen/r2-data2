import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
// import { SqlEditor } from "@/components/SqlEditor"; // Replaced by DynamicEditor
import { DynamicEditor } from "@/components/editor/DynamicEditor"; // Added
import { ResultViewer } from "@/components/ResultViewer";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { EditorHeader } from "@/components/editor/EditorHeader";
import { ToolboxSidebar } from "@/components/toolbox/ToolboxSidebar";
import { QueryTabBar } from "@/components/editor/QueryTabBar";
import { useAppStore } from '@/store/useAppStore';
import { GenerateQueryModal } from '@/components/ai/GenerateQueryModal';

function App() {
  const isGenerateQueryModalOpen = useAppStore((state) => state.isGenerateQueryModalOpen);

  useEffect(() => {
    useAppStore.getState().init();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const state = useAppStore.getState();
        if (state.selectedDatabase) {
          state.openGenerateQueryModal();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <ThreeColumnLayout
        toolbox={<ToolboxSidebar />}
        catalog={<CatalogBrowser />}
        editor={
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0"><QueryTabBar /></div>
            <div className="flex-shrink-0"><EditorHeader /></div>
            <div className="overflow-hidden flex-grow p-1">
              {/* <SqlEditor /> */} {/* Replaced by DynamicEditor */}
              <DynamicEditor /> {/* Added */}
            </div>
          </div>
        }
        results={
          <div className="p-1 h-full">
            <ResultViewer />
          </div>
        }
      />
      {isGenerateQueryModalOpen && <GenerateQueryModal />}
    </DndProvider>
  );
}

export default App;
