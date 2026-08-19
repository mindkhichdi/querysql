import { load, Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { api } from "../api/tauri";
import type { QueryResult } from "../types";

export interface QueryTab {
  id: string;
  kind: "query";
  connectionId: string;
  title: string;
  sql: string;
  result: QueryResult | null;
  error: string | null;
  isRunning: boolean;
}

export interface TableTab {
  id: string;
  kind: "table";
  connectionId: string;
  title: string;
  table: string;
}

export type Tab = QueryTab | TableTab;

export interface HistoryEntry {
  id: string;
  connectionId: string;
  sql: string;
  ranAt: number;
  durationMs: number | null;
  rowsAffected: number | null;
  success: boolean;
  error?: string;
}

let queryTabCounter = 0;

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  history: HistoryEntry[];
  historyStore: Store | null;

  initHistory: () => Promise<void>;
  openQueryTab: (connectionId: string, initialSql?: string) => string;
  openTableTab: (connectionId: string, table: string) => string;
  closeTab: (id: string) => void;
  closeTabsForConnection: (connectionId: string) => void;
  setActiveTab: (id: string) => void;
  setSql: (id: string, sql: string) => void;
  runQuery: (id: string, sqlOverride?: string) => Promise<void>;
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  history: [],
  historyStore: null,

  initHistory: async () => {
    if (get().historyStore) return;
    const store = await load("history.json", { autoSave: true });
    const history = (await store.get<HistoryEntry[]>("history")) ?? [];
    set({ historyStore: store, history });
  },

  openQueryTab: (connectionId, initialSql = "") => {
    queryTabCounter += 1;
    const id = `query-${Date.now()}-${queryTabCounter}`;
    const tab: QueryTab = {
      id,
      kind: "query",
      connectionId,
      title: `Query ${queryTabCounter}`,
      sql: initialSql,
      result: null,
      error: null,
      isRunning: false,
    };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    return id;
  },

  openTableTab: (connectionId, table) => {
    const existing = get().tabs.find(
      (t) => t.kind === "table" && t.connectionId === connectionId && t.table === table,
    );
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = `table-${connectionId}-${table}`;
    const tab: TableTab = { id, kind: "table", connectionId, title: table, table };
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
    return id;
  },

  closeTab: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (activeTabId === id) {
        const fallback = tabs[idx] ?? tabs[idx - 1] ?? tabs[0];
        activeTabId = fallback ? fallback.id : null;
      }
      return { tabs, activeTabId };
    });
  },

  closeTabsForConnection: (connectionId) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.connectionId !== connectionId);
      const activeTabId = tabs.some((t) => t.id === s.activeTabId)
        ? s.activeTabId
        : (tabs[0]?.id ?? null);
      return { tabs, activeTabId };
    });
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  setSql: (id, sql) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id && t.kind === "query" ? { ...t, sql } : t)),
    }));
  },

  runQuery: async (id, sqlOverride) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || tab.kind !== "query") return;
    const sqlToRun = (sqlOverride ?? tab.sql).trim();
    if (!sqlToRun) return;

    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, isRunning: true, error: null } : t)),
    }));

    const entry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      connectionId: tab.connectionId,
      sql: sqlToRun,
      ranAt: Date.now(),
      durationMs: null,
      rowsAffected: null,
      success: false,
    };

    try {
      const result = await api.executeQuery(tab.connectionId, sqlToRun);
      entry.durationMs = result.duration_ms;
      entry.rowsAffected = result.rows_affected;
      entry.success = true;
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id && t.kind === "query" ? { ...t, result, error: null, isRunning: false } : t,
        ),
      }));
    } catch (err) {
      entry.error = String(err);
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id && t.kind === "query"
            ? { ...t, error: String(err), isRunning: false }
            : t,
        ),
      }));
    }

    const history = [entry, ...get().history].slice(0, 200);
    set({ history });
    const { historyStore } = get();
    if (historyStore) {
      await historyStore.set("history", history);
      await historyStore.save();
    }
  },
}));
