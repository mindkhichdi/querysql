import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import type { SchemaInfo } from "../types";

const KEYWORDS = [
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "CROSS", "ON", "GROUP", "BY", "ORDER",
  "HAVING", "LIMIT", "OFFSET", "AS", "AND", "OR", "NOT", "NULL", "IS", "IN", "LIKE",
  "BETWEEN", "DISTINCT", "CREATE", "TABLE", "DROP", "ALTER", "INDEX", "VIEW",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "UNIQUE", "CHECK", "CASE",
  "WHEN", "THEN", "ELSE", "END", "UNION", "ALL", "EXISTS", "COUNT", "SUM", "AVG",
  "MIN", "MAX", "ASC", "DESC", "WITH", "COALESCE",
];

const TABLE_CONTEXT = /\b(from|join|into|update)\s+["\w]*$/i;

function referencedTables(sqlSoFar: string, schema: SchemaInfo) {
  const names = new Set<string>();
  const re = /\b(?:from|join)\s+"?(\w+)"?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sqlSoFar))) names.add(m[1].toLowerCase());
  return schema.tables.filter((t) => names.has(t.name.toLowerCase()));
}

export function createSqlCompletionSource(getSchema: () => SchemaInfo | undefined) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/["\w]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const schema = getSchema();
    const textBefore = context.state.sliceDoc(0, word.from);
    const wantsTables = TABLE_CONTEXT.test(textBefore);

    const options: Completion[] = [];

    if (schema) {
      for (const t of schema.tables) {
        options.push({
          label: t.name,
          type: "class",
          detail: t.is_view ? "view" : "table",
          boost: wantsTables ? 2 : 0,
        });
      }
      const referenced = wantsTables ? [] : referencedTables(textBefore, schema);
      for (const t of referenced) {
        for (const c of t.columns) {
          options.push({ label: c.name, type: "property", detail: t.name, boost: 1 });
        }
      }
    }

    for (const kw of KEYWORDS) {
      options.push({ label: kw, type: "keyword" });
    }

    return { from: word.from, options, validFor: /^["\w]*$/ };
  };
}
