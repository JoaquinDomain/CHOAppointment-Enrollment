import { describe, expect, it } from 'vitest'
import { buildCsvDocument, escapeCsvCell, needsCsvEscaping } from '@/lib/csv'

describe('CSV export hardening', () => {
  it('neutralises spreadsheet formula triggers', () => {
    expect(escapeCsvCell('=1+1')).toBe('"\'=1+1"')
    expect(escapeCsvCell('+SUM(A1:A2)')).toBe('"\'+SUM(A1:A2)"')
    expect(escapeCsvCell('-2+3')).toBe('"\'-2+3"')
    expect(escapeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"')
  })

  it('neutralises leading whitespace that spreadsheet applications trim', () => {
    expect(escapeCsvCell('\t=1+1')).toBe('"\'\t=1+1"')
    expect(escapeCsvCell('\r=1+1')).toBe('"\'\r=1+1"')
    expect(escapeCsvCell('\n=1+1')).toBe('"\'\n=1+1"')
    expect(needsCsvEscaping('\t=cmd')).toBe(true)
    expect(needsCsvEscaping('Maria Cruz Santos')).toBe(false)
  })

  it('quotes embedded quotes and preserves ordinary values', () => {
    expect(escapeCsvCell('Maria "MJ" Santos')).toBe('"Maria ""MJ"" Santos"')
    expect(escapeCsvCell('Maria Cruz Santos')).toBe('"Maria Cruz Santos"')
    expect(escapeCsvCell('')).toBe('""')
    expect(escapeCsvCell(null)).toBe('""')
    expect(escapeCsvCell(undefined)).toBe('""')
    expect(escapeCsvCell(42)).toBe('"42"')
  })

  it('escapes every cell of the exported document', () => {
    const document = buildCsvDocument(
      ['Public ID', 'Patient Name', 'Note'],
      [
        ['abc', 'Maria Cruz Santos', 'ok'],
        ['def', '=cmd|\' /C calc\'!A0', '=1+1'],
      ]
    )

    expect(document).toBe(
      [
        '"Public ID","Patient Name","Note"',
        '"abc","Maria Cruz Santos","ok"',
        '"def","\'=cmd|\' /C calc\'!A0","\'=1+1"',
      ].join('\r\n')
    )
  })

  it('never emits a cell that a spreadsheet would evaluate', () => {
    const hostile = ['=HYPERLINK("http://evil.test")', '+1+1', '-1+1', '@SUM(1)']
    for (const value of hostile) {
      const cell = escapeCsvCell(value)
      const content = cell.slice(1, -1)
      expect(content.startsWith("'")).toBe(true)
    }
  })
})
