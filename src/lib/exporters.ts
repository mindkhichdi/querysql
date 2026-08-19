import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { JsonValue } from "../types";

function toCsvCell(v: JsonValue): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function exportCsv(columns: string[], rows: JsonValue[][], suggestedName: string) {
  const path = await save({
    defaultPath: `${suggestedName}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;
  const lines = [columns.map(toCsvCell).join(",")];
  for (const row of rows) lines.push(row.map(toCsvCell).join(","));
  await writeTextFile(path, lines.join("\n"));
  return true;
}

export async function exportJson(columns: string[], rows: JsonValue[][], suggestedName: string) {
  const path = await save({
    defaultPath: `${suggestedName}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return false;
  const objects = rows.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
  await writeTextFile(path, JSON.stringify(objects, null, 2));
  return true;
}
