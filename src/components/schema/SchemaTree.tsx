import { ChevronRight, Hash, KeyRound, Table2, View } from "lucide-react";
import { useState } from "react";
import type { TableInfo } from "../../types";

interface SchemaTreeProps {
  tables: TableInfo[];
  onOpenTable: (table: string) => void;
}

export function SchemaTree({ tables, onOpenTable }: SchemaTreeProps) {
  if (tables.length === 0) {
    return (
      <div className="px-3 py-4 text-[12px] text-[var(--qd-text-muted)]">
        No tables yet. Run a <span className="qd-mono">CREATE TABLE</span> statement to get
        started.
      </div>
    );
  }
  return (
    <div className="py-1">
      {tables.map((t) => (
        <TableNode key={t.name} table={t} onOpenTable={onOpenTable} />
      ))}
    </div>
  );
}

function TableNode({ table, onOpenTable }: { table: TableInfo; onOpenTable: (t: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        className="group flex items-center gap-1 px-2 py-1 hover:bg-[var(--qd-bg-inset)] cursor-pointer text-[12.5px] rounded-sm mx-1"
        onClick={() => onOpenTable(table.name)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[var(--qd-text-muted)] shrink-0 cursor-pointer"
        >
          <ChevronRight
            size={12}
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        {table.is_view ? (
          <View size={13} className="text-[var(--qd-text-muted)] shrink-0" />
        ) : (
          <Table2 size={13} className="text-[var(--qd-accent)] shrink-0" />
        )}
        <span className="truncate">{table.name}</span>
      </div>
      {expanded && (
        <div className="ml-6 border-l border-[var(--qd-border)] pl-2">
          {table.columns.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-1.5 px-1.5 py-0.5 text-[11.5px] text-[var(--qd-text-muted)]"
            >
              {c.primary_key ? (
                <KeyRound size={10} className="text-[var(--qd-warning)] shrink-0" />
              ) : (
                <Hash size={10} className="opacity-0 shrink-0" />
              )}
              <span className="qd-mono truncate text-[var(--qd-text)]">{c.name}</span>
              <span className="qd-mono truncate uppercase text-[10px]">{c.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
