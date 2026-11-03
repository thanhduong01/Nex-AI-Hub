export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function csv(rows: unknown[][]) {
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
