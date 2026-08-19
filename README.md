# QueryDeck

A desktop SQL client for browsing and editing SQLite and Postgres databases — built independently with Tauri, Rust, and
React.

## Features

- Open or create SQLite databases, or connect to Postgres with host/port/user/password/database
  credentials (SSL disable/prefer/require, with an option to trust self-signed certs) — plus a
  recent-connections list for both
- Schema explorer: tables, views, columns (types, primary keys), indexes
- SQL query editor (CodeMirror) with schema-aware autocomplete, multiple tabs, ⌘/Ctrl+Enter to run
  the statement under the cursor
- Virtualized, column-resizable results grid with click-to-copy cells
- Editable table data view: paginated, sortable, inline cell editing, add/duplicate/delete rows,
  with changes staged locally and applied transactionally on **Commit** (or thrown away on
  **Discard**)
- CSV / JSON export from both the query results grid and the table editor
- Query history, persisted across restarts
- Light / dark theme

SQLite and Postgres are both supported. Postgres connection passwords are never persisted (recent
Postgres connections are saved without a password, so reconnecting from the list re-prompts for
it); everything else is saved via `tauri-plugin-store`. The Rust backend abstracts over dialects
through a `DbConnection` enum (`src-tauri/src/db/mod.rs`, `src-tauri/src/db/pg.rs`), so another
dialect (e.g. SQL Server) could be added behind the same command interface later.

### Postgres implementation notes

- Reads (arbitrary queries and table-page fetches) use the simple query protocol, which returns
  every value as text — this sidesteps needing to decode dozens of Postgres OIDs into JSON, at the
  cost of numbers/booleans arriving as strings rather than native JSON types.
- Writes (row inserts/updates/deletes from the table editor) use the extended protocol with every
  parameter bound as `TEXT` and cast to the destination column's real type in the SQL itself
  (`$1::int4`, `$1::timestamp`, etc.) — the standard way to send dynamically-typed values through
  `tokio-postgres` without knowing column types at compile time.
- Tables without a primary key fall back to using every column as a composite identity for
  edits, since Postgres has no stable per-row identifier equivalent to SQLite's `rowid` (`ctid`
  changes across updates/vacuums).
- Only the `public` schema is introspected for now.

## Development

Requires Node.js and the Rust toolchain (`rustup`).

```bash
npm install
npm run tauri dev
```

`npm run tauri build` produces a distributable app bundle.

## Architecture

- `src-tauri/src/db/` — dialect-specific database access (schema introspection, query execution,
  paginated table reads, transactional row mutations): `schema.rs`/`query.rs`/`pagination.rs`/
  `mutation.rs` implement SQLite via `rusqlite`, `pg.rs` implements Postgres via the `postgres`
  crate. Both are guarded against SQL injection on identifiers by validating table/column names
  against `sqlite_master`/`PRAGMA table_info` (SQLite) or `information_schema` (Postgres) before
  interpolating them into SQL.
- `src-tauri/src/commands.rs` — thin Tauri command layer exposed to the frontend.
- `src/store/` — Zustand stores for open connections, tabs (query + table), and theme.
- `src/components/` — UI, split into `layout`, `schema`, `editor`, `results`, `table-editor`,
  `connection`, and `history`.

Recent connections and query history are persisted via `tauri-plugin-store` to JSON files in the
app's config directory; theme preference is persisted in `localStorage`.
