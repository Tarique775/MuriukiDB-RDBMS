/**
 * Splits SQL input into individual statements while respecting quoted strings.
 * Handles single quotes, double quotes, and backticks properly.
 * 
 * @example
 * splitSqlStatements("INSERT INTO t (x) VALUES ('a;b'); SELECT * FROM t;")
 * // => ["INSERT INTO t (x) VALUES ('a;b')", "SELECT * FROM t"]
 */
export function splitSqlStatements(input: string): string[] {
  const statements: string[] = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let prev = '';
  
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'" && !inDouble && !inBacktick && prev !== "\\") inSingle = !inSingle;
    if (ch === '"' && !inSingle && !inBacktick && prev !== "\\") inDouble = !inDouble;
    if (ch === "`" && !inSingle && !inDouble && prev !== "\\") inBacktick = !inBacktick;
    
    if (ch === ";" && !inSingle && !inDouble && !inBacktick) {
      if (cur.trim()) statements.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
    prev = ch;
  }
  if (cur.trim()) statements.push(cur.trim());
  return statements;
}
