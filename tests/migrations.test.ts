import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = path.resolve('mysql', 'migrations')
const files = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort()

function read(file: string): string {
  return readFileSync(path.join(migrationsDir, file), 'utf8')
}

const requiredTables = [
  'administrators',
  'admin_sessions',
  'laboratory_services',
  'patients',
  'appointments',
  'service_daily_capacity',
  'consent_records',
  'appointment_status_history',
  'audit_logs',
  'rate_limit_buckets',
]

describe('migration files', () => {
  it('uses a strictly ordered NNNN_snake_case naming convention', () => {
    expect(files.length).toBeGreaterThan(0)
    const versions = files.map(file => {
      const match = /^(\d{4})_([a-z0-9_]+)\.sql$/.exec(file)
      expect(match, `${file} must match NNNN_snake_case.sql`).not.toBeNull()
      return match?.[1]
    })
    expect(new Set(versions).size).toBe(versions.length)
    expect(versions).toEqual([...versions].sort())
  })

  it('never drops tables, databases, or truncates data', () => {
    for (const file of files) {
      const sql = read(file).replace(/--.*$/gm, '')
      expect(sql, `${file} must not DROP TABLE`).not.toMatch(/\bDROP\s+TABLE\b/i)
      expect(sql, `${file} must not DROP DATABASE`).not.toMatch(/\bDROP\s+DATABASE\b/i)
      expect(sql, `${file} must not TRUNCATE`).not.toMatch(/\bTRUNCATE\b/i)
    }
  })

  it('creates every table the application requires', () => {
    const baseline = read('0001_initial_schema.sql')
    for (const table of requiredTables) {
      expect(baseline).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i')
      )
    }
  })

  it('uses utf8mb4 for every table', () => {
    const baseline = read('0001_initial_schema.sql')
    const tableDefinitions = baseline.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB[^;]*;/gi) ?? []
    expect(tableDefinitions.length).toBeGreaterThanOrEqual(requiredTables.length)
    for (const definition of tableDefinitions) {
      expect(definition).toMatch(/DEFAULT CHARSET=utf8mb4/i)
      expect(definition).toMatch(/COLLATE=utf8mb4_0900_ai_ci/i)
    }
  })

  it('does not create or select a database', () => {
    for (const file of files) {
      const sql = read(file).replace(/--.*$/gm, '')
      expect(sql, `${file} must not CREATE DATABASE`).not.toMatch(/\bCREATE\s+DATABASE\b/i)
      expect(sql, `${file} must not USE a database`).not.toMatch(/^\s*USE\s+/im)
    }
  })

  it('keeps mysql/schema.sql as a pointer to the migration runner', () => {
    const schema = readFileSync(path.resolve('mysql', 'schema.sql'), 'utf8')
    expect(schema).toContain('npm run db:migrate')
    expect(schema).toContain('mysql/migrations/')
  })
})
