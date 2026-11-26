#!/usr/bin/env node

import process from 'node:process'
import mysql from 'mysql2/promise'
import {
  databaseOptions,
  describeDatabaseTarget,
  loadEnvFiles,
} from './lib/env.mjs'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,100}$/

function parseArgs(argv) {
  const args = { username: '', confirm: '', help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--username') {
      args.username = argv[index + 1]?.trim() || ''
      index += 1
    } else if (arg === '--confirm') {
      args.confirm = argv[index + 1]?.trim() || ''
      index += 1
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
  node scripts/promote-superadmin.mjs --username <name> --confirm <name>

Promotes an existing, active administrator to SUPER_ADMIN.

Safety rules:
  - The account must already exist and must be active.
  - --confirm must repeat the exact username. There is no default account.
  - The promotion is recorded in audit_logs.
  - Only one account is changed per run. No accounts are created.

Environment:
  DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, DB_SSL_REJECT_UNAUTHORIZED, DB_SSL_CA
  .env.local and .env are loaded automatically when present.`)
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  if (!USERNAME_PATTERN.test(args.username)) {
    throw new Error(
      'Provide --username with an existing administrator name (3-100 letters, numbers, dot, dash, or underscore)'
    )
  }
  if (args.confirm !== args.username) {
    throw new Error(
      `Confirmation failed. Re-run with --confirm ${args.username} to promote this account.`
    )
  }

  const options = databaseOptions()
  console.log(`Target: ${describeDatabaseTarget(options)}`)

  const connection = await mysql.createConnection(options)
  try {
    await connection.beginTransaction()

    const [rows] = await connection.execute(
      `SELECT id, username, role, is_active
         FROM administrators
        WHERE username = ?
        LIMIT 1
        FOR UPDATE`,
      [args.username]
    )
    const admin = rows[0]

    if (!admin) {
      throw new Error(`Administrator "${args.username}" does not exist`)
    }
    if (!admin.is_active) {
      throw new Error(`Administrator "${args.username}" is inactive; activate it first`)
    }
    if (admin.role === 'superadmin') {
      await connection.rollback()
      console.log(`Administrator "${args.username}" is already a super administrator.`)
      return
    }

    await connection.execute(
      `UPDATE administrators
          SET role = 'superadmin'
        WHERE id = ?`,
      [admin.id]
    )

    await connection.execute(
      `INSERT INTO audit_logs
         (actor_type, actor_id, action, entity_type, entity_id, metadata)
       VALUES ('system', NULL, 'admin.user.bootstrap_promoted', 'administrator', ?, ?)`,
      [
        admin.username,
        JSON.stringify({
          previous_role: admin.role,
          new_role: 'superadmin',
          source: 'cli',
        }),
      ]
    )

    await connection.commit()
    console.log(`Administrator "${admin.username}" is now a SUPER_ADMIN.`)
    console.log('The change is effective immediately because sessions read the current role from MySQL.')
    console.log('Review the administrative audit log after signing in.')
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      // The original failure is more useful than a rollback failure.
    }
    throw error
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(
    `promote-superadmin failed: ${error instanceof Error ? error.message : 'unknown error'}`
  )
  process.exitCode = 1
})
