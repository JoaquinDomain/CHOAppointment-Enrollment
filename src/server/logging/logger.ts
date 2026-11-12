type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  event: string
  requestId?: string
  route?: string
  errorCode?: string
  errorNumber?: number
  sqlState?: string
  message?: string
  [key: string]: unknown
}

const SENSITIVE_KEY_PATTERN = /name|phone|email|address|birth|philhealth|contact|password|token|secret|cookie/i

/**
 * Database drivers embed the offending value in the error message. For this
 * application that value is frequently patient identity data (for example
 * MySQL reports `Duplicate entry 'Juan Dela Cruz-1990-01-15-09171234567'`),
 * so raw messages must never reach the log stream.
 */
const SENSITIVE_MESSAGE_RULES: Array<[RegExp, string]> = [
  [/(Duplicate entry\s+)'[^']*'/gi, "$1'[redacted]'"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]'],
  [/(?:\+?63|0)9\d{9}/g, '[redacted-phone]'],
  [/(\b\d{3}-\d{2}-\d{4}\b)/g, '[redacted-id]'],
]

export function sanitizeLogMessage(message: string): string {
  let sanitized = message
  for (const [pattern, replacement] of SENSITIVE_MESSAGE_RULES) {
    sanitized = sanitized.replace(pattern, replacement)
  }
  return sanitized
}

function redact(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = '[redacted]'
    } else if (typeof value === 'string') {
      const sanitized = sanitizeLogMessage(value)
      safe[key] = sanitized.length > 300 ? `${sanitized.slice(0, 300)}...` : sanitized
    } else {
      safe[key] = value
    }
  }
  return safe
}

function write(entry: LogEntry): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...redact(entry),
  })
  if (entry.level === 'error') {
    console.error(line)
  } else if (entry.level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export function logInfo(event: string, meta: Record<string, unknown> = {}): void {
  write({ level: 'info', event, ...meta })
}

export function logWarn(event: string, meta: Record<string, unknown> = {}): void {
  write({ level: 'warn', event, ...meta })
}

export function describeError(error: unknown): Record<string, unknown> {
  if (error && typeof error === 'object') {
    const candidate = error as {
      name?: string
      code?: string
      errno?: number
      sqlState?: string
      message?: string
    }
    return {
      errorType: candidate.name,
      errorCode: candidate.code,
      errorNumber: candidate.errno,
      sqlState: candidate.sqlState,
      message: candidate.message
        ? sanitizeLogMessage(candidate.message).slice(0, 300)
        : undefined,
    }
  }
  return { message: sanitizeLogMessage(String(error)).slice(0, 300) }
}

export function logError(
  event: string,
  error: unknown,
  meta: Record<string, unknown> = {}
): void {
  write({ level: 'error', event, ...describeError(error), ...meta })
}
