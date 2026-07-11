/**
 * Shared data layer for GET /api/platform-agents.
 *
 * Every app screen (Dashboard, AgentId, Wallet, Settlements, Permissions, Marketplace)
 * needs the agent list. Without a cache each navigation refires the request — a
 * "fetch storm". This is a tiny, dependency-free cache with:
 *   - in-flight dedup: concurrent callers share ONE request, and
 *   - a short TTL: a navigation within the window reuses the last result.
 * After a mutation that changes the list (create agent, anchor, permissions), call
 * `invalidatePlatformAgents()` so the next read is fresh.
 *
 * Errors are NOT cached — they propagate so each screen's own try/catch still shows
 * its "backend offline" message.
 */
import { MCP_BASE } from './mcpBase'

const TTL_MS = 6000

let cache: { at: number; data: { agents: unknown[] } } | null = null
let inflight: Promise<{ agents: unknown[] }> | null = null

/**
 * Fetch the platform agents, served from cache when fresh and deduped while in flight.
 * Generic over the caller's agent shape (the API objects carry every ranking field).
 */
export async function fetchPlatformAgents<T = unknown>(opts: { force?: boolean } = {}): Promise<{ agents: T[] }> {
  if (!opts.force && cache && Date.now() - cache.at < TTL_MS) return cache.data as { agents: T[] }
  if (inflight) return inflight as Promise<{ agents: T[] }>
  inflight = (async () => {
    try {
      const res = await fetch(`${MCP_BASE}/api/platform-agents`, { signal: AbortSignal.timeout(6000) })
      const data = (await res.json()) as { agents: unknown[] }
      cache = { at: Date.now(), data }
      return data
    } finally {
      inflight = null
    }
  })()
  return inflight as Promise<{ agents: T[] }>
}

/** Drop the cache so the next fetch hits the backend (call after list-changing mutations). */
export function invalidatePlatformAgents(): void {
  cache = null
}
