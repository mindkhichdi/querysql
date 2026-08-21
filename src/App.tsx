import { useState } from "react";
import { ConnectionScreen } from "./components/connection/ConnectionScreen";
import { Sidebar } from "./components/layout/Sidebar";
import { TabBar } from "./components/layout/TabBar";
import { TitleBar } from "./components/layout/TitleBar";
import { QueryHistoryPanel } from "./components/history/QueryHistoryPanel";
import { QueryPanel } from "./components/query/QueryPanel";
import { SchemaDiagram } from "./components/schema/SchemaDiagram";
import { TableDataGrid } from "./components/table-editor/TableDataGrid";
import { useConnectionStore } from "./store/connectionStore";
import { useTabStore } from "./store/tabStore";

export default function App() {
  const activeId = useConnectionStore((s) => s.activeId);
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  if (!activeId) {
    return <ConnectionScreen />;
  }

  return (
    <div className="h-full w-full flex flex-col bg-[var(--qd-bg)] text-[var(--qd-text)]">
      <TitleBar onToggleHistory={() => setHistoryOpen((v) => !v)} historyOpen={historyOpen} />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TabBar />
          <div className="flex-1 min-h-0">
            {activeTab ? (
              activeTab.kind === "query" ? (
                <QueryPanel key={activeTab.id} tab={activeTab} />
              ) : activeTab.kind === "diagram" ? (
                <SchemaDiagram key={activeTab.id} connectionId={activeTab.connectionId} />
              ) : (
                <TableDataGrid key={activeTab.id} connectionId={activeTab.connectionId} table={activeTab.table} />
              )
            ) : (
              <div className="h-full flex items-center justify-center text-[13px] text-[var(--qd-text-muted)]">
                Select a table or start a new query to get going.
              </div>
            )}
          </div>
        </div>
        {historyOpen && <QueryHistoryPanel onClose={() => setHistoryOpen(false)} />}
      </div>
    </div>
  );
}
