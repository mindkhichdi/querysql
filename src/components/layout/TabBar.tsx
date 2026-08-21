import { Plus, Table2, Terminal, Waypoints, X } from "lucide-react";
import { useTabStore } from "../../store/tabStore";
import { useConnectionStore } from "../../store/connectionStore";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, openQueryTab } = useTabStore();
  const activeId = useConnectionStore((s) => s.activeId);

  return (
    <div className="h-9 shrink-0 flex items-center border-b border-[var(--qd-border)] bg-[var(--qd-bg)] overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group h-full flex items-center gap-1.5 px-3 border-r border-[var(--qd-border)] cursor-pointer text-[12px] shrink-0 max-w-[180px] ${
              isActive
                ? "bg-[var(--qd-bg-elevated)] text-[var(--qd-text)]"
                : "text-[var(--qd-text-muted)] hover:bg-[var(--qd-bg-inset)]"
            }`}
          >
            {tab.kind === "query" ? (
              <Terminal size={12} className="shrink-0" />
            ) : tab.kind === "diagram" ? (
              <Waypoints size={12} className="shrink-0 text-[var(--qd-accent)]" />
            ) : (
              <Table2 size={12} className="shrink-0 text-[var(--qd-accent)]" />
            )}
            <span className="truncate">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="shrink-0 rounded-sm hover:bg-[var(--qd-bg-inset)] opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      <button
        onClick={() => activeId && openQueryTab(activeId)}
        disabled={!activeId}
        className="h-full px-2.5 flex items-center justify-center text-[var(--qd-text-muted)] hover:text-[var(--qd-text)] hover:bg-[var(--qd-bg-inset)] cursor-pointer disabled:opacity-30 shrink-0"
        title="New query tab"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
