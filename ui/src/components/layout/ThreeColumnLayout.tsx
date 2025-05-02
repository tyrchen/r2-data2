import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import React from "react";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import {
  PanelLeftClose,
  PanelRightClose,
  PanelLeftOpen,
  PanelRightOpen,
} from "lucide-react";

// Define props for the layout component if needed in the future
interface ThreeColumnLayoutProps {
  toolbox?: React.ReactNode;
  catalog?: React.ReactNode;
  editor?: React.ReactNode;
  results?: React.ReactNode;
}

const TOOLBOX_PANEL_ID = "toolbox";
const CATALOG_PANEL_ID = "catalog";
const HORIZONTAL_GROUP_ID = "horizontalLayout";
const CATALOG_VERTICAL_GROUP_ID = "catalogVerticalLayout";
const EDITOR_VERTICAL_GROUP_ID = "editorVerticalLayout";

export function ThreeColumnLayout({
  toolbox = <div className="p-2 h-full bg-muted/40">Toolbox Placeholder</div>,
  catalog,
  editor,
  results,
}: ThreeColumnLayoutProps) {
  const layoutSizes = useAppStore((state) => state.layoutSizes);
  const setLayoutSizes = useAppStore((state) => state.setLayoutSizes);
  const collapsedPanels = useAppStore((state) => state.collapsedPanels);
  const togglePanelCollapse = useAppStore((state) => state.togglePanelCollapse);

  const isToolboxCollapsed = collapsedPanels[TOOLBOX_PANEL_ID] ?? false;
  const isCatalogCollapsed = collapsedPanels[CATALOG_PANEL_ID] ?? false;

  const handleHorizontalLayout: (sizes: number[]) => void = (sizes: number[]) => {
    setLayoutSizes(HORIZONTAL_GROUP_ID, sizes);
  };

  const handleEditorVerticalLayout: (sizes: number[]) => void = (sizes: number[]) => {
    setLayoutSizes(EDITOR_VERTICAL_GROUP_ID, sizes);
  };

  const horizontalSizes = layoutSizes[HORIZONTAL_GROUP_ID];
  const editorVerticalSizes = layoutSizes[EDITOR_VERTICAL_GROUP_ID];

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="min-h-screen w-full rounded-lg border"
      onLayout={handleHorizontalLayout}
      id={HORIZONTAL_GROUP_ID}
    >
      {/* Column 1: Toolbox */}
      <ResizablePanel
        defaultSize={horizontalSizes ? horizontalSizes[0] : 15}
        minSize={5}
        maxSize={20}
        collapsible
        collapsedSize={3}
        onCollapse={() => {
          if (!isToolboxCollapsed) togglePanelCollapse(TOOLBOX_PANEL_ID);
        }}
        onExpand={() => {
          if (isToolboxCollapsed) togglePanelCollapse(TOOLBOX_PANEL_ID);
        }}
        className={`transition-all duration-300 ease-in-out ${isToolboxCollapsed ? "min-w-[40px]" : ""}`}
        id={TOOLBOX_PANEL_ID}
        order={1}
      >
        <div className="flex h-full items-start justify-center p-1">
          {isToolboxCollapsed ? (
            <Button variant="ghost" size="icon" onClick={() => togglePanelCollapse(TOOLBOX_PANEL_ID)}>
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <div className="flex-grow">{toolbox}</div>
              <Button variant="ghost" size="icon" onClick={() => togglePanelCollapse(TOOLBOX_PANEL_ID)}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />

      {/* Column 2: Catalog */}
      <ResizablePanel
        defaultSize={horizontalSizes ? horizontalSizes[1] : 25}
        minSize={15}
        maxSize={40}
        collapsible
        collapsedSize={3}
        onCollapse={() => {
          if (!isCatalogCollapsed) togglePanelCollapse(CATALOG_PANEL_ID);
        }}
        onExpand={() => {
          if (isCatalogCollapsed) togglePanelCollapse(CATALOG_PANEL_ID);
        }}
        className={`transition-all duration-300 ease-in-out ${isCatalogCollapsed ? "min-w-[40px]" : ""}`}
        id={CATALOG_PANEL_ID}
        order={2}
      >
        <div className="flex h-full items-start p-1">
          {isCatalogCollapsed ? (
            <Button variant="ghost" size="icon" onClick={() => togglePanelCollapse(CATALOG_PANEL_ID)}>
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex-grow">
              {catalog}
            </div>
          )}
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />

      {/* Column 3: Editor & Results */}
      <ResizablePanel
        defaultSize={horizontalSizes ? horizontalSizes[2] : 60}
        minSize={30}
        order={3}
      >
        <ResizablePanelGroup
          direction="vertical"
          onLayout={handleEditorVerticalLayout}
          id={EDITOR_VERTICAL_GROUP_ID}
        >
          <ResizablePanel defaultSize={editorVerticalSizes ? editorVerticalSizes[0] : 60} minSize={20}>
            {editor}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={editorVerticalSizes ? editorVerticalSizes[1] : 40} minSize={20}>
            {results}
          </ResizablePanel>
        </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
