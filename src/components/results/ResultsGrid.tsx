import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import type { JsonValue } from "../../types";

interface ResultsGridProps {
  columns: string[];
  rows: JsonValue[][];
}

const DEFAULT_COL_WIDTH = 160;
const ROW_HEIGHT = 26;

function formatCell(v: JsonValue): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

export function ResultsGrid({ columns, rows }: ResultsGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<number[]>(() => columns.map(() => DEFAULT_COL_WIDTH));
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const dragState = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  const widths = colWidths.length === columns.length ? colWidths : columns.map(() => DEFAULT_COL_WIDTH);
  const gridTemplate = useMemo(() => widths.map((w) => `${w}px`).join(" "), [widths]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  function startResize(index: number, e: React.MouseEvent) {
    e.preventDefault();
    dragState.current = { index, startX: e.clientX, startWidth: widths[index] };
    function onMove(ev: MouseEvent) {
      const d = dragState.current;
      if (!d) return;
      const next = Math.max(60, d.startWidth + (ev.clientX - d.startX));
      setColWidths((prev) => {
        const copy = prev.length === columns.length ? [...prev] : columns.map(() => DEFAULT_COL_WIDTH);
        copy[d.index] = next;
        return copy;
      });
    }
    function onUp() {
      dragState.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function copyCell(row: number, col: number) {
    setSelected({ row, col });
    const value = formatCell(rows[row][col]);
    navigator.clipboard.writeText(value).catch(() => {});
  }

  if (columns.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[12px] text-[var(--qd-text-muted)]">
        No result set for this statement.
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto qd-mono text-[12px]">
      <div style={{ minWidth: "max-content" }}>
        <div
          className="grid sticky top-0 z-10 bg-[var(--qd-bg-inset)] border-b border-[var(--qd-border)]"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {columns.map((c, i) => (
            <div
              key={c + i}
              className="relative px-2 py-1.5 font-medium truncate border-r border-[var(--qd-border)] select-none"
              title={c}
            >
              {c}
              <div
                onMouseDown={(e) => startResize(i, e)}
                className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--qd-accent)]"
              />
            </div>
          ))}
        </div>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={vi.key}
                className={`grid absolute left-0 right-0 border-b border-[var(--qd-border)]/60 ${
                  vi.index % 2 === 1 ? "bg-[var(--qd-bg-inset)]/40" : ""
                }`}
                style={{ gridTemplateColumns: gridTemplate, top: vi.start, height: vi.size }}
              >
                {row.map((cell, ci) => {
                  const isSelected = selected?.row === vi.index && selected?.col === ci;
                  return (
                    <div
                      key={ci}
                      onClick={() => copyCell(vi.index, ci)}
                      className={`px-2 flex items-center truncate border-r border-[var(--qd-border)]/40 cursor-cell ${
                        cell === null ? "text-[var(--qd-text-muted)] italic" : ""
                      } ${isSelected ? "outline outline-1 outline-[var(--qd-accent)] -outline-offset-1" : ""}`}
                      title={formatCell(cell)}
                    >
                      {cell === null ? "NULL" : formatCell(cell)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
