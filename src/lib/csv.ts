/**
 * CSV export helpers shared by the administrator dashboard.
 *
 * Downloaded spreadsheets are opened by Excel, LibreOffice, and Google
 * Sheets, all of which evaluate a cell as a formula when it begins with
 * `=`, `+`, `-`, or `@`. Because the exported rows contain patient-supplied
 * values (for example the patient's name), every cell is neutralised before
 * it is written so that a crafted value can never execute as a formula.
 *
 * Leading tab, carriage return, and line feed characters are also escaped:
 * spreadsheet applications trim those characters while parsing CSV, so a
 * cell beginning with a tab followed by `=` would otherwise be evaluated.
 */

const FORMULA_TRIGGER_CHARACTERS = ['=', '+', '-', '@']
const WHITESPACE_TRIGGER_CHARACTERS = ['\t', '\r', '\n']

export function needsCsvEscaping(text: string): boolean {
  if (!text) return false
  const first = text[0]
  return (
    FORMULA_TRIGGER_CHARACTERS.includes(first) ||
    WHITESPACE_TRIGGER_CHARACTERS.includes(first)
  )
}

export function escapeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (needsCsvEscaping(text)) {
    text = `'${text}`
  }
  return `"${text.replace(/"/g, '""')}"`
}

export function buildCsvDocument(
  headers: readonly unknown[],
  rows: readonly (readonly unknown[])[]
): string {
  return [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(',')),
  ].join('\r\n')
}
