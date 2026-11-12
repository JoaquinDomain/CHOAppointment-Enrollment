#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import mysql from 'mysql2/promise'
import {
  databaseOptions,
  describeDatabaseTarget,
  loadEnvFiles,
} from './lib/env.mjs'

const MIGRATIONS_DIR = path.resolve('mysql', 'migrations')
const MIGRATION_PATTERN = /^(\d{4})_([a-z0-9_]+)\.sql$/

const REQUIRED_TABLES = [
  'administrators',
  'admin_sessions',
  'patients',
  'appointments',
  'laboratory_services',
  'service_daily_capacity',
  'consent_records',
  'audit_logs',
  'appointment_status_history',
  'rate_limit_buckets',
  'schema_migrations',
]

const MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    execution_ms INT UNSIGNED NULL,
    PRIMARY KEY (version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`

function usage() {
  console.log(`Usage:
  node scripts/db-migrate.mjs <command> [options]

Commands:
  up       Apply every pending migration in version order (default)
  status   Show applied and pending migrations
  verify   Check connection, MySQL version, tracking table, required tables,
           utf8mb4 collation, and pending migrations

Options:
  --dry-run   Show what would be applied without executing it (up only)
  --yes       Required to run "up" when NODE_ENV=production
  --help      Show this message

Environment:
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
  DB_SSL, DB_SSL_REJECT_UNAUTHORIZED, DB_SSL_CA
  .env.local and .env are loaded automatically when present.

The runner never creates or drops a database and never deletes records.
It refuses to continue when an applied migration's checksum no longer matches
the file, because that means the database history and the repository disagree.`)
}

function parseArgs(argv) {
  const args = { command: 'up', dryRun: false, yes: false, help: false }
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg === '--yes') args.yes = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (['up', 'status', 'verify'].includes(arg)) args.command = arg
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return args
}

async function loadMigrations() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true })
  const migrations = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const match = MIGRATION_PATTERN.exec(entry.name)
    if (!match) {
      throw new Error(
        `Invalid migration filename "${entry.name}". Expected NNNN_snake_case.sql`
      )
    }
    const [, version, name] = match
    const file = path.join(MIGRATIONS_DIR, entry.name)
    const sql = await readFile(file, 'utf8')
    migrations.push({
      version,
      name,
      file,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    })
  }

  migrations.sort((left, right) => left.version.localeCompare(right.version))

  const seen = new Set()
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`)
    }
    seen.add(migration.version)
  }

  return migrations
}

async function ensureMigrationsTable(connection) {
  await connection.query(MIGRATIONS_TABLE_SQL)
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query(
    `SELECT version, name, checksum, applied_at, execution_ms
       FROM schema_migrations
      ORDER BY version ASC`
  )
  return rows
}

function validateHistory(migrations, applied) {
  const byVersion = new Map(migrations.map(migration => [migration.version, migration]))

  for (const row of applied) {
    const migration = byVersion.get(row.version)
    if (!migration) {
      throw new Error(
        `Migration ${row.version} is recorded in the database but the file is missing. ` +
          'Restore the migration file before continuing.'
      )
    }
    if (row.name !== migration.name) {
      throw new Error(
        `Migration ${row.version} name mismatch: database has "${row.name}", file has "${migration.name}".`
      )
    }
    if (row.checksum !== migration.checksum) {
      throw new Error(
        `Migration ${row.version}_${migration.name} has changed after it was applied. ` +
          'Never edit an applied migration; add a new migration instead.'
      )
    }
  }
}

async function applyMigration(connection, migration) {
  console.log(`Applying ${migration.version}_${migration.name} ...`)
  const startedAt = Date.now()

  try {
    await connection.query(migration.sql)
    const executionMs = Date.now() - startedAt
    await connection.execute(
      `INSERT INTO schema_migrations (version, name, checksum, execution_ms)
       VALUES (?, ?, ?, ?)`,
      [migration.version, migration.name, migration.checksum, executionMs]
    )
    console.log(`  applied in ${executionMs} ms`)
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Migration ${migration.version}_${migration.name} failed` +
        (code ? ` [${code}]` : '') +
        `: ${message}\n` +
        'The migration was not recorded. Fix the cause and run the command again; ' +
        'applied migrations are skipped automatically.'
    )
  }
}

async function commandUp(connection, migrations, args) {
  if (process.env.NODE_ENV === 'production' && !args.yes && !args.dryRun) {
    throw new Error(
      'Refusing to apply migrations with NODE_ENV=production without --yes. ' +
        'Confirm MICT authorization and re-run with --yes.'
    )
  }

  await ensureMigrationsTable(connection)
  const applied = await getAppliedMigrations(connection)
  validateHistory(migrations, applied)

  const appliedVersions = new Set(applied.map(row => row.version))
  const pending = migrations.filter(migration => !appliedVersions.has(migration.version))

  if (pending.length === 0) {
    console.log('Database is up to date. No pending migrations.')
    return
  }

  console.log(`Pending migrations: ${pending.map(m => m.version).join(', ')}`)
  for (const migration of pending) {
    if (args.dryRun) {
      console.log(`[dry-run] would apply ${migration.version}_${migration.name}`)
      continue
    }
    await applyMigration(connection, migration)
  }

  if (!args.dryRun) {
    console.log('All pending migrations applied successfully.')
  }
}

async function commandStatus(connection, migrations) {
  await ensureMigrationsTable(connection)
  const applied = await getAppliedMigrations(connection)
  validateHistory(migrations, applied)

  const appliedVersions = new Set(applied.map(row => row.version))
  const pending = migrations.filter(migration => !appliedVersions.has(migration.version))

  console.log('')
  console.log('Applied migrations:')
  if (applied.length === 0) {
    console.log('  (none)')
  } else {
    for (const row of applied) {
      console.log(`  ${row.version} ${row.name}  applied ${row.applied_at}`)
    }
  }

  console.log('')
  console.log('Pending migrations:')
  if (pending.length === 0) {
    console.log('  (none)')
  } else {
    for (const migration of pending) {
      console.log(`  ${migration.version} ${migration.name}`)
    }
  }
}

async function commandVerify(connection, migrations) {
  const problems = []
  const warnings = []

  const [[versionRow]] = await connection.query('SELECT VERSION() AS version')
  const version = String(versionRow.version)
  console.log(`MySQL version: ${version}`)
  if (!/^8\.0\./.test(version)) {
    problems.push(
      `MySQL 8.0 is required; this server reports ${version}. The schema uses generated columns, CHECK constraints, and utf8mb4_0900_ai_ci.`
    )
  } else {
    const patch = Number.parseInt(version.split('.')[2] ?? '0', 10)
    if (patch < 16) {
      warnings.push(
        'MySQL 8.0.16 or newer is required for enforced CHECK constraints; the target MICT server is 8.0.43.'
      )
    }
  }

  const [trackingRows] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'schema_migrations'`
  )
  if (Number(trackingRows[0]?.count ?? 0) === 0) {
    problems.push(
      'The schema_migrations tracking table is missing. Run "npm run db:migrate" before starting the application.'
    )
  } else {
    const applied = await getAppliedMigrations(connection)
    try {
      validateHistory(migrations, applied)
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error))
    }
    const appliedVersions = new Set(applied.map(row => row.version))
    const pending = migrations.filter(migration => !appliedVersions.has(migration.version))
    if (pending.length > 0) {
      problems.push(
        `Pending migrations: ${pending.map(migration => migration.version).join(', ')}. Run "npm run db:migrate".`
      )
    }
  }

  const [tableRows] = await connection.query(
    `SELECT TABLE_NAME AS table_name, TABLE_COLLATION AS table_collation
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name IN (?)`,
    [REQUIRED_TABLES]
  )
  const present = new Map(tableRows.map(row => [row.table_name, row.table_collation]))

  for (const table of REQUIRED_TABLES) {
    if (!present.has(table)) {
      problems.push(`Missing required table: ${table}`)
      continue
    }
    const collation = String(present.get(table) ?? '')
    if (!collation.startsWith('utf8mb4')) {
      problems.push(`Table ${table} uses ${collation || 'an unknown collation'}, expected utf8mb4`)
    }
  }

  console.log(`Required tables: ${REQUIRED_TABLES.length}`)
  console.log(`Present tables: ${tableRows.length}`)
  for (const warning of warnings) console.warn(`WARNING: ${warning}`)

  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL: ${problem}`)
    throw new Error(`Database readiness check failed with ${problems.length} problem(s).`)
  }

  console.log('Database readiness check passed.')
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    usage()
    return
  }

  const migrations = await loadMigrations()
  const options = databaseOptions({ multipleStatements: true })
  console.log(`Target: ${describeDatabaseTarget(options)}`)

  const connection = await mysql.createConnection(options)
  try {
    if (args.command === 'up') await commandUp(connection, migrations, args)
    else if (args.command === 'status') await commandStatus(connection, migrations)
    else if (args.command === 'verify') await commandVerify(connection, migrations)
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(
    `db-migrate failed: ${error instanceof Error ? error.message : 'unknown error'}`
  )
  process.exitCode = 1
})
