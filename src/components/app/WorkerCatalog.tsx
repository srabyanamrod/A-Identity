import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Star, Store, Loader2, ExternalLink, Plus } from 'lucide-react'
import { authHeaders } from '../../store/auth'
import { apiFetch, readJson, explainError } from '../../lib/api'
import { BACKEND_UNREACHABLE } from '../../lib/mcpBase'

/**
 * The trusted-worker catalog: hire a KYA-verified agent for a service, USDC to an on-chain
 * ERC-8183 escrow, released on delivery. Mirrors the marketplace backend (/api/marketplace/*).
 */

type CatalogService = {
  agentId: string
  agentName: string
  category: string
  service: string
  priceUsd: number
  unit: string
  rating: number
  reviews: number
  completed: number
  kya: string
  onchain: string
  walletAddress: string | null
}

type Task = {
  id: string
  agentId: string
  service: string
  priceUsd: number
  description: string
  status: 'open' | 'assigned' | 'funded' | 'delivered' | 'released' | 'disputed' | 'refunded' | 'cancelled'
  deliverable?: string
  settlement?: 'onchain' | 'simulated'
  jobId?: string
  escrowExplorer?: string
  createdAt: string
  updatedAt: string
}

const STATUS_STYLES: Record<Task['status'], string> = {
  open: 'bg-foreground/8 text-foreground/60',
  assigned: 'bg-foreground/8 text-foreground/60',
  funded: 'bg-[#2775CA]/10 text-[#2775CA]',
  delivered: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  released: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  disputed: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  refunded: 'bg-foreground/8 text-foreground/60',
  cancelled: 'bg-foreground/8 text-foreground/50',
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() })

export default function WorkerCatalog() {
  const [services, setServices] = useState<CatalogService[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Inline hire form: key = `${agentId}::${service}` of the card being hired.
  const [hiringKey, setHiringKey] = useState<string | null>(null)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const [deliverText, setDeliverText] = useState<Record<string, string>>({})

  const loadCatalog = useCallback(async () => {
    try {
      const res = await apiFetch('/api/marketplace/catalog')
      const data = await readJson<{ services: CatalogService[] }>(res)
      setServices(data.services ?? [])
      setError(null)
    } catch {
      setError(BACKEND_UNREACHABLE)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTasks = useCallback(async () => {
    try {
      const res = await apiFetch('/api/marketplace/tasks')
      const data = await readJson<{ tasks?: Task[] }>(res)
      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
    } catch {
      /* tasks are only for signed-in owners; ignore if unavailable */
    }
  }, [])

  useEffect(() => {
    loadCatalog()
    loadTasks()
  }, [loadCatalog, loadTasks])

  const setBusyNote = (key: string, msg: string) => setNote((n) => ({ ...n, [key]: msg }))

  async function hire(svc: CatalogService) {
    const key = `${svc.agentId}::${svc.service}`
    setBusy(key)
    setBusyNote(key, '')
    try {
      const res = await apiFetch('/api/marketplace/hire', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ agentId: svc.agentId, service: svc.service, priceUsd: svc.priceUsd, description: desc.trim() }),
        onWaking: () => setBusyNote(key, 'Waking up the backend (free tier)...'),
      })
      const data = await readJson<Task & { error?: string }>(res)
      if (res.ok && data.id) {
        setHiringKey(null)
        setDesc('')
        setBusyNote(key, '')
        await loadTasks()
      } else {
        setBusyNote(key, explainError(res.status, data.error))
      }
    } catch {
      setBusyNote(key, 'Could not hire. The backend may be waking up; try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  async function taskAction(taskId: string, path: string, body: Record<string, unknown>) {
    setBusy(taskId)
    setBusyNote(taskId, '')
    try {
      const res = await apiFetch(path, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ taskId, ...body }),
        timeoutMs: 90_000, // release/dispute run a real ERC-8183 escrow lifecycle on Arc
        onWaking: () => setBusyNote(taskId, 'Settling on Arc...'),
      })
      const data = await readJson<{ error?: string }>(res)
      if (!res.ok) setBusyNote(taskId, explainError(res.status, data.error))
      else setBusyNote(taskId, '')
      await loadTasks()
    } catch {
      setBusyNote(taskId, 'Timed out. The backend may be waking up; try again.')
    } finally {
      setBusy(null)
    }
  }

  const ratingLabel = (r: number, reviews: number) =>
    reviews > 0 ? `${r.toFixed(1)} (${reviews})` : 'No reviews yet'

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Hire a verified worker</h3>
          <p className="mt-1 max-w-xl text-sm text-foreground/55">
            Every worker here passed ERC-8004 KYA. Hire one for a task: your USDC locks in an
            on-chain escrow on Arc and releases to the worker on delivery.
          </p>
        </div>
        <Link
          to="/app/agent-id"
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          <Plus size={15} /> List your agent
        </Link>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10 p-5 text-sm text-foreground/70">
          {error}
        </div>
      )}

      {loading && !error && (
        <div className="mt-6 rounded-2xl border border-foreground/10 bg-card p-8 text-center text-sm text-foreground/45">
          Loading the catalog...
        </div>
      )}

      {!loading && !error && services.length === 0 && (
        <div className="mt-6 rounded-3xl border border-dashed border-foreground/15 bg-card p-12 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Store size={26} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">No verified workers yet.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground/55">
            Register an agent and pass KYA, and it becomes hireable here with its services and price.
          </p>
        </div>
      )}

      {/* Catalog grid (the card grid) */}
      <div className="mt-6 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => {
          const key = `${svc.agentId}::${svc.service}`
          const open = hiringKey === key
          return (
            <div key={key} className="flex flex-col rounded-2xl border border-foreground/10 bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold text-foreground">{svc.service}</div>
                  <div className="truncate text-xs text-foreground/50">
                    by {svc.agentName} · {svc.category}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold text-accent">{svc.priceUsd.toFixed(2)} USDC</div>
                  <div className="text-[11px] text-foreground/45">{svc.unit}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                  <BadgeCheck size={11} /> KYA verified
                </span>
                <span className="inline-flex items-center gap-1 text-foreground/55">
                  <Star size={11} className="text-amber-500" fill="currentColor" /> {ratingLabel(svc.rating, svc.reviews)}
                </span>
                <span className="text-foreground/40">· {svc.completed} done</span>
              </div>

              {!open ? (
                <button
                  type="button"
                  onClick={() => {
                    setHiringKey(key)
                    setDesc('')
                    setBusyNote(key, '')
                  }}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Hire
                </button>
              ) : (
                <div className="mt-4">
                  <textarea
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={3}
                    placeholder={`What should ${svc.agentName} do? (e.g. "Translate this paragraph to French")`}
                    className="w-full resize-none rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus-visible:outline-2 focus-visible:outline-accent"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => hire(svc)}
                      disabled={busy === key}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === key ? <Loader2 size={14} className="animate-spin" /> : null}
                      Fund escrow &amp; hire
                    </button>
                    <button
                      type="button"
                      onClick={() => setHiringKey(null)}
                      className="rounded-full border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground/60 hover:bg-foreground/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {note[key] && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{note[key]}</p>}
            </div>
          )
        })}
      </div>

      {/* My hires: the caller's tasks with escrow actions */}
      {tasks.length > 0 && (
        <div className="mt-10">
          <h3 className="text-lg font-bold tracking-tight">My hires</h3>
          <div className="mt-4 flex flex-col gap-3">
            {tasks
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((t) => (
                <div key={t.id} className="rounded-2xl border border-foreground/10 bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-foreground">{t.service}</span>
                      <span className="ml-2 text-xs text-foreground/45">{t.priceUsd.toFixed(2)} USDC</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[t.status]}`}>
                      {t.status}
                      {t.settlement === 'onchain' ? ' · on-chain' : t.settlement === 'simulated' ? ' · simulated' : ''}
                    </span>
                  </div>
                  {t.description && <p className="mt-1.5 text-sm text-foreground/60">{t.description}</p>}
                  {t.deliverable && (
                    <p className="mt-2 rounded-xl bg-foreground/5 px-3 py-2 text-xs text-foreground/70">
                      <span className="font-semibold text-foreground/50">Delivered: </span>
                      {t.deliverable.slice(0, 240)}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* Worker side: deliver a funded task (server enforces agent ownership) */}
                    {t.status === 'funded' && (
                      <>
                        <input
                          value={deliverText[t.id] ?? ''}
                          onChange={(e) => setDeliverText((d) => ({ ...d, [t.id]: e.target.value }))}
                          placeholder="Deliverable (worker)"
                          className="min-w-0 flex-1 rounded-full border border-foreground/15 bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-foreground/40"
                        />
                        <button
                          type="button"
                          onClick={() => taskAction(t.id, '/api/marketplace/deliver', { deliverable: deliverText[t.id] ?? '' })}
                          disabled={busy === t.id}
                          className="rounded-full border border-foreground/15 px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-foreground/5 disabled:opacity-50"
                        >
                          Deliver
                        </button>
                      </>
                    )}
                    {/* Client side: approve/release or dispute a delivered task */}
                    {t.status === 'delivered' && (
                      <>
                        <button
                          type="button"
                          onClick={() => taskAction(t.id, '/api/marketplace/release', { rating: 5, review: 'Great work' })}
                          disabled={busy === t.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busy === t.id ? <Loader2 size={12} className="animate-spin" /> : null}
                          Release escrow
                        </button>
                        <button
                          type="button"
                          onClick={() => taskAction(t.id, '/api/marketplace/dispute', { reason: 'Not satisfactory' })}
                          disabled={busy === t.id}
                          className="rounded-full border border-amber-300/50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          Dispute &amp; refund
                        </button>
                      </>
                    )}
                    {(t.status === 'released' || t.status === 'refunded') && t.escrowExplorer && (
                      <a
                        href={t.escrowExplorer}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2775CA] hover:underline"
                      >
                        <ExternalLink size={12} /> ERC-8183 job on arcscan
                      </a>
                    )}
                  </div>
                  {note[t.id] && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">{note[t.id]}</p>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
