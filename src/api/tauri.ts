import { invoke } from "@tauri-apps/api/core";
import type {
  OpenDatabaseResult,
  PostgresConnectionConfig,
  QueryResult,
  RowChange,
  SchemaInfo,
  TablePage,
} from "../types";

export const api = {
  openDatabase: (path: string) => invoke<OpenDatabaseResult>("open_database", { path }),

  connectPostgres: (config: PostgresConnectionConfig) =>
    invoke<OpenDatabaseResult>("open_postgres_database", { config }),

  closeDatabase: (id: string) => invoke<void>("close_database", { id }),

  getSchema: (id: string) => invoke<SchemaInfo>("get_schema", { id }),

  executeQuery: (id: string, sql: string) => invoke<QueryResult>("execute_query", { id, sql }),

  fetchTablePage: (
    id: string,
    table: string,
    limit: number,
    offset: number,
    sortColumn?: string,
    sortDir?: "asc" | "desc",
  ) => invoke<TablePage>("fetch_table_page", { id, table, limit, offset, sortColumn, sortDir }),

  applyRowChanges: (id: string, table: string, changes: RowChange[]) =>
    invoke<void>("apply_row_changes", { id, table, changes }),
};
