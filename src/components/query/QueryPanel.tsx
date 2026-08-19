import { Download, FileJson, Loader2, Play } from "lucide-react";
import { useRef, useState } from "react";
import { SqlEditor } from "../editor/SqlEditor";
import { ResultsGrid } from "../results/ResultsGrid";
import { Button } from "../common/Button";
import { useTabStore, type QueryTab } from "../../store/tabStore";
import { statementAtCursor } from "../../lib/statementAtCursor";
import { exportCsv, exportJson } from "../../lib/exporters";

interface QueryPanelProps {
  tab: QueryTab;
}

export function QueryPanel({ tab }: QueryPanelProps) {
  const setSql = useTabStore((s) => s.setSql);
  const runQuery = useTabStore((s) => s.runQuery);
  const cursorPos = useRef(0);
  const [exporting, setExporting] = useState(false);

  function runCurrentStatement() {
    const stmt = statementAtCursor(tab.sql, cursorPos.current);
    runQuery(tab.id, stmt || tab.sql);
  }

  async function handleExport(format: "csv" | "json") {
    if (!tab.result) return;
    setExporting(true);
    try {
      const name = tab.title.replace(/\s+/g, "_");
      if (format === "csv") {
        await exportCsv(tab.result.columns, tab.result.rows, name);
      } else {
        await exportJson(tab.result.columns, tab.result.rows, name);
      }
    } finally {
      setExporting(false);
    }
  }

  const hasResult = !!tab.result && tab.result.columns.length > 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--qd-border)] bg-[var(--qd-bg-elevated)]">
        <Button
          variant="primary"
          size="sm"
          icon={tab.isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          onClick={runCurrentStatement}
          disabled={tab.isRunning}
        >
          Run
        </Button>
        <span className="text-[10.5px] text-[var(--qd-text-muted)]">⌘⏎ to run current statement</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={<Download size={12} />} disabled={!hasResult || exporting} onClick={() => handleExport("csv")}>
          CSV
        </Button>
        <Button variant="ghost" size="sm" icon={<FileJson size={12} />} disabled={!hasResult || exporting} onClick={() => handleExport("json")}>
          JSON
        </Button>
      </div>

      <div className="h-[38%] min-h-[120px] border-b border-[var(--qd-border)]">
        <SqlEditor
          connectionId={tab.connectionId}
          value={tab.sql}
          onChange={(v) => setSql(tab.id, v)}
          onRun={runCurrentStatement}
          onCursorChange={(pos) => {
            cursorPos.current = pos;
          }}
        />
      </div>

      <div className="flex-1 min-h-0">
        {tab.error ? (
          <div className="p-3 text-[12px] text-[var(--qd-danger)] qd-mono whitespace-pre-wrap">{tab.error}</div>
        ) : tab.result ? (
          <ResultsGrid columns={tab.result.columns} rows={tab.result.rows} />
        ) : (
          <div className="h-full flex items-center justify-center text-[12px] text-[var(--qd-text-muted)]">
            Run a query to see results
          </div>
        )}
      </div>

      <div className="h-6 shrink-0 flex items-center px-3 gap-3 border-t border-[var(--qd-border)] bg-[var(--qd-bg-elevated)] text-[10.5px] text-[var(--qd-text-muted)]">
        {tab.result && !tab.error && (
          <>
            <span>
              {tab.result.columns.length > 0
                ? `${tab.result.rows.length} row${tab.result.rows.length === 1 ? "" : "s"}`
                : `${tab.result.rows_affected} row${tab.result.rows_affected === 1 ? "" : "s"} affected`}
            </span>
            <span>{tab.result.duration_ms.toFixed(1)} ms</span>
          </>
        )}
      </div>
    </div>
  );
}
