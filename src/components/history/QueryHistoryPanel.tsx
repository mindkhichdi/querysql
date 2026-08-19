import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useEffect } from "react";
import { useTabStore } from "../../store/tabStore";
import { useConnectionStore } from "../../store/connectionStore";

interface QueryHistoryPanelProps {
  onClose: () => void;
}

export function QueryHistoryPanel({ onClose }: QueryHistoryPanelProps) {
  const { history, initHistory, openQueryTab } = useTabStore();
  const activeId = useConnectionStore((s) => s.activeId);

  useEffect(() => {
    initHistory();
  }, [initHistory]);

  const entries = history.filter((h) => h.connectionId === activeId);

  return (
    <div className="h-full w-72 shrink-0 flex flex-col bg-[var(--qd-bg-elevated)] border-l border-[var(--qd-border)]">
      <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-[var(--qd-border)]">
        <span className="text-[12px] font-medium">Query history</span>
        <button onClick={onClose} className="cursor-pointer text-[var(--qd-text-muted)] hover:text-[var(--qd-text)]">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-[var(--qd-text-muted)]">No queries run yet.</div>
        ) : (
          entries.map((h) => (
            <button
              key={h.id}
              onClick={() => activeId && openQueryTab(activeId, h.sql)}
              className="w-full text-left px-3 py-2 border-b border-[var(--qd-border)]/60 hover:bg-[var(--qd-bg-inset)] cursor-pointer block"
            >
              <div className="flex items-center gap-1.5 mb-1">
                {h.success ? (
                  <CheckCircle2 size={11} className="text-[var(--qd-success)] shrink-0" />
                ) : (
                  <AlertCircle size={11} className="text-[var(--qd-danger)] shrink-0" />
                )}
                <span className="text-[10.5px] text-[var(--qd-text-muted)]">
                  {new Date(h.ranAt).toLocaleTimeString()}
                  {h.durationMs !== null ? ` · ${h.durationMs.toFixed(0)}ms` : ""}
                  {h.rowsAffected !== null ? ` · ${h.rowsAffected} rows` : ""}
                </span>
              </div>
              <div className="qd-mono text-[11px] line-clamp-3 whitespace-pre-wrap break-words text-[var(--qd-text)]">
                {h.sql}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
