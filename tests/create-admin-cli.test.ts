import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const script = path.resolve('scripts/create-admin.mjs')
const source = readFileSync(script, 'utf8')

function run(args: string[], env: Record<string, string | undefined> = {}) {
  return execFileAsync(process.execPath, [script, ...args], {
    cwd: path.resolve('.'),
    env: {
      ...process.env,
      ADMIN_PASSWORD: '',
      DB_HOST: '',
      DB_PORT: '',
      DB_USER: '',
      DB_PASSWORD: '',
      DB_NAME: '',
      ...env,
    },
    timeout: 15_000,
  })
}

describe('create-admin command safety', () => {
  it('refuses to create a Super Admin', async () => {
    const result = run(
      ['--username', 'cho.cli', '--role', 'superadmin'],
      { ADMIN_PASSWORD: 'correct horse battery' }
    )

    await expect(result).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/promote-superadmin|SUPER_ADMIN/i),
    })
  })

  it('requires a password from stdin or the environment', async () => {
    await expect(run(['--username', 'cho.cli'])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/password-stdin|ADMIN_PASSWORD/i),
    })
  })

  it('does not accept a password as a command-line argument', async () => {
    await expect(
      run(['--username', 'cho.cli', '--password', 'correct horse battery'])
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/Unknown argument: --password/i),
    })
  })

  it('documents create-only administrator provisioning', async () => {
    const { stdout } = await run(['--help'])

    expect(stdout).toContain('--password-stdin')
    expect(stdout).toContain('ADMIN_PASSWORD')
    expect(stdout).not.toContain('--role superadmin')
    expect(stdout).toMatch(/create-only|always creates an ADMIN/i)
  })

  it('never uses an upsert that could overwrite an existing account', () => {
    expect(source).not.toMatch(/ON\s+DUPLICATE\s+KEY\s+UPDATE/i)
    expect(source).not.toMatch(/password_hash\s*=\s*VALUES/i)
    expect(source).toMatch(/INSERT INTO administrators/i)
  })

  it('always creates an ADMIN account and never a Super Admin', () => {
    expect(source).toMatch(/INSERT INTO administrators[\s\S]*?'admin'/i)
    expect(source).not.toMatch(/INSERT INTO administrators[\s\S]*?superadmin/i)
    expect(source).toMatch(/promote-superadmin/i)
  })

  it('writes an account-creation audit record inside the transaction', () => {
    expect(source).toMatch(/beginTransaction/)
    expect(source).toMatch(/INSERT INTO audit_logs/)
    expect(source).toMatch(/admin\.user\.created/)
    expect(source.indexOf('INSERT INTO audit_logs')).toBeLessThan(source.indexOf('commit()'))
    expect(source).not.toMatch(/console\.log\(password\)/)
  })
})
