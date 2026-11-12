#!/usr/bin/env node

import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import process from 'node:process'
import mysql from 'mysql2/promise'
import { databaseOptions, loadEnvFiles } from './lib/env.mjs'

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

function parseArgs(argv) {
  const args = { username: process.env.ADMIN_USERNAME?.trim() || '', role: 'admin', passwordStdin: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--username') {
      args.username = argv[index + 1]?.trim() || ''
      index += 1
    } else if (arg === '--role') {
      args.role = argv[index + 1]?.trim() || ''
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
  node scripts/create-admin.mjs --username <name> [--role admin|superadmin] [--password-stdin]

Password resolution order:
  1. --password-stdin (recommended when piping a secret)
  2. ADMIN_PASSWORD environment variable
  3. Cryptographically random password, printed once

Environment:
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, DB_SSL_REJECT_UNAUTHORIZED, DB_SSL_CA
  .env.local and .env are loaded automatically when present.`)
}

async function readStdin() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
}

function generatePassword() {
  return randomBytes(24).toString('base64url')
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
  if (!['admin', 'superadmin'].includes(args.role)) {
    throw new Error('Role must be admin or superadmin')
  }

  let password = process.env.ADMIN_PASSWORD || ''
  let generated = false
  if (args.passwordStdin) {
    password = await readStdin()
  } else if (!password) {
    password = generatePassword()
    generated = true
  }
  password = password.replace(/\r?\n$/, '')

  const passwordHash = await hashPassword(password)
  const connection = await mysql.createConnection(databaseOptions())

  try {
    await connection.beginTransaction()
    await connection.execute(
      `INSERT INTO administrators (username, password_hash, role, is_active)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         role = VALUES(role),
         is_active = 1,
         failed_login_count = 0,
         locked_until = NULL`,
      [args.username, passwordHash, args.role]
    )

    await connection.execute(
      `INSERT INTO audit_logs (actor_type, action, entity_type, entity_id, metadata)
       VALUES ('system', 'administrator.provisioned', 'administrator', ?, ?)`,
      [args.username, JSON.stringify({ role: args.role, generatedPassword: generated })]
    )
    await connection.commit()

    console.log(`Administrator "${args.username}" (${args.role}) is ready.`)
    if (generated) {
      console.log('Generated password (shown once, store it in a password manager):')
      console.log(password)
    }
    console.log('Sign in at /admin/login and rotate this password through your normal process.')
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(`create-admin failed: ${error instanceof Error ? error.message : 'unknown error'}`)
  process.exitCode = 1
})
