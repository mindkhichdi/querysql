import { Loader2, Server, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../common/Button";
import { useConnectionStore } from "../../store/connectionStore";
import type { PostgresConnectionConfig, SslMode } from "../../types";

interface PostgresConnectFormProps {
  initial?: Partial<PostgresConnectionConfig>;
  onClose: () => void;
  onConnected: () => void;
}

const inputClass =
  "w-full h-7 px-2 rounded-md bg-[var(--qd-bg-inset)] border border-[var(--qd-border)] text-[12.5px] outline-none focus:border-[var(--qd-accent)]";
const labelClass = "text-[11px] text-[var(--qd-text-muted)] mb-1 block";

export function PostgresConnectForm({ initial, onClose, onConnected }: PostgresConnectFormProps) {
  const connectPostgres = useConnectionStore((s) => s.connectPostgres);
  const [host, setHost] = useState(initial?.host ?? "localhost");
  const [port, setPort] = useState(initial?.port ?? 5432);
  const [user, setUser] = useState(initial?.user ?? "postgres");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState(initial?.database ?? "postgres");
  const [sslMode, setSslMode] = useState<SslMode>(initial?.sslMode ?? "prefer");
  const [acceptInvalidCerts, setAcceptInvalidCerts] = useState(initial?.acceptInvalidCerts ?? false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      await connectPostgres({ host, port, user, password, database, sslMode, acceptInvalidCerts });
      onConnected();
    } catch (err) {
      setError(String(err));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[380px] rounded-lg border border-[var(--qd-border)] bg-[var(--qd-bg-elevated)] shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--qd-border)]">
          <div className="flex items-center gap-1.5">
            <Server size={14} className="text-[var(--qd-accent)]" />
            <span className="text-[13px] font-medium">Connect to Postgres</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--qd-text-muted)] hover:text-[var(--qd-text)] cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-[3]">
              <label className={labelClass}>Host</label>
              <input className={inputClass} value={host} onChange={(e) => setHost(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Port</label>
              <input
                className={inputClass}
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Database</label>
            <input
              className={inputClass}
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>User</label>
              <input className={inputClass} value={user} onChange={(e) => setUser(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Password</label>
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>SSL mode</label>
            <select
              className={inputClass}
              value={sslMode}
              onChange={(e) => setSslMode(e.target.value as SslMode)}
            >
              <option value="disable">Disable</option>
              <option value="prefer">Prefer</option>
              <option value="require">Require</option>
            </select>
          </div>

          {sslMode !== "disable" && (
            <label className="flex items-center gap-2 text-[11.5px] text-[var(--qd-text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={acceptInvalidCerts}
                onChange={(e) => setAcceptInvalidCerts(e.target.checked)}
              />
              Trust self-signed / invalid certificates
            </label>
          )}

          {error && (
            <div className="text-[11.5px] text-[var(--qd-danger)] bg-[var(--qd-danger)]/10 rounded-md px-2.5 py-1.5 qd-mono whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--qd-border)]">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={connecting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={connecting ? <Loader2 size={12} className="animate-spin" /> : undefined}
            disabled={connecting}
          >
            Connect
          </Button>
        </div>
      </form>
    </div>
  );
}
