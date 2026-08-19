export type JsonValue = string | number | boolean | null;

export interface ColumnInfo {
  name: string;
  type: string;
  not_null: boolean;
  primary_key: boolean;
  default_value: string | null;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableInfo {
  name: string;
  is_view: boolean;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
}

export interface SchemaInfo {
  tables: TableInfo[];
}

export interface QueryResult {
  columns: string[];
  rows: JsonValue[][];
  rows_affected: number;
  duration_ms: number;
}

export interface TablePage {
  columns: string[];
  pk_columns: string[];
  rows: JsonValue[][];
  total_rows: number;
}

export type ConnectionKind = "sqlite" | "postgres";

export interface OpenDatabaseResult {
  id: string;
  path: string;
  name: string;
  kind: ConnectionKind;
}

export type SslMode = "disable" | "prefer" | "require";

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslMode: SslMode;
  acceptInvalidCerts: boolean;
}

export type RowChange =
  | { kind: "insert"; values: Record<string, JsonValue> }
  | { kind: "update"; pk: Record<string, JsonValue>; values: Record<string, JsonValue> }
  | { kind: "delete"; pk: Record<string, JsonValue> };
