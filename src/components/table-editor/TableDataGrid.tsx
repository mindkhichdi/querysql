import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/tauri";
import { Button } from "../common/Button";
import { exportCsv, exportJson } from "../../lib/exporters";
import type { JsonValue, RowChange } from "../../types";

interface TableDataGridProps {
  connectionId: string;
  table: string;
}

interface EditEntry {
  pk: Record<string, JsonValue>;
  values: Record<string, JsonValue>;
}

interface NewRow {
  tempId: string;
  values: Record<string, JsonValue>;
}

const PAGE_SIZE = 100;

export function TableDataGrid({ connectionId, table }: TableDataGridProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [pkColumns, setPkColumns] = useState<string[]>([]);
  const [baseRows, setBaseRows] = useState<JsonValue[][]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(0);
  const [sortColumn, setSortColumn] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const [edits, setEdits] = useState<Map<string, EditEntry>>(new Map());
  const [deleted, setDeleted] = useState<Map<string, Record<string, JsonValue>>>(new Map());
  const [newRows, setNewRows] = useState<NewRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowKey: string; col: string } | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, table, page, sortColumn, sortDir]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.fetchTablePage(
        connectionId,
        table,
        PAGE_SIZE,
        page * PAGE_SIZE,
        sortColumn,
        sortDir,
      );
      setColumns(result.columns);
      setPkColumns(result.pk_columns);
      setBaseRows(result.rows);
      setTotalRows(result.total_rows);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function rowKeyOf(row: JsonValue[]): { key: string; pk: Record<string, JsonValue> } {
    const pk: Record<string, JsonValue> = {};
    for (const c of pkColumns) {
      const idx = columns.indexOf(c);
      pk[c] = idx >= 0 ? row[idx] : null;
    }
    return { key: JSON.stringify(pk), pk };
  }

  const displayRows = useMemo(() => {
    return baseRows.map((row) => {
      const { key, pk } = rowKeyOf(row);
      const values: Record<string, JsonValue> = {};
      columns.forEach((c, i) => (values[c] = row[i]));
      const edit = edits.get(key);
      if (edit) Object.assign(values, edit.values);
      return { key, pk, values, isNew: false, isDeleted: deleted.has(key) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRows, edits, deleted, columns, pkColumns]);

  const dirtyCount = edits.size + deleted.size + newRows.length;

  function setCellValue(rowKey: string, col: string, value: JsonValue, pk?: Record<string, JsonValue>) {
    setEdits((prev) => {
      const next = new Map(prev);
      const existing = next.get(rowKey) ?? { pk: pk ?? {}, values: {} };
      next.set(rowKey, { pk: existing.pk, values: { ...existing.values, [col]: value } });
      return next;
    });
  }

  function setNewRowValue(tempId: string, col: string, value: JsonValue) {
    setNewRows((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, values: { ...r.values, [col]: value } } : r)),
    );
  }

  function toggleDelete(rowKey: string, pk: Record<string, JsonValue>) {
    setDeleted((prev) => {
      const next = new Map(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.set(rowKey, pk);
      return next;
    });
  }

  function addRow() {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNewRows((prev) => [...prev, { tempId, values: {} }]);
  }

  function duplicateRow(values: Record<string, JsonValue>) {
    const tempId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const copy: Record<string, JsonValue> = { ...values };
    for (const c of pkColumns) if (c !== "rowid") delete copy[c];
    setNewRows((prev) => [...prev, { tempId, values: copy }]);
  }

  function removeNewRow(tempId: string) {
    setNewRows((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  function discardAll() {
    setEdits(new Map());
    setDeleted(new Map());
    setNewRows([]);
    setEditingCell(null);
  }

  async function commit() {
    const changes: RowChange[] = [];
    for (const entry of edits.values()) {
      if (Object.keys(entry.values).length > 0) {
        changes.push({ kind: "update", pk: entry.pk, values: entry.values });
      }
    }
    for (const pk of deleted.values()) {
      changes.push({ kind: "delete", pk });
    }
    for (const nr of newRows) {
      changes.push({ kind: "insert", values: nr.values });
    }
    if (changes.length === 0) return;

    setCommitting(true);
    setError(null);
    try {
      await api.applyRowChanges(connectionId, table, changes);
      discardAll();
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setCommitting(false);
    }
  }

  function toggleSort(col: string) {
    if (sortColumn !== col) {
      setSortColumn(col);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortColumn(undefined);
    }
    setPage(0);
  }

  async function handleExport(format: "csv" | "json") {
    const rows = displayRows.filter((r) => !r.isDeleted).map((r) => columns.map((c) => r.values[c]));
    if (format === "csv") await exportCsv(columns, rows, table);
    else await exportJson(columns, rows, table);
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[var(--qd-border)] bg-[var(--qd-bg-elevated)]">
        <Button variant="default" size="sm" icon={<Plus size={12} />} onClick={addRow}>
          Add row
        </Button>
        <Button variant="ghost" size="sm" icon={<Loader2 size={12} className={loading ? "animate-spin" : "hidden"} />} onClick={load}>
          Refresh
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" icon={<Download size={12} />} onClick={() => handleExport("csv")}>
          CSV
        </Button>
        <Button variant="ghost" size="sm" icon={<FileJson size={12} />} onClick={() => handleExport("json")}>
          JSON
        </Button>
      </div>

      {error && (
        <div className="px-3 py-2 text-[12px] text-[var(--qd-danger)] bg-[var(--qd-danger)]/10 border-b border-[var(--qd-border)] qd-mono whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto qd-mono text-[12px]">
        <table className="border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--qd-bg-inset)]">
              <th className="w-8 border-b border-r border-[var(--qd-border)]" />
              {columns.map((c) => (
                <th
                  key={c}
                  onClick={() => toggleSort(c)}
                  className="px-2 py-1.5 text-left font-medium border-b border-r border-[var(--qd-border)] cursor-pointer hover:bg-[var(--qd-bg)] whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    {c}
                    {sortColumn === c &&
                      (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr
                key={row.key}
                className={row.isDeleted ? "bg-[var(--qd-danger)]/10 line-through" : "hover:bg-[var(--qd-bg-inset)]/40"}
              >
                <td className="border-b border-r border-[var(--qd-border)] text-center">
                  <button
                    onClick={() => toggleDelete(row.key, row.pk)}
                    className="text-[var(--qd-text-muted)] hover:text-[var(--qd-danger)] cursor-pointer"
                    title={row.isDeleted ? "Undo delete" : "Delete row"}
                  >
                    {row.isDeleted ? <Undo2 size={12} /> : <Trash2 size={12} />}
                  </button>
                </td>
                {columns.map((c) => {
                  const isEditing = editingCell?.rowKey === row.key && editingCell?.col === c;
                  const edited = edits.get(row.key)?.values[c] !== undefined;
                  return (
                    <td
                      key={c}
                      onDoubleClick={() => !row.isDeleted && setEditingCell({ rowKey: row.key, col: c })}
                      className={`border-b border-r border-[var(--qd-border)] px-2 py-1 min-w-[100px] ${
                        edited ? "bg-[var(--qd-warning)]/10" : ""
                      }`}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={row.values[c] === null ? "" : String(row.values[c])}
                          onBlur={(e) => {
                            setCellValue(row.key, c, e.target.value === "" ? null : e.target.value, row.pk);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-full bg-transparent outline-none border-b border-[var(--qd-accent)]"
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-1 group">
                          <span
                            className={`truncate ${row.values[c] === null ? "text-[var(--qd-text-muted)] italic" : ""}`}
                          >
                            {row.values[c] === null ? "NULL" : String(row.values[c])}
                          </span>
                          <button
                            onClick={() => duplicateRow(row.values)}
                            className="opacity-0 group-hover:opacity-100 text-[var(--qd-text-muted)] hover:text-[var(--qd-accent)] shrink-0 cursor-pointer"
                            title="Duplicate row"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {newRows.map((nr) => (
              <tr key={nr.tempId} className="bg-[var(--qd-success)]/10">
                <td className="border-b border-r border-[var(--qd-border)] text-center">
                  <button
                    onClick={() => removeNewRow(nr.tempId)}
                    className="text-[var(--qd-text-muted)] hover:text-[var(--qd-danger)] cursor-pointer"
                    title="Remove new row"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
                {columns.map((c) => {
                  const isEditing = editingCell?.rowKey === nr.tempId && editingCell?.col === c;
                  return (
                    <td
                      key={c}
                      onDoubleClick={() => setEditingCell({ rowKey: nr.tempId, col: c })}
                      className="border-b border-r border-[var(--qd-border)] px-2 py-1 min-w-[100px]"
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          defaultValue={nr.values[c] === undefined || nr.values[c] === null ? "" : String(nr.values[c])}
                          onBlur={(e) => {
                            setNewRowValue(nr.tempId, c, e.target.value === "" ? null : e.target.value);
                            setEditingCell(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                          className="w-full bg-transparent outline-none border-b border-[var(--qd-accent)]"
                        />
                      ) : (
                        <span className="text-[var(--qd-text-muted)] italic">
                          {nr.values[c] === undefined || nr.values[c] === null ? "default" : String(nr.values[c])}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-8 shrink-0 flex items-center gap-2 px-3 border-t border-[var(--qd-border)] bg-[var(--qd-bg-elevated)] text-[11px] text-[var(--qd-text-muted)]">
        <span>{totalRows.toLocaleString()} rows</span>
        <div className="flex items-center gap-1 ml-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <span>
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="cursor-pointer disabled:opacity-30"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {dirtyCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[var(--qd-warning)]">{dirtyCount} pending change{dirtyCount === 1 ? "" : "s"}</span>
            <Button variant="ghost" size="sm" icon={<RotateCcw size={11} />} onClick={discardAll} disabled={committing}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={committing ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              onClick={commit}
              disabled={committing}
            >
              Commit
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
