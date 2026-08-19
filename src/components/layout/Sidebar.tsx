import { ChevronDown, Database, FilePlus2, FolderOpen, Plus, Server } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { SchemaTree } from "../schema/SchemaTree";
import { Button } from "../common/Button";
import { PostgresConnectForm } from "../connection/PostgresConnectForm";
import { useConnectionStore } from "../../store/connectionStore";
import { useTabStore } from "../../store/tabStore";

export function Sidebar() {
  const { connections, activeId, schemas, setActive, openDatabase } = useConnectionStore();
  const openQueryTab = useTabStore((s) => s.openQueryTab);
  const openTableTab = useTabStore((s) => s.openTableTab);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [showPgForm, setShowPgForm] = useState(false);

  const active = connections.find((c) => c.id === activeId) ?? null;
  const schema = activeId ? schemas[activeId] : undefined;

  async function handleOpenAnother() {
    setSwitcherOpen(false);
    const path = await open({
      multiple: false,
      filters: [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }],
    });
    if (!path || Array.isArray(path)) return;
    await openDatabase(path);
  }

  async function handleCreateAnother() {
    setSwitcherOpen(false);
    const path = await save({
      defaultPath: "database.db",
      filters: [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }],
    });
    if (!path) return;
    await openDatabase(path);
  }

  return (
    <div className="h-full w-60 shrink-0 flex flex-col bg-[var(--qd-bg-elevated)] border-r border-[var(--qd-border)]">
      <div className="relative border-b border-[var(--qd-border)]">
        <button
          onClick={() => setSwitcherOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-2.5 py-2 hover:bg-[var(--qd-bg-inset)] cursor-pointer text-left"
        >
          {active?.kind === "postgres" ? (
            <Server size={12} className="text-[var(--qd-accent)] shrink-0" />
          ) : (
            <Database size={12} className="text-[var(--qd-text-muted)] shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium truncate">{active?.name ?? "No database"}</div>
          </div>
          <ChevronDown size={13} className="text-[var(--qd-text-muted)] shrink-0" />
        </button>

        {switcherOpen && (
          <div className="absolute z-20 left-2 right-2 top-[calc(100%-4px)] rounded-md border border-[var(--qd-border)] bg-[var(--qd-bg-elevated)] shadow-lg overflow-hidden">
            {connections.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActive(c.id);
                  setSwitcherOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-[var(--qd-bg-inset)] cursor-pointer truncate flex items-center gap-1.5 ${
                  c.id === activeId ? "text-[var(--qd-accent)]" : ""
                }`}
              >
                {c.kind === "postgres" ? <Server size={11} className="shrink-0" /> : <Database size={11} className="shrink-0" />}
                <span className="truncate">{c.name}</span>
              </button>
            ))}
            <div className="border-t border-[var(--qd-border)]">
              <button
                onClick={handleOpenAnother}
                className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-[var(--qd-bg-inset)] cursor-pointer flex items-center gap-1.5 text-[var(--qd-text-muted)]"
              >
                <FolderOpen size={12} /> Open database…
              </button>
              <button
                onClick={handleCreateAnother}
                className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-[var(--qd-bg-inset)] cursor-pointer flex items-center gap-1.5 text-[var(--qd-text-muted)]"
              >
                <FilePlus2 size={12} /> New database…
              </button>
              <button
                onClick={() => {
                  setSwitcherOpen(false);
                  setShowPgForm(true);
                }}
                className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-[var(--qd-bg-inset)] cursor-pointer flex items-center gap-1.5 text-[var(--qd-text-muted)]"
              >
                <Server size={12} /> Connect to Postgres…
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="px-2 pt-2">
        <Button
          variant="default"
          size="sm"
          className="w-full justify-start"
          icon={<Plus size={12} />}
          disabled={!activeId}
          onClick={() => activeId && openQueryTab(activeId)}
        >
          New query
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto mt-2">
        <div className="px-3 pb-1 text-[10.5px] uppercase tracking-wide text-[var(--qd-text-muted)]">
          Tables
        </div>
        {schema ? (
          <SchemaTree
            tables={schema.tables}
            onOpenTable={(table) => activeId && openTableTab(activeId, table)}
          />
        ) : (
          <div className="px-3 py-4 text-[12px] text-[var(--qd-text-muted)]">Loading…</div>
        )}
      </div>

      {showPgForm && (
        <PostgresConnectForm onClose={() => setShowPgForm(false)} onConnected={() => setShowPgForm(false)} />
      )}
    </div>
  );
}
