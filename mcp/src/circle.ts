/**
 * Circle developer platform integration (read-only).
 *
 * Circle provides the money layer around Arc: Web3 Services (developer-controlled
 * wallets), Gateway (the unified balance behind App Kit), and USDC itself.
 * This module talks to the Circle API when a key is configured and reports an
 * honest "not configured" state when it is not. No keys are stored here, no
 * funds move, and nothing is signed.
 *
 * Env vars:
 *   CIRCLE_API_KEY      Bearer key from https://console.circle.com
 *                       (TEST_API_KEY:<id>:<secret> in sandbox)
 *   CIRCLE_API_BASE     Override the API base URL (default https://api.circle.com)
 *
 * Grounded in developers.circle.com: the W3S ping endpoint returns
 * { "message": "pong" } and auth is a Bearer API key.
 */

export const CIRCLE = {
  apiBase: 'https://api.circle.com',
  console: 'https://console.circle.com',
  docs: 'https://developers.circle.com',
  sdk: '@circle-fin/developer-controlled-wallets',
  products: {
    wallets: 'Developer-controlled wallets (W3S): programmable agent wallets, policy engine.',
    gateway: 'Circle Gateway: the chain-abstracted USDC balance behind App Kit unified balance.',
    usdc: 'USDC: the settlement dollar, native gas token on Arc.',
  },
} as const

export type CircleStatus = {
  provider: 'circle'
  configured: boolean
  reachable: boolean | null
  apiBase: string
  environment: 'sandbox' | 'production' | 'unknown' | null
  products: typeof CIRCLE.products
  checkedAt: string
  note: string
}

/**
 * Report the Circle platform link state. With CIRCLE_API_KEY set this performs a
 * real authenticated ping against the Circle API; without it, it explains
 * exactly what to configure. Read-only either way.
 */
export async function getCircleStatus(env: NodeJS.ProcessEnv = process.env): Promise<CircleStatus> {
  const apiBase = (env.CIRCLE_API_BASE ?? CIRCLE.apiBase).replace(/\/$/, '')
  const key = env.CIRCLE_API_KEY

  const base: CircleStatus = {
    provider: 'circle',
    configured: Boolean(key),
    reachable: null,
    apiBase,
    environment: key ? (key.startsWith('TEST_API_KEY') ? 'sandbox' : key.startsWith('LIVE_API_KEY') ? 'production' : 'unknown') : null,
    products: CIRCLE.products,
    checkedAt: new Date().toISOString(),
    note: '',
  }

  if (!key) {
    return {
      ...base,
      note:
        'No CIRCLE_API_KEY set. Create one at console.circle.com, export CIRCLE_API_KEY, and this ' +
        'endpoint will ping the Circle API for real. Wallet operations stay human-on-the-loop either way.',
    }
  }

  try {
    const res = await fetch(`${apiBase}/ping`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(6000),
    })
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    const pong = res.ok && body?.message === 'pong'
    return {
      ...base,
      reachable: pong,
      note: pong
        ? 'Circle API reachable and authenticated.'
        : `Circle API responded ${res.status}. Check the key and environment.`,
    }
  } catch (err) {
    return {
      ...base,
      reachable: false,
      note: 'Circle API not reachable: ' + (err instanceof Error ? err.message : String(err)),
    }
  }
}
