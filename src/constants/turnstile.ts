/**
 * Shared, client-safe configuration for the Cloudflare Turnstile human
 * verification used on the public booking form.
 *
 * The action binds a verification token to the booking flow. Cloudflare echoes
 * it back in the verification response, so the server can refuse a token that
 * was issued for a different purpose.
 */
export const TURNSTILE_ACTION = 'appointment'
