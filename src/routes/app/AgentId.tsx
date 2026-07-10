import { useEffect, useState } from 'react'
import {
  BadgeCheck,
  CheckCircle2,
  Circle,
  Fingerprint,
  RefreshCw,
  ShieldQuestion,
  Star,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useAuth, authHeaders } from '../../store/auth'
import { useAgentReputation, useMcpHealth, useResolveAgent } from '../../hooks/useMcp'

type Stage = 'register' | 'verify' | 'live'

const STAGES: { key: Stage; label: string; desc: string }[] = [
  { key: 'register', label: 'Register', desc: 'Create your on-chain agent identity via ERC-8004.' },
  { key: 'verify', label: 'KYA Verify', desc: 'Pass Know Your Agent checks. No personal data exposed.' },
  { key: 'live', label: 'Go Live', desc: 'Agent is verified and ready to pay and receive.' },
]

const CATEGORIES = [
  'Trading / Finance',
  'Research / Data',
  'Content / Writing',
  'DevOps / Code',
  'Customer Support',
  'Other',
]

/** The mock agent ID for this demo account. */
const DEMO_AGENT_ID = 'eip155:1:8004/1'

export default function AgentId() {
  const user = useAuth((s) => s.user)
  const [showReg, setShowReg] = useState(false)

  const mcpOnline = useMcpHealth() === 'online'

  // Live MCP data
  const { agent: liveAgent, source, loading: agentLoading } = useResolveAgent(DEMO_AGENT_ID)
  const { reputation: liveRep, loading: repLoading } = useAgentReputation(DEMO_AGENT_ID)

  // Real reputation of the first registered agent (from real settlements + on-chain
  // identity + tenure), when available. Falls back to the mock only when there are no agents.
  const [realRep, setRealRep] = useState<{
    score: number
    breakdown: { settlement: number; validation: number; tenure: number }
  } | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await fetch(`${MCP_BASE}/api/platform-agents`).then((r) => r.json())
        const first = list.agents?.[0]
        if (!first) return
        const rep = await fetch(`${MCP_BASE}/api/agents/reputation?agentId=${first.id}`).then((r) => r.json())
        if (!cancelled && rep && !('error' in rep)) setRealRep({ score: rep.score, breakdown: rep.breakdown })
      } catch {
        /* keep the fallback */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Real reputation when available; no fabricated fallback (show '—' if we have none).
  const score = realRep?.score ?? liveRep?.score ?? null
  const breakdown = realRep?.breakdown ?? liveRep?.breakdown ?? { settlement: 0, validation: 0, tenure: 0 }

  const stageIndex = 2 // "live": demo is fully registered

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent ID</h2>
          <p className="mt-1 text-sm text-ink/55">
            Your agent's on-chain passport. ERC-8004 gives every agent a verifiable identity, so
            others can trust it before transacting.
          </p>
        </div>
        {/* MCP source badge */}
        <div
          className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
            mcpOnline
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-ink/8 text-ink/40'
          }`}
        >
          {mcpOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {mcpOnline ? `Live (${source ?? 'mock'})` : 'Offline'}
        </div>
      </div>

      {/* Identity card */}
      <div
        className="relative mt-6 overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #7342E2 0%, #4F2FA8 100%)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, white 0%, transparent 50%), radial-gradient(circle at 20% 80%, white 0%, transparent 50%)',
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Fingerprint size={18} className="opacity-75" />
              <span className="text-sm font-semibold opacity-75">A-Identity</span>
            </div>
            <div className="text-xl font-bold tracking-tight">
              {liveAgent?.domain?.split('.')[0] ?? user?.name ?? 'My Agent'} Agent
            </div>
            <div className="mt-1 font-mono text-sm opacity-60">
              {liveAgent?.agentId ?? '0x7342...e2f1'}
            </div>
            <div className="mt-3 text-xs opacity-60">Category</div>
            <div className="text-sm font-semibold">Trading / Finance</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-60">ERC-8004</div>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <div className="text-3xl font-bold leading-none">{score ?? '—'}</div>
              {repLoading && <RefreshCw size={13} className="animate-spin opacity-50" />}
            </div>
            <div className="mt-0.5 text-xs opacity-60">Reputation</div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              <BadgeCheck size={13} />
              KYA Verified
            </div>
          </div>
        </div>
        <div className="relative mt-5 flex items-center justify-between">
          <div>
            <div className="text-xs opacity-60">Registered</div>
            <div className="text-sm font-semibold">
              {liveAgent?.registeredAt ?? 'Jan 29, 2026'}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-60">Network</div>
            <div className="text-sm font-semibold">5 chains</div>
          </div>
          <div>
            <div className="text-xs opacity-60">Standard</div>
            <div className="text-sm font-semibold">ERC-8004</div>
          </div>
        </div>
      </div>

      {/* Stage progress */}
      <div className="mt-6 rounded-2xl border border-ink/10 bg-white p-6">
        <h3 className="mb-4 font-semibold">Registration progress</h3>
        <div className="flex items-start">
          {STAGES.map(({ key, label, desc }, i) => {
            const done = i < stageIndex
            const active = i === stageIndex
            return (
              <div key={key} className="flex flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  {i > 0 && (
                    <div className={`h-0.5 flex-1 ${done || active ? 'bg-accent' : 'bg-ink/15'}`} />
                  )}
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                      done
                        ? 'border-accent bg-accent text-white'
                        : active
                          ? 'border-accent bg-white text-accent'
                          : 'border-ink/15 bg-white text-ink/25'
                    }`}
                  >
                    {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 ${done ? 'bg-accent' : 'bg-ink/15'}`} />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-xs font-semibold ${done || active ? 'text-accent' : 'text-ink/35'}`}>
                    {label}
                  </div>
                  <div className="mt-0.5 hidden text-[11px] text-ink/45 sm:block">{desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reputation breakdown */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <ReputationCard
          label="Settlement score"
          value={breakdown.settlement}
          max={600}
          color="#7342E2"
          loading={repLoading}
        />
        <ReputationCard
          label="Validation score"
          value={breakdown.validation}
          max={240}
          color="#2775CA"
          loading={repLoading}
        />
        <ReputationCard
          label="Tenure score"
          value={breakdown.tenure}
          max={160}
          color="#1AAB7A"
          loading={repLoading}
        />
      </div>

      {/* Source detail */}
      {(agentLoading || !mcpOnline) ? null : (
        <p className="mt-2 text-xs text-ink/40">
          {mcpOnline
            ? `Score computed live from MCP server (source: ${source ?? 'mock'}). Formula: settlement + validation + tenure, max 1000.`
            : 'Score is mock data. Start the MCP server to see live on-chain data.'}
        </p>
      )}

      {/* Human-on-the-loop */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-5">
        <ShieldQuestion size={20} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-semibold text-ink">Human approval required for deployment</p>
          <p className="mt-1 text-sm text-ink/65">
            Registering on any chain (Ethereum, Base, Arbitrum, Stellar, or Algorand) requires
            your explicit approval. This preview runs against a mock identity provider.
          </p>
        </div>
      </div>

      {/* Register new agent */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Register a new agent</h3>
          <button
            type="button"
            onClick={() => setShowReg((v) => !v)}
            className="rounded-full border border-accent/30 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/5"
          >
            {showReg ? 'Cancel' : 'New agent'}
          </button>
        </div>
        {showReg && <RegisterForm onClose={() => setShowReg(false)} />}
      </div>

      {/* Reputation milestones */}
      <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-6">
        <h3 className="mb-4 font-semibold">Reputation milestones</h3>
        <ul className="flex flex-col gap-3">
          {[
            { threshold: 100, label: 'First verified agent', done: true },
            { threshold: 300, label: 'Trusted agent (auto-approve eligible)', done: true },
            { threshold: 500, label: 'Established agent (raised daily cap)', done: true },
            ...(score != null ? [{ threshold: score, label: 'You are here', done: true, current: true }] : []),
            { threshold: 900, label: 'Elite agent (full autonomy tier)', done: false },
          ].map(({ threshold, label, done, current }) => (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                current ? 'border border-accent/25 bg-accent/[0.05]' : 'bg-cream/40'
              }`}
            >
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  done ? 'bg-accent text-white' : 'bg-ink/10 text-ink/40'
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : <Star size={14} />}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-ink">{label}</span>
              </div>
              <span className="text-xs font-semibold text-ink/40">{threshold} pts</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ReputationCard({
  label,
  value,
  max,
  color,
  loading,
}: {
  label: string
  value: number
  max: number
  color: string
  loading: boolean
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="text-xs font-semibold text-ink/50">{label}</div>
      <div
        className={`mt-2 text-2xl font-bold tracking-tight transition-opacity ${loading ? 'opacity-50' : ''}`}
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-xs text-ink/35">of {max}</div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/8">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

import { MCP_BASE } from '../../lib/mcpBase'

const CAPABILITIES = ['Payments', 'Purchases', 'Rentals', 'Batch actions'] as const

/**
 * Full onboarding: identity details, capabilities, KYA permissions, a real Arc
 * testnet wallet (key shown once, never stored), then registration. The on-chain
 * anchor is queued for human approval; everything else happens for real against
 * the local platform backend.
 */
function RegisterForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [caps, setCaps] = useState<string[]>(['Payments'])
  const [dailyCap, setDailyCap] = useState('50')
  const [autoApprove, setAutoApprove] = useState('1')
  const [a2a, setA2a] = useState(true)
  const [a2h, setA2h] = useState(false)

  const [wallet, setWallet] = useState<{ address: string; privateKey: string } | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [anchorBusy, setAnchorBusy] = useState(false)
  const [anchored, setAnchored] = useState<{ onchainTx?: string; onchainExplorer?: string; onchainAgentId?: string } | null>(null)
  const [anchorNote, setAnchorNote] = useState<string | null>(null)
  const [kyaBusy, setKyaBusy] = useState(false)
  const [kya, setKya] = useState<{ verified: boolean; onchainTx?: string; onchainExplorer?: string } | null>(null)
  const [kyaNote, setKyaNote] = useState<string | null>(null)

  const input =
    'w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent'
  const label = 'text-xs font-semibold text-ink/50'

  const toggleCap = (c: string) =>
    setCaps((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const createWallet = async () => {
    setWalletBusy(true)
    setError(null)
    try {
      // Generate the keypair IN THE BROWSER — the private key never touches the server.
      const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
      const privateKey = generatePrivateKey()
      const address = privateKeyToAccount(privateKey).address
      // Register only the public address with the backend.
      await fetch(`${MCP_BASE}/api/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ address }),
      })
      setWallet({ address, privateKey })
    } catch {
      setError('Wallet creation needs the MCP server. Run: npm run dev:all')
    } finally {
      setWalletBusy(false)
    }
  }

  const submit = async () => {
    if (!name.trim()) { setError('Give the agent a name.'); return }
    setSubmitBusy(true)
    setError(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          category,
          capabilities: caps,
          permissions: {
            dailyCapUsd: Number(dailyCap) || 50,
            autoApproveUnderUsd: Number(autoApprove) || 1,
            agentToAgent: a2a,
            agentToHuman: a2h,
          },
          walletAddress: wallet?.address,
        }),
      })
      const data = (await res.json()) as { agent?: { id: string } }
      if (data.agent) setDone(data.agent.id)
      else setError('Registration failed. Is the MCP server running?')
    } catch {
      setError('Registration needs the MCP server. Run: npm run dev:all')
    } finally {
      setSubmitBusy(false)
    }
  }

  // Deliberate, human-triggered on-chain anchor: broadcasts a real ERC-8004
  // registration on Arc and shows the tx. Env-gated behind ARC_SIGNER_KEY server-side.
  const anchorOnchain = async () => {
    if (!done) return
    setAnchorBusy(true)
    setAnchorNote(null)
    try {
      const res = await fetch(`${MCP_BASE}/api/agents/anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId: done }),
      })
      const data = (await res.json()) as {
        agent?: { onchainTx?: string; onchainExplorer?: string; onchainAgentId?: string }
        result?: { executed?: boolean; reason?: string }
        error?: string
      }
      if (data.result?.executed && data.agent) setAnchored(data.agent)
      else setAnchorNote(data.result?.reason ?? data.error ?? 'Could not broadcast. Set a funded ARC_SIGNER_KEY on the server.')
    } catch {
      setAnchorNote('Anchoring needs the MCP server running with a funded ARC_SIGNER_KEY.')
    } finally {
      setAnchorBusy(false)
    }
  }

  // Real KYA: prove the agent controls its wallet by signing a challenge with the
  // key generated in the browser. On success the backend also attests the result on
  // the ERC-8004 ValidationRegistry (if the agent is anchored + a signer key is set).
  const proveKya = async () => {
    if (!done || !wallet) return
    setKyaBusy(true)
    setKyaNote(null)
    try {
      const chRes = await fetch(`${MCP_BASE}/api/agents/kya/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId: done }),
      })
      const ch = (await chRes.json()) as { message?: string; error?: string }
      if (!ch.message) { setKyaNote(ch.error ?? 'Could not start the KYA challenge.'); return }
      const { privateKeyToAccount } = await import('viem/accounts')
      const signature = await privateKeyToAccount(wallet.privateKey as `0x${string}`).signMessage({ message: ch.message })
      const vRes = await fetch(`${MCP_BASE}/api/agents/kya/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ agentId: done, message: ch.message, signature }),
      })
      const v = (await vRes.json()) as { kya?: string; onchain?: { txHash?: string; explorerUrl?: string }; error?: string }
      if (v.kya === 'verified') {
        setKya({ verified: true, onchainTx: v.onchain?.txHash, onchainExplorer: v.onchain?.explorerUrl })
      } else {
        setKyaNote(v.error ?? 'KYA verification failed.')
      }
    } catch {
      setKyaNote('KYA needs the MCP server.')
    } finally {
      setKyaBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6">
        <div className="flex items-center gap-2 font-bold text-emerald-700">
          <CheckCircle2 size={18} /> {name} is registered.
        </div>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink/70">
          <li>Permissions set (daily cap, auto-approve).</li>
          {kya?.verified ? (
            <li>KYA verified — wallet control proven.</li>
          ) : (
            <li>KYA pending — prove the agent controls its wallet below.</li>
          )}
          {wallet && <li>Wallet {wallet.address.slice(0, 10)}... is assigned to it.</li>}
          {!anchored && <li>On-chain anchor is queued. Anchor it on Arc to mint a real ERC-8004 identity.</li>}
        </ul>

        {/* On-chain anchor: real ERC-8004 registration on Arc, human-triggered */}
        {anchored ? (
          <div className="mt-4 rounded-xl border border-[#2775CA]/25 bg-[#2775CA]/[0.05] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2775CA]">
              <BadgeCheck size={16} /> Anchored on Arc — ERC-8004 id #{anchored.onchainAgentId ?? '?'}
            </div>
            {anchored.onchainExplorer && (
              <a
                href={anchored.onchainExplorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block break-all text-xs font-semibold text-[#2775CA] hover:underline"
              >
                View transaction on arcscan
              </a>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={anchorOnchain}
              disabled={anchorBusy}
              className="rounded-full border border-[#2775CA]/30 px-4 py-2 text-sm font-semibold text-[#2775CA] transition-colors hover:bg-[#2775CA]/5 disabled:opacity-50"
            >
              {anchorBusy ? 'Anchoring on Arc...' : 'Anchor on Arc (register on-chain)'}
            </button>
            {anchorNote && <p className="mt-2 text-xs text-amber-700">{anchorNote}</p>}
          </div>
        )}

        {/* KYA: prove the agent controls its wallet (real signature, not a stamp) */}
        {wallet && (
          <div className="mt-4">
            {kya?.verified ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <BadgeCheck size={16} /> KYA verified — wallet control proven
                </div>
                {kya.onchainExplorer ? (
                  <a
                    href={kya.onchainExplorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Attested on-chain — ERC-8004 ValidationRegistry (view tx)
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-ink/45">Anchor on Arc to also record this on the ERC-8004 ValidationRegistry.</p>
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={proveKya}
                  disabled={kyaBusy}
                  className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                >
                  {kyaBusy ? 'Proving wallet control...' : 'Prove wallet control (KYA)'}
                </button>
                <p className="mt-2 text-xs text-ink/45">
                  Signs a challenge with your agent's wallet key (in your browser)
                  {anchored ? ' and records it on the ERC-8004 ValidationRegistry.' : ' — anchor first for an on-chain attestation.'}
                </p>
                {kyaNote && <p className="mt-2 text-xs text-amber-700">{kyaNote}</p>}
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <a
            href="/app/marketplace"
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            See it in Agent House
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink/70"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 flex flex-col gap-5">
      {/* 1. Identity */}
      <div>
        <div className={label}>1. Identity</div>
        <div className="mt-2 flex flex-col gap-3">
          <input className={input} placeholder="Agent name (e.g. My Trading Agent)" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className={input} placeholder="What does this agent do?" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* 2. Capabilities */}
      <div>
        <div className={label}>2. What it is allowed to do</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPABILITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCap(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                caps.includes(c)
                  ? 'bg-accent text-white'
                  : 'border border-ink/15 text-ink/60 hover:bg-ink/5'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 3. KYA permissions */}
      <div>
        <div className={label}>3. Permissions (set at KYA, like card limits)</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] text-ink/45">Daily cap (USD)</div>
            <input className={input} type="number" min="0" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink/45">Auto-approve under (USD)</div>
            <input className={input} type="number" min="0" step="0.1" value={autoApprove} onChange={(e) => setAutoApprove(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={a2a} onChange={(e) => setA2a(e.target.checked)} className="accent-[#7342E2]" />
            Agent-to-agent payments
          </label>
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input type="checkbox" checked={a2h} onChange={(e) => setA2h(e.target.checked)} className="accent-[#7342E2]" />
            Agent-to-human payments
          </label>
        </div>
      </div>

      {/* 4. Wallet */}
      <div>
        <div className={label}>4. Arc testnet wallet</div>
        {!wallet ? (
          <button
            type="button"
            onClick={createWallet}
            disabled={walletBusy}
            className="mt-2 rounded-full border border-[#2775CA]/30 px-4 py-2.5 text-sm font-semibold text-[#2775CA] transition-colors hover:bg-[#2775CA]/5 disabled:opacity-50"
          >
            {walletBusy ? 'Creating...' : 'Create wallet (generated in your browser)'}
          </button>
        ) : (
          <div className="mt-2 rounded-xl border border-[#2775CA]/25 bg-[#2775CA]/[0.04] p-4">
            <div className="text-[11px] font-bold text-ink/50">Address</div>
            <div className="break-all font-mono text-xs text-ink">{wallet.address}</div>
            <div className="mt-2 text-[11px] font-bold text-red-600">
              Private key (generated in your browser — the server never sees it)
            </div>
            <div className="break-all font-mono text-xs text-ink/70">{wallet.privateKey}</div>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-[#2775CA] hover:underline"
            >
              Fund it with testnet USDC at faucet.circle.com
            </a>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitBusy}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
      >
        {submitBusy ? 'Registering...' : 'Pass KYA and register on Arc testnet'}
      </button>
      <p className="text-xs text-ink/45">
        Registration writes to the A-Identity registry now; the on-chain anchor is queued and
        broadcast only after a human approves it.
      </p>
    </div>
  )
}
