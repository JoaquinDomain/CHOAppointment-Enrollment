import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const script = path.resolve('scripts/promote-superadmin.mjs')
const source = readFileSync(script, 'utf8')

function run(args: string[]) {
  return execFileAsync(process.execPath, [script, ...args], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      DB_HOST: '',
      DB_PORT: '',
      DB_USER: '',
      DB_PASSWORD: '',
      DB_NAME: '',
    },
    timeout: 15_000,
  })
}

describe('promote-superadmin command safety', () => {
  it('documents promotion of an existing active account with exact confirmation', async () => {
    const { stdout } = await run(['--help'])

    expect(stdout).toContain('--username')
    expect(stdout).toContain('--confirm')
    expect(stdout).toMatch(/existing.*active/i)
    expect(stdout).toMatch(/audit_logs/i)
    expect(stdout).toMatch(/No accounts are created/i)
  })

  it('requires --confirm to match the username exactly', async () => {
    await expect(
      run(['--username', 'cho.admin', '--confirm', 'cho.other'])
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/Confirmation failed/i),
    })
  })

  it('requires a username', async () => {
    await expect(run(['--confirm', 'cho.admin'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/--username/i),
    })
  })

  it('rejects unknown arguments', async () => {
    await expect(
      run(['--username', 'cho.admin', '--confirm', 'cho.admin', '--role', 'superadmin'])
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/Unknown argument: --role/i),
    })
  })

  it('promotes atomically under a row lock and writes an audit record', () => {
    expect(source).toMatch(/beginTransaction/)
    expect(source).toMatch(/FOR UPDATE/)
    expect(source).toMatch(/INSERT INTO audit_logs/)
    expect(source).toMatch(/admin\.user\.bootstrap_promoted/)
    expect(source).toMatch(/is_active/)
    expect(source).toMatch(/commit\(\)/)
    expect(source).not.toMatch(/SET\s+password_hash/i)
    expect(source).not.toMatch(/INSERT INTO administrators/i)
  })
})
