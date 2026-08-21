import { Maximize2, Table2, View, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useConnectionStore } from "../../store/connectionStore";
import type { ColumnInfo, TableInfo } from "../../types";

const CARD_WIDTH = 260;
const LEVEL_GAP = 90;
const CARD_GAP_Y = 28;
const HEADER_H = 38;
const ROW_H = 30;
const INDEXES_HEADER_H = 26;
const INDEX_ROW_H = 18;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.75;

function estimateCardHeight(table: TableInfo): number {
  let h = HEADER_H + table.columns.length * ROW_H;
  if (table.indexes.length > 0) {
    h += INDEXES_HEADER_H + table.indexes.length * INDEX_ROW_H;
  }
  return h;
}

/** Assigns each table a horizontal "level" = 1 + the deepest level among the
 * tables it references, so referenced tables land to the left of their
 * dependents. Cycle-safe (a table mid-resolution is treated as level 0). */
function computeLevels(tables: TableInfo[]): Map<string, number> {
  const byName = new Map(tables.map((t) => [t.name, t]));
  const levels = new Map<string, number>();
  const resolving = new Set<string>();

  function levelOf(name: string): number {
    const cached = levels.get(name);
    if (cached !== undefined) return cached;
    const table = byName.get(name);
    if (!table || resolving.has(name)) return 0;
    resolving.add(name);
    let level = 0;
    for (const fk of table.foreign_keys) {
      if (fk.ref_table === name || !byName.has(fk.ref_table)) continue;
      level = Math.max(level, levelOf(fk.ref_table) + 1);
    }
    resolving.delete(name);
    levels.set(name, level);
    return level;
  }

  for (const t of tables) levelOf(t.name);
  return levels;
}

interface LayoutNode {
  table: TableInfo;
  x: number;
  y: number;
  height: number;
}

function computeLayout(tables: TableInfo[]): { nodes: LayoutNode[]; width: number; height: number } {
  const levels = computeLevels(tables);
  const columns = new Map<number, TableInfo[]>();
  for (const t of tables) {
    const lvl = levels.get(t.name) ?? 0;
    if (!columns.has(lvl)) columns.set(lvl, []);
    columns.get(lvl)!.push(t);
  }

  const nodes: LayoutNode[] = [];
  let maxWidth = 0;
  let maxHeight = 0;
  for (const [lvl, tablesInLevel] of columns) {
    const x = lvl * (CARD_WIDTH + LEVEL_GAP) + 24;
    let y = 24;
    for (const t of tablesInLevel) {
      const height = estimateCardHeight(t);
      nodes.push({ table: t, x, y, height });
      y += height + CARD_GAP_Y;
    }
    maxWidth = Math.max(maxWidth, x + CARD_WIDTH);
    maxHeight = Math.max(maxHeight, y);
  }
  return { nodes, width: maxWidth + 24, height: maxHeight + 24 };
}

interface Edge {
  key: string;
  source: string;
  target: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  onDelete: string;
  destructive: boolean;
}

function chipsForColumn(col: ColumnInfo, fkColumns: Set<string>): string[] {
  const chips: string[] = [];
  if (col.primary_key) chips.push("PK");
  if (fkColumns.has(col.name)) chips.push("FK");
  if (col.unique) chips.push("UQ");
  if (col.not_null && !col.primary_key) chips.push("NN");
  return chips;
}

function Chip({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-sm border border-[var(--qd-border)] px-1 py-[1px] text-[9px] leading-tight qd-mono text-[var(--qd-text-muted)]">
      {label}
    </span>
  );
}

interface TableCardProps {
  table: TableInfo;
  schemaPrefix: string;
  registerColumnRef: (table: string, column: string, el: HTMLDivElement | null) => void;
  selected: boolean;
  connected: boolean;
  dimmed: boolean;
  onSelect: (table: string) => void;
}

function TableCard({
  table,
  schemaPrefix,
  registerColumnRef,
  selected,
  connected,
  dimmed,
  onSelect,
}: TableCardProps) {
  const fkColumns = useMemo(
    () => new Set(table.foreign_keys.flatMap((fk) => fk.columns)),
    [table.foreign_keys],
  );

  return (
    <div
      className="absolute rounded-md border bg-[var(--qd-bg-elevated)] overflow-hidden cursor-pointer"
      style={{
        width: CARD_WIDTH,
        borderColor: selected || connected ? "var(--qd-accent)" : "var(--qd-border)",
        boxShadow: selected
          ? "0 0 0 2px var(--qd-accent), 0 0 20px 3px var(--qd-accent)"
          : connected
            ? "0 0 0 1.5px var(--qd-accent)"
            : "0 1px 2px rgba(0,0,0,0.06)",
        opacity: dimmed ? 0.35 : 1,
        transition: "opacity 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(table.name);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-[var(--qd-border)] bg-[var(--qd-bg-inset)]">
        <div className="flex items-center gap-1.5 min-w-0">
          {table.is_view ? (
            <View size={13} className="text-[var(--qd-text-muted)] shrink-0" />
          ) : (
            <Table2 size={13} className="text-[var(--qd-accent)] shrink-0" />
          )}
          <span className="text-[12.5px] font-semibold truncate">
            {schemaPrefix}
            {table.name}
          </span>
        </div>
        <span className="shrink-0 rounded-sm border border-[var(--qd-border)] px-1 py-[1px] text-[9px] leading-tight qd-mono text-[var(--qd-text-muted)]">
          {table.is_view ? "VIEW" : "TABLE"}
        </span>
      </div>

      {table.columns.map((col) => (
        <div
          key={col.name}
          ref={(el) => registerColumnRef(table.name, col.name, el)}
          className="flex items-center gap-2 px-2.5 border-b border-[var(--qd-border)] last:border-b-0"
          style={{ height: ROW_H }}
        >
          <span className="text-[12px] font-medium truncate flex-1 qd-mono">{col.name}</span>
          <div className="flex items-center gap-1 shrink-0">
            {chipsForColumn(col, fkColumns).map((c) => (
              <Chip key={c} label={c} />
            ))}
          </div>
          <span className="qd-mono text-[10px] text-[var(--qd-text-muted)] shrink-0 max-w-[70px] truncate text-right">
            {col.type}
          </span>
        </div>
      ))}

      {table.indexes.length > 0 && (
        <div className="px-2.5 py-1.5 bg-[var(--qd-bg-inset)]">
          <div className="text-[9px] uppercase tracking-wide text-[var(--qd-text-muted)] mb-1">Indexes</div>
          {table.indexes.map((idx) => (
            <div key={idx.name} className="qd-mono text-[10.5px] text-[var(--qd-text-muted)] truncate leading-[18px]">
              {idx.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EdgeLine({ edge, highlighted, dimmed }: { edge: Edge; highlighted: boolean; dimmed: boolean }) {
  const dx = Math.max(Math.abs(edge.x2 - edge.x1) * 0.5, 30);
  const path = `M ${edge.x1} ${edge.y1} C ${edge.x1 + (edge.x2 > edge.x1 ? dx : -dx)} ${edge.y1}, ${
    edge.x2 + (edge.x2 > edge.x1 ? -dx : dx)
  } ${edge.y2}, ${edge.x2} ${edge.y2}`;
  const color = edge.destructive ? "var(--qd-warning)" : "var(--qd-text-muted)";
  const midX = (edge.x1 + edge.x2) / 2;
  const midY = (edge.y1 + edge.y2) / 2;
  const label = `ON DELETE ${edge.onDelete}`;
  const labelWidth = label.length * 5.4 + 8;
  const strokeWidth = highlighted ? (edge.destructive ? 3 : 2.25) : edge.destructive ? 2 : 1.25;
  const opacity = dimmed ? 0.08 : highlighted ? 1 : 0.8;

  return (
    <g style={{ transition: "opacity 150ms ease" }} opacity={opacity}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        filter={highlighted ? "url(#edge-glow)" : undefined}
      />
      {!dimmed && (
        <>
          <rect
            x={midX - labelWidth / 2}
            y={midY - 8}
            width={labelWidth}
            height={14}
            fill="var(--qd-bg)"
            opacity={0.92}
          />
          <text
            x={midX}
            y={midY + 3}
            textAnchor="middle"
            className="qd-mono"
            fontSize={9}
            fill={color}
            style={{ userSelect: "none" }}
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}

export function SchemaDiagram({ connectionId }: { connectionId: string }) {
  const schema = useConnectionStore((s) => s.schemas[connectionId]);
  const kind = useConnectionStore((s) => s.connections.find((c) => c.id === connectionId)?.kind);
  const schemaPrefix = kind === "postgres" ? "public." : "";

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const tables = schema?.tables ?? [];
  const layout = useMemo(() => computeLayout(tables), [tables]);

  const connectedTables = useMemo(() => {
    if (!selectedTable) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.source === selectedTable) set.add(e.target);
      if (e.target === selectedTable) set.add(e.source);
    }
    return set;
  }, [edges, selectedTable]);

  function toggleSelect(table: string) {
    setSelectedTable((cur) => (cur === table ? null : table));
  }

  useEffect(() => {
    if (selectedTable && !tables.some((t) => t.name === selectedTable)) {
      setSelectedTable(null);
    }
  }, [tables, selectedTable]);

  function registerColumnRef(table: string, column: string, el: HTMLDivElement | null) {
    const key = `${table}.${column}`;
    if (el) columnRefs.current.set(key, el);
    else columnRefs.current.delete(key);
  }

  useLayoutEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    function measure() {
      const contentRect = contentEl!.getBoundingClientRect();
      const z = zoom;
      const next: Edge[] = [];
      for (const t of tables) {
        for (const fk of t.foreign_keys) {
          if (fk.ref_table === t.name || fk.columns.length === 0) continue;
          const sourceKey = `${t.name}.${fk.columns[0]}`;
          const targetKey = `${fk.ref_table}.${fk.ref_columns[0]}`;
          const sourceEl = columnRefs.current.get(sourceKey);
          const targetEl = columnRefs.current.get(targetKey);
          if (!sourceEl || !targetEl) continue;
          const sRect = sourceEl.getBoundingClientRect();
          const tRect = targetEl.getBoundingClientRect();
          const sCenterX = (sRect.left - contentRect.left) / z;
          const sCenterY = (sRect.top - contentRect.top + sRect.height / 2) / z;
          const tCenterX = (tRect.left - contentRect.left) / z;
          const tCenterY = (tRect.top - contentRect.top + tRect.height / 2) / z;
          const goingRight = tCenterX >= sCenterX;
          const x1 = goingRight ? sCenterX + CARD_WIDTH : sCenterX;
          const x2 = goingRight ? tCenterX : tCenterX + CARD_WIDTH;
          next.push({
            key: `${t.name}.${fk.columns.join(",")}->${fk.ref_table}`,
            source: t.name,
            target: fk.ref_table,
            x1,
            y1: sCenterY,
            x2,
            y2: tCenterY,
            onDelete: fk.on_delete,
            destructive: fk.on_delete === "CASCADE",
          });
        }
      }
      setEdges(next);
    }

    measure();
    const raf = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => measure());
    observer.observe(contentEl);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
    // zoom intentionally excluded: logical coordinates are normalized by
    // dividing out the current zoom, so they don't need to be recomputed
    // when only the zoom level changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);

  function clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setZoom((z) => clampZoom(z - e.deltaY * 0.01));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragState.current) return;
    const { startX, startY, panX, panY } = dragState.current;
    setPan({ x: panX + (e.clientX - startX), y: panY + (e.clientY - startY) });
  }

  function stopDrag() {
    dragState.current = null;
  }

  if (!schema) {
    return (
      <div className="h-full flex items-center justify-center text-[12px] text-[var(--qd-text-muted)]">
        Loading schema…
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[12px] text-[var(--qd-text-muted)]">
        No tables to diagram yet.
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-[var(--qd-bg)] cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onClick={() => setSelectedTable(null)}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div
        ref={contentRef}
        className="absolute top-0 left-0"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={layout.width}
          height={layout.height}
        >
          <defs>
            <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map((edge) => {
            const highlighted =
              selectedTable !== null && (edge.source === selectedTable || edge.target === selectedTable);
            const dimmed = selectedTable !== null && !highlighted;
            return <EdgeLine key={edge.key} edge={edge} highlighted={highlighted} dimmed={dimmed} />;
          })}
        </svg>
        {layout.nodes.map((node) => {
          const selected = node.table.name === selectedTable;
          const connected = connectedTables.has(node.table.name);
          const dimmed = selectedTable !== null && !selected && !connected;
          return (
            <div key={node.table.name} style={{ position: "absolute", left: node.x, top: node.y }}>
              <TableCard
                table={node.table}
                schemaPrefix={schemaPrefix}
                registerColumnRef={registerColumnRef}
                selected={selected}
                connected={connected}
                dimmed={dimmed}
                onSelect={toggleSelect}
              />
            </div>
          );
        })}
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1 rounded-md border border-[var(--qd-border)] bg-[var(--qd-bg-elevated)] shadow-sm p-1">
        <button
          onClick={() => setZoom((z) => clampZoom(z - 0.15))}
          className="p-1 rounded-sm hover:bg-[var(--qd-bg-inset)] cursor-pointer text-[var(--qd-text-muted)]"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[11px] w-9 text-center qd-mono text-[var(--qd-text-muted)]">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom((z) => clampZoom(z + 0.15))}
          className="p-1 rounded-sm hover:bg-[var(--qd-bg-inset)] cursor-pointer text-[var(--qd-text-muted)]"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1 rounded-sm hover:bg-[var(--qd-bg-inset)] cursor-pointer text-[var(--qd-text-muted)]"
          title="Reset view"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 flex items-center gap-4 rounded-md border border-[var(--qd-border)] bg-[var(--qd-bg-elevated)] px-3 py-1.5 text-[10.5px] text-[var(--qd-text-muted)] shadow-sm">
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3.5 h-3.5 rounded-[3px] border border-[var(--qd-border)]" />
        Table
      </div>
      <div className="flex items-center gap-1.5">
        <Chip label="PK" />
        Constraint chip
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-4 h-0 border-t border-[var(--qd-text-muted)]" />
        Foreign key
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-4 h-0 border-t-2" style={{ borderColor: "var(--qd-warning)" }} />
        Destructive delete
      </div>
    </div>
  );
}
