import { open, save } from "@tauri-apps/plugin-dialog";
import { Database, FolderOpen, Plus, Server, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../common/Button";
import { PostgresConnectForm } from "./PostgresConnectForm";
import { useConnectionStore, type RecentConnection } from "../../store/connectionStore";
import { useThemeStore } from "../../store/themeStore";

export function ConnectionScreen() {
  const { recents, initRecents, openDatabase, removeRecent } = useConnectionStore();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pgForm, setPgForm] = useState<RecentConnection["pg"]>(undefined);
  const [showPgForm, setShowPgForm] = useState(false);

  useEffect(() => {
    initRecents();
  }, [initRecents]);

  async function handleOpen() {
    setError(null);
    const path = await open({
      multiple: false,
      filters: [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }],
    });
    if (!path || Array.isArray(path)) return;
    await connect(path);
  }

  async function handleCreate() {
    setError(null);
    const path = await save({
      defaultPath: "database.db",
      filters: [{ name: "SQLite database", extensions: ["db", "sqlite", "sqlite3"] }],
    });
    if (!path) return;
    await connect(path);
  }

  async function connect(path: string) {
    setBusy(true);
    try {
      await openDatabase(path);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function openPgForm(initial?: RecentConnection["pg"]) {
    setPgForm(initial);
    setShowPgForm(true);
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[var(--qd-bg)] text-[var(--qd-text)] relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 text-[11px] text-[var(--qd-text-muted)] hover:text-[var(--qd-text)] cursor-pointer"
      >
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>

      <div className="w-[440px]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[var(--qd-accent)] flex items-center justify-center">
            <Database size={17} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold">QueryDeck</h1>
        </div>
        <p className="text-[12.5px] text-[var(--qd-text-muted)] mb-6">
          Rethink how you query, explore, and work with data.
        </p>

        <div className="flex gap-2 mb-6">
          <Button variant="primary" onClick={handleOpen} disabled={busy} icon={<FolderOpen size={14} />}>
            Open database
          </Button>
          <Button variant="default" onClick={handleCreate} disabled={busy} icon={<Plus size={14} />}>
            New database
          </Button>
          <Button variant="default" onClick={() => openPgForm()} disabled={busy} icon={<Server size={14} />}>
            Connect to Postgres
          </Button>
        </div>

        {error && (
          <div className="mb-4 text-[12px] text-[var(--qd-danger)] bg-[var(--qd-danger)]/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {recents.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--qd-text-muted)] mb-2">
              Recent
            </div>
            <div className="rounded-lg border border-[var(--qd-border)] divide-y divide-[var(--qd-border)] overflow-hidden">
              {recents.map((r) => (
                <div
                  key={`${r.kind}-${r.path}`}
                  className="group w-full flex items-center gap-2.5 pl-3 pr-1.5 py-2 hover:bg-[var(--qd-bg-elevated)]"
                >
                  <button
                    onClick={() => (r.kind === "postgres" ? openPgForm(r.pg) : connect(r.path))}
                    disabled={busy}
                    className="flex-1 min-w-0 text-left flex items-center gap-2.5 cursor-pointer disabled:opacity-40"
                  >
                    {r.kind === "postgres" ? (
                      <Server size={13} className="text-[var(--qd-accent)] shrink-0" />
                    ) : (
                      <Database size={13} className="text-[var(--qd-text-muted)] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12.5px] truncate">{r.name}</div>
                      <div className="text-[11px] text-[var(--qd-text-muted)] truncate qd-mono">
                        {r.path}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => removeRecent(r)}
                    disabled={busy}
                    title="Remove from recent"
                    className="shrink-0 rounded-sm p-1 opacity-0 group-hover:opacity-100 text-[var(--qd-text-muted)] hover:text-[var(--qd-danger)] cursor-pointer disabled:opacity-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPgForm && (
        <PostgresConnectForm
          initial={pgForm}
          onClose={() => setShowPgForm(false)}
          onConnected={() => setShowPgForm(false)}
        />
      )}
    </div>
  );
}
