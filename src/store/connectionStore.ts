import { load, Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { api } from "../api/tauri";
import type { ConnectionKind, OpenDatabaseResult, PostgresConnectionConfig, SchemaInfo } from "../types";

export type PgRecentConfig = Omit<PostgresConnectionConfig, "password">;

export interface RecentConnection {
  kind: ConnectionKind;
  name: string;
  /** SQLite file path, or a password-free display string for Postgres. */
  path: string;
  lastOpened: number;
  /** Present for Postgres entries so the connect form can be pre-filled (password is never persisted). */
  pg?: PgRecentConfig;
}

interface ConnectionState {
  connections: OpenDatabaseResult[];
  activeId: string | null;
  schemas: Record<string, SchemaInfo>;
  recents: RecentConnection[];
  recentsStore: Store | null;
  initRecents: () => Promise<void>;
  openDatabase: (path: string) => Promise<OpenDatabaseResult>;
  connectPostgres: (config: PostgresConnectionConfig) => Promise<OpenDatabaseResult>;
  closeConnection: (id: string) => Promise<void>;
  setActive: (id: string) => void;
  refreshSchema: (id: string) => Promise<void>;
}

function pgRecentKey(pg: PgRecentConfig) {
  return `${pg.user}@${pg.host}:${pg.port}/${pg.database}`;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeId: null,
  schemas: {},
  recents: [],
  recentsStore: null,

  initRecents: async () => {
    if (get().recentsStore) return;
    const store = await load("recents.json", { autoSave: true });
    const recents = (await store.get<RecentConnection[]>("recents")) ?? [];
    set({ recentsStore: store, recents });
  },

  openDatabase: async (path) => {
    const result = await api.openDatabase(path);
    set((s) => ({
      connections: [...s.connections.filter((c) => c.id !== result.id), result],
      activeId: result.id,
    }));
    await get().refreshSchema(result.id);
    await recordRecent(get, set, { kind: "sqlite", name: result.name, path: result.path, lastOpened: Date.now() });
    return result;
  },

  connectPostgres: async (config) => {
    const result = await api.connectPostgres(config);
    set((s) => ({
      connections: [...s.connections.filter((c) => c.id !== result.id), result],
      activeId: result.id,
    }));
    await get().refreshSchema(result.id);
    const { password: _password, ...pg } = config;
    await recordRecent(get, set, {
      kind: "postgres",
      name: result.name,
      path: result.path,
      lastOpened: Date.now(),
      pg,
    });
    return result;
  },

  closeConnection: async (id) => {
    await api.closeDatabase(id);
    set((s) => {
      const connections = s.connections.filter((c) => c.id !== id);
      const activeId = s.activeId === id ? (connections[0]?.id ?? null) : s.activeId;
      const schemas = { ...s.schemas };
      delete schemas[id];
      return { connections, activeId, schemas };
    });
  },

  setActive: (id) => set({ activeId: id }),

  refreshSchema: async (id) => {
    const schema = await api.getSchema(id);
    set((s) => ({ schemas: { ...s.schemas, [id]: schema } }));
  },
}));

async function recordRecent(
  get: () => ConnectionState,
  set: (partial: Partial<ConnectionState>) => void,
  entry: RecentConnection,
) {
  const { recentsStore, recents } = get();
  const dedupeKey = (r: RecentConnection) => (r.kind === "postgres" && r.pg ? pgRecentKey(r.pg) : r.path);
  const nextRecents = [entry, ...recents.filter((r) => dedupeKey(r) !== dedupeKey(entry))].slice(0, 12);
  set({ recents: nextRecents });
  if (recentsStore) {
    await recentsStore.set("recents", nextRecents);
    await recentsStore.save();
  }
}
