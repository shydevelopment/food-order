import 'server-only'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN_LENGTH = 2048

type SiteverifyResponse = {
  success: boolean
  challenge_ts?: string
  hostname?: string
  action?: string
  cdata?: string
  'error-codes'?: string[]
}

type VerificationOptions = {
  action?: string
  remoteIp?: string
}

type VerificationResult = {
  success: boolean
  skipped?: boolean
  errorCodes?: string[]
}

function getAllowedHostnames() {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
    .split(',')
    .map((hostname) => hostname.trim())
    .filter(Boolean)
}

export function getTurnstileSiteKey() {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || undefined
}

export function shouldEnforceTurnstile() {
  return Boolean(getTurnstileSiteKey() || process.env.TURNSTILE_SECRET_KEY)
}

export async function verifyTurnstileToken(
  token: FormDataEntryValue | null,
  options: VerificationOptions = {},
): Promise<VerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()

  if (!secret) {
    return process.env.NODE_ENV === 'production'
      ? { success: false, errorCodes: ['missing-input-secret'] }
      : { success: true, skipped: true }
  }

  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: options.remoteIp,
        idempotency_key: crypto.randomUUID(),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return { success: false, errorCodes: ['siteverify-request-failed'] }
    }

    const outcome = (await response.json()) as SiteverifyResponse

    if (!outcome.success) {
      return { success: false, errorCodes: outcome['error-codes'] }
    }

    if (options.action && outcome.action && outcome.action !== options.action) {
      return { success: false, errorCodes: ['invalid-action'] }
    }

    const allowedHostnames = getAllowedHostnames()
    if (
      allowedHostnames.length > 0 &&
      (!outcome.hostname || !allowedHostnames.includes(outcome.hostname))
    ) {
      return { success: false, errorCodes: ['invalid-hostname'] }
    }

    return { success: true }
  } catch {
    return { success: false, errorCodes: ['siteverify-unavailable'] }
  }
}
