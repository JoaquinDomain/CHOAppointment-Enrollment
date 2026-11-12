export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly expose: boolean
  readonly retryAfterSeconds?: number

  constructor(
    status: number,
    code: string,
    message: string,
    options: { expose?: boolean; retryAfterSeconds?: number } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.expose = options.expose ?? status < 500
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(400, code, message)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'FORBIDDEN', message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Record not found') {
    super(404, 'NOT_FOUND', message)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message)
    this.name = 'ConflictError'
  }
}

export class CapacityExceededError extends ConflictError {
  constructor() {
    super('The selected service is fully booked for this date.', 'CAPACITY_EXCEEDED')
    this.name = 'CapacityExceededError'
  }
}

export class DuplicateBookingError extends ConflictError {
  constructor() {
    super('An active appointment already exists for this patient, service, and date.', 'DUPLICATE_BOOKING')
    this.name = 'DuplicateBookingError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(429, 'RATE_LIMITED', 'Too many requests. Please try again later.', {
      retryAfterSeconds,
    })
    this.name = 'RateLimitError'
  }
}

export class AccountLockedError extends AppError {
  constructor(retryAfterSeconds: number) {
    super(
      429,
      'ACCOUNT_LOCKED',
      'Too many failed sign-in attempts. Please try again later.',
      { retryAfterSeconds }
    )
    this.name = 'AccountLockedError'
  }
}

export class DatabaseUnavailableError extends AppError {
  constructor() {
    super(503, 'DATABASE_UNAVAILABLE', 'The service is temporarily unavailable. Please try again later.', {
      expose: true,
    })
    this.name = 'DatabaseUnavailableError'
  }
}
