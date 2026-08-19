function splitStatementBounds(sql: string): Array<[number, number]> {
  const bounds: Array<[number, number]> = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === ";" && !inSingle && !inDouble) {
      bounds.push([start, i]);
      start = i + 1;
    }
  }
  if (start < sql.length) bounds.push([start, sql.length]);
  return bounds;
}

/**
 * Naive statement splitter (no real SQL parser): finds the semicolon-delimited
 * statement containing the cursor, ignoring semicolons inside quoted strings.
 */
export function statementAtCursor(sql: string, cursorPos: number): string {
  const bounds = splitStatementBounds(sql);
  for (const [start, end] of bounds) {
    if (cursorPos >= start && cursorPos <= end) {
      const text = sql.slice(start, end).trim();
      if (text) return text;
    }
  }
  return sql.trim();
}
