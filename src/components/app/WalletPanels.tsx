import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, TrendingUp, Wallet } from 'lucide-react'
import { authHeaders } from '../../store/auth'
import { MCP_BASE } from '../../lib/mcpBase'

const short = (a: string) => (a.length > 14 ? `${a.slice(0, 8)}...${a.slice(-4)}` : a)

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-ink/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </div>
  )
}

type CircleWalletState = {
  circleWalletId: string | null
  circleWalletAddress?: string | null
  configured?: boolean
  walletAddress?: string | null
  blockchain?: string | null
  state?: string | null
  balances?: { amount: string; symbol?: string; tokenAddress?: string }[]
  explorer?: string | null
  reason?: string
  error?: string
}

/**
 * Provision a Circle Agent Wallet for the agent: the hosted wallet layer enforcement
 * layer that complements the on-chain vault. The agent's USDC lives in a Circle-managed
 * wallet on Arc whose hosted policy engine SCREENS every transfer (sanctions, address
 * allow/block, freeze). Precise by design: Circle screens at the wallet layer; the spend
 * cap stays on our server + the on-chain vault. Credential-gated behind Circle keys.
 */
export function CircleWalletPanel({ agentId }: { agentId: string }) {
  const [wallet, setWallet] = useState<CircleWalletState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/circle-wallet?agentId=${agentId}`, {
        signal: AbortSignal.timeout(12000),
      })
      setWallet((await res.json()) as CircleWalletState)
      setErr(null)
    } catch {
      setErr('Could not load Circle wallet status.')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    if (agentId) load()
  }, [agentId, load])

  const provision = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/circle-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId, fund: true }),
      })
      const j = (await res.json()) as { error?: string }
      if (j.error) setErr(j.error)
      await load()
    } catch {
      setErr('Provision failed. The backend needs CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET.')
    } finally {
      setBusy(false)
    }
  }

  const has = !!wallet?.circleWalletId
  const addr = wallet?.circleWalletAddress ?? wallet?.walletAddress ?? null
  const usdc = wallet?.balances?.find((b) => (b.symbol ?? '').toUpperCase().includes('USDC'))

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#2775CA]/25 bg-gradient-to-b from-[#2775CA]/[0.06] to-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#2775CA] text-white">
          <Wallet size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Circle Agent Wallet</h3>
            {has && (
              <span className="rounded-full bg-[#2775CA]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2775CA]">
                Live on Arc
              </span>
            )}
          </div>
          <p className="text-[11px] text-ink/50">A Circle managed wallet, screened at the wallet layer</p>
        </div>
      </div>
      <p className="mb-4 text-xs text-ink/55">
        Give the agent a <b>Circle-managed wallet</b> on Arc. Circle's hosted policy engine screens
        every transfer at the <b>wallet layer</b> (sanctions, address allow and block, and freeze) and
        settles real USDC. It complements the onchain vault: the server sets the spend cap, Circle
        screens at the wallet layer, and the vault enforces it trustlessly onchain.
      </p>

      {loading ? (
        <div className="text-xs text-ink/45">Loading Circle wallet status...</div>
      ) : has ? (
        <div className="space-y-3">
          {addr && (
            <a
              href={wallet?.explorer ?? `https://testnet.arcscan.app/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#2775CA] hover:underline"
            >
              {short(addr)} <ExternalLink size={11} />
            </a>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Wallet State" value={wallet?.state ?? (wallet?.configured === false ? 'Keys off' : 'Not set')} />
            <Stat label="USDC Balance" value={usdc ? `$${Number(usdc.amount).toFixed(2)}` : 'Not set'} />
            <Stat label="Network" value={wallet?.blockchain ?? 'ARC-TESTNET'} />
          </div>
          {wallet?.configured === false && wallet?.reason && (
            <p className="text-[11px] text-ink/45">
              Wallet stored; live balance needs Circle keys on the backend. {wallet.reason}
            </p>
          )}
          <p className="text-[11px] text-ink/45">
            Address payments now settle through Circle, screened by its hosted policy at the wallet layer.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={provision}
          disabled={busy}
          className="rounded-full bg-[#2775CA] px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {busy ? 'Provisioning on Circle...' : 'Provision Circle Agent Wallet'}
        </button>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </section>
  )
}

type TreasuryState = {
  address?: string
  balances?: { usdcUsd: number; eurcUsd: number; usycUsd: number; idleUsd: number; totalUsd: number }
  capUsd?: number
  deployableUsd?: number
  projection?: { apyPct: number; weeklyUsd: number; monthlyUsd: number; yearlyUsd: number }
  usyc?: { token: string; teller: string; explorer: string; apyEstimatePct: number }
  note?: string
  autoYieldEnabled?: boolean
  authorizedAt?: string
  error?: string
}

const CAP_PRESETS = [0, 5, 25, 100]

function BalanceTile({ ticker, value, yielding }: { ticker: string; value: string; yielding?: boolean }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-ink/55">{ticker}</span>
        {yielding && (
          <span className="rounded-full bg-emerald-100 px-1.5 py-[1px] text-[9px] font-semibold text-emerald-700">Yielding</span>
        )}
      </div>
      <div className="mt-1 text-lg font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-ink/45">{label}</div>
      <div className="mt-0.5 text-base font-semibold tracking-tight text-ink tabular-nums">{value}</div>
    </div>
  )
}

/**
 * Treasury: put the agent's idle stablecoin to work in USYC, Circle's yield-bearing token.
 * Idle USDC/EURC above a working-capital cap earns yield and redeems back to USDC on demand.
 * The owner reviews projected earnings and authorizes; balances and the review are live, the
 * on-chain USDC to USYC mint goes live once the wallet is USYC-allowlisted (enterprise-gated).
 */
export function TreasuryPanel({ agentId }: { agentId: string }) {
  const [t, setT] = useState<TreasuryState | null>(null)
  const [cap, setCap] = useState('25')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(
    async (capUsd?: string, opts?: { syncCap?: boolean; quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true)
      try {
        const q = capUsd !== undefined && capUsd !== '' ? `&cap=${Number(capUsd)}` : ''
        const res = await fetch(`${MCP_BASE}/api/agents/treasury?agentId=${agentId}${q}`, { signal: AbortSignal.timeout(12000) })
        const j = (await res.json()) as TreasuryState
        setT(j)
        // Only sync the input to the saved cap on the first load; never overwrite what
        // the owner is actively typing.
        if (opts?.syncCap && typeof j.capUsd === 'number') setCap(String(j.capUsd))
        setErr(j.error ?? null)
      } catch {
        setErr('Could not load treasury status.')
      } finally {
        if (!opts?.quiet) setLoading(false)
      }
    },
    [agentId],
  )

  // Initial load: fetch balances and sync the cap to the saved config.
  useEffect(() => {
    if (agentId) load(undefined, { syncCap: true })
  }, [agentId, load])

  // Auto-preview: a moment after the cap stops changing, recalculate quietly so typing a
  // number updates the projection without hunting for the Preview button or a loading flash.
  useEffect(() => {
    if (!agentId) return
    const t = setTimeout(() => load(cap, { quiet: true }), 400)
    return () => clearTimeout(t)
  }, [cap, agentId, load])

  const act = async (enable: boolean) => {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/treasury`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(enable ? { agentId, capUsd: Number(cap) || 0 } : { agentId, enabled: false }),
      })
      const j = (await res.json()) as { error?: string }
      if (j.error) setErr(j.error)
      await load(cap)
    } catch {
      setErr('Action failed. Is the backend running?')
    } finally {
      setBusy(false)
    }
  }

  const setCapPreset = (v: number) => {
    setCap(String(v))
    load(String(v))
  }

  const b = t?.balances
  const proj = t?.projection
  const on = !!t?.autoYieldEnabled
  const deployable = t?.deployableUsd ?? 0
  const apy = t?.usyc?.apyEstimatePct ?? proj?.apyPct ?? 4.2
  const money = (n?: number) => `$${(n ?? 0).toFixed(2)}`

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/50 to-white p-6 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white">
            <TrendingUp size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-ink">Treasury</h3>
              {on && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Auto Yield On
                </span>
              )}
            </div>
            <p className="text-[11px] text-ink/50">Idle balance put to work in USYC</p>
          </div>
        </div>
        {t?.address && (
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-2.5 py-1 text-[11px] font-medium text-ink/55 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Reading {short(t.address)}
          </span>
        )}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink/55">
        Put the agent's idle stablecoin to work. Anything above your working capital cap earns yield in <b>USYC</b>,
        Circle's tokenized money market fund on Arc, and redeems back to USDC when the agent needs to spend. You review
        the projection and authorize. Nothing moves on its own.
      </p>

      {loading ? (
        <div className="mt-5 text-xs text-ink/45">Loading treasury...</div>
      ) : t?.error ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-ink/60">{t.error}</div>
      ) : (
        <div className="mt-5 space-y-5">
          <div>
            <div className="mb-2 text-[11px] font-medium text-ink/45">Wallet Balances</div>
            <div className="grid grid-cols-3 gap-2.5">
              <BalanceTile ticker="USDC" value={money(b?.usdcUsd)} />
              <BalanceTile ticker="EURC" value={money(b?.eurcUsd)} />
              <BalanceTile ticker="USYC" value={money(b?.usycUsd)} yielding />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink/45">Working Capital Cap</span>
              <span className="text-[11px] text-ink/40">Idle below this stays liquid</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {CAP_PRESETS.map((v) => {
                const active = Number(cap) === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCapPreset(v)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      active ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink/60 hover:border-ink/25'
                    }`}
                  >
                    ${v}
                  </button>
                )
              })}
              <div className="ml-1 inline-flex items-center rounded-full border border-black/10 bg-white pl-3">
                <span className="text-[11px] text-ink/40">$</span>
                <input
                  type="number"
                  min="0"
                  value={cap}
                  onChange={(e) => setCap(e.target.value)}
                  className="w-16 bg-transparent px-1.5 py-1.5 text-xs font-semibold text-ink outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => load(cap, { quiet: true })}
                className="rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                Preview
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-emerald-300/60 bg-gradient-to-r from-emerald-400/[0.16] via-emerald-300/[0.08] to-transparent px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium text-ink/50">Ready To Earn In USYC</div>
                <div className="mt-0.5 text-[26px] font-bold leading-none tracking-tight text-emerald-700 tabular-nums">
                  {money(deployable)}
                </div>
              </div>
              <div className="text-right text-[11px] leading-relaxed text-ink/50">
                <div>About {apy}% APY estimate</div>
                <div className="tabular-nums">
                  {money(proj?.monthlyUsd)} per month · {money(proj?.weeklyUsd)} per week
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MetricTile label="Idle Now" value={money(b?.idleUsd)} />
            <MetricTile label="Deployable" value={money(deployable)} />
            <MetricTile label="Est. Monthly" value={money(proj?.monthlyUsd)} />
            <MetricTile label="Est. Yearly" value={money(proj?.yearlyUsd)} />
          </div>

          {deployable <= 0 && (
            <p className="text-[11px] text-ink/45">
              Idle balance is at or below the ${Number(cap) || 0} cap. Lower the cap to put more to work.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {on ? (
              <>
                <button
                  type="button"
                  onClick={() => act(true)}
                  disabled={busy}
                  className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? 'Updating...' : 'Update Cap'}
                </button>
                <button
                  type="button"
                  onClick={() => act(false)}
                  disabled={busy}
                  className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink/60 transition hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                >
                  Turn Off
                </button>
                <span className="text-xs font-medium text-emerald-700">
                  Authorized{typeof t?.capUsd === 'number' ? ` · cap $${t.capUsd}` : ''}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={() => act(true)}
                disabled={busy}
                className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy ? 'Authorizing...' : 'Authorize Auto Yield'}
              </button>
            )}
            {t?.usyc?.explorer && (
              <a
                href={t.usyc.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                USYC Contract <ExternalLink size={11} />
              </a>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-ink/40">
            USYC is an enterprise gated Circle product. Balances, the cap and the earnings review are live now. The
            onchain USDC to USYC mint goes live once this wallet is USYC allowlisted (Circle Support, about 24 to 48
            hours). Estimated APY only. USYC yield floats with short Treasury rates.
          </p>
        </div>
      )}
      {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
    </section>
  )
}
