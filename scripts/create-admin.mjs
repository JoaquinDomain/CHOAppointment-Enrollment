#!/usr/bin/env node

import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import process from 'node:process'
import mysql from 'mysql2/promise'
import { databaseOptions, describeDatabaseTarget, loadEnvFiles } from './lib/env.mjs'

const scrypt = promisify(scryptCallback)

// Keep these parameters in sync with src/server/auth/password.ts.
// N = 2^16, r = 8, p = 2 (about 64 MiB of memory per hash).
const SCRYPT_N = 65536
const SCRYPT_R = 8
const SCRYPT_P = 2
const KEY_LENGTH = 64
const SALT_LENGTH = 16
const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 200
const MAX_MEMORY_BYTES = 256 * 1024 * 1024

const PROMOTE_HINT =
  'Super Admin accounts are never created here. Create an ADMIN, then use ' +
  '"npm run admin:promote -- --username <name> --confirm <name>" (scripts/promote-superadmin.mjs).'

function parseArgs(argv) {
  const args = { username: process.env.ADMIN_USERNAME?.trim() || '', role: 'admin', passwordStdin: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--username') {
      args.username = argv[index + 1]?.trim() || ''
      index += 1
    } else if (arg === '--role') {
      args.role = (argv[index + 1]?.trim() || '').toLowerCase()
      index += 1
    } else if (arg === '--password-stdin') {
      args.passwordStdin = true
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return args
}

function printUsage() {
  console.log(`Usage:
  node scripts/create-admin.mjs --username <name> [--role admin] --password-stdin

Create-only: this command always creates a new ADMIN account. It never changes
an existing account, never resets a password, never reactivates a disabled
account, and never creates or promotes a SUPER_ADMIN. Super Admin promotion uses
scripts/promote-superadmin.mjs.

Password resolution (required):
  1. --password-stdin (recommended when piping a secret)
  2. ADMIN_PASSWORD environment variable

An existing username is rejected. The existing account is left completely
unchanged, including its password, role, and activation state. A new password is
never printed to stdout.

Environment:
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, DB_SSL_REJECT_UNAUTHORIZED, DB_SSL_CA
  .env.local and .env are loaded automatically when present.`)
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
}

async function hashPassword(password) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`)
  }
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEMORY_BYTES,
  })
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$')
}

function isUniqueConstraintError(error) {
  if (!error || typeof error !== 'object') return false
  return error.code === 'ER_DUP_ENTRY' || error.errno === 1062
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  if (!/^[A-Za-z0-9._-]{3,100}$/.test(args.username)) {
    throw new Error('Username must be 3-100 characters and use only letters, numbers, dot, dash, or underscore')
  }
  if (args.role === 'superadmin') {
    throw new Error(PROMOTE_HINT)
  }
  if (args.role !== 'admin') {
    throw new Error('Role must be admin. ' + PROMOTE_HINT)
  }

  let password = process.env.ADMIN_PASSWORD || ''
  if (args.passwordStdin) {
    password = await readStdin()
  } else if (!password) {
    throw new Error(
      'A password is required. Provide it with --password-stdin or the ADMIN_PASSWORD environment variable.'
    )
  }
  password = password.replace(/\r?\n$/, '')

  const passwordHash = await hashPassword(password)
  const options = databaseOptions()
  console.log(`Target: ${describeDatabaseTarget(options)}`)

  const connection = await mysql.createConnection(options)

  try {
    await connection.beginTransaction()

    // Create-only: a plain INSERT means an existing username raises a duplicate
    // key error instead of silently overwriting the stored password, role, or
    // activation state. The transaction is rolled back below, so the existing
    // account is never touched.
    const [result] = await connection.execute(
      `INSERT INTO administrators (username, password_hash, role, is_active)
       VALUES (?, ?, 'admin', 1)`,
      [args.username, passwordHash]
    )

    await connection.execute(
      `INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, metadata)
       VALUES ('system', 'admin.user.created', 'administrator', ?, ?)`,
      [
        String(result.insertId),
        JSON.stringify({ target_username: args.username, role: 'admin', source: 'cli' }),
      ]
    )

    await connection.commit()

    console.log(`Administrator "${args.username}" (ADMIN) was created.`)
    console.log(`Record id: ${result.insertId}`)
    console.log('Sign in at /admin/login and rotate this password through your normal process.')
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      // The original failure is more useful than a rollback failure.
    }
    if (isUniqueConstraintError(error)) {
      throw new Error(
        `Administrator "${args.username}" already exists. The existing account was left unchanged. ` +
          'This command never resets passwords or changes roles.'
      )
    }
    throw error
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(`create-admin failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
