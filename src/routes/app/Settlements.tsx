import { useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'

type Settlement = {
  id: string
  date: string
  from: string
  to: string
  amount: number
  coin: string
  coinColor: string
  status: 'settled' | 'pending'
  type: 'in' | 'out'
  purpose: string
}


const ALL_SETTLEMENTS: Settlement[] = [
  { id: 'x402-001', date: 'Jun 17, 2026', from: 'ResearchBot', to: 'My Agent', amount: 0.001, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'in', purpose: 'Data query result' },
  { id: 'x402-002', date: 'Jun 17, 2026', from: 'My Agent', to: 'DataProvider', amount: 0.005, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'out', purpose: 'API call fee' },
  { id: 'x402-003', date: 'Jun 17, 2026', from: 'My Agent', to: 'AnalyticsBot', amount: 0.0005, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'out', purpose: 'Report generation' },
  { id: 'x402-004', date: 'Jun 16, 2026', from: 'TradeAgent', to: 'My Agent', amount: 5.00, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'in', purpose: 'Settlement payout' },
  { id: 'x402-005', date: 'Jun 16, 2026', from: 'My Agent', to: 'SchedulerBot', amount: 0.0001, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'out', purpose: 'Task scheduling' },
  { id: 'x402-006', date: 'Jun 15, 2026', from: 'My Agent', to: 'StorageBot', amount: 0.002, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'out', purpose: 'Data storage (1 GB)' },
  { id: 'x402-007', date: 'Jun 14, 2026', from: 'NewsBot', to: 'My Agent', amount: 0.0008, coin: 'USDC', coinColor: '#2775CA', status: 'settled', type: 'in', purpose: 'Insight delivery' },
  { id: 'x402-008', date: 'Jun 14, 2026', from: 'My Agent', to: 'TranslateBot', amount: 0.003, coin: 'USDC', coinColor: '#2775CA', status: 'pending', type: 'out', purpose: 'Translation task' },
]

type Filter = 'all' | 'in' | 'out'

export default function Settlements() {
  const [filter, setFilter] = useState<Filter>('all')

  const shown = ALL_SETTLEMENTS.filter((s) => filter === 'all' || s.type === filter)

  const totalIn = ALL_SETTLEMENTS.filter((s) => s.type === 'in').reduce((acc, s) => acc + s.amount, 0)
  const totalOut = ALL_SETTLEMENTS.filter((s) => s.type === 'out').reduce((acc, s) => acc + s.amount, 0)

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">Settlements</h2>
      <p className="mt-1 text-sm text-ink/55">
        Every x402 payment your agent sent or received. Settled on Arc, anchored on Base.
      </p>

      {/* Summary row */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="text-xs font-semibold text-ink/45">Total in</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-emerald-600">
            +{totalIn.toFixed(4)} USDC
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="text-xs font-semibold text-ink/45">Total out</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-ink">
            -{totalOut.toFixed(4)} USDC
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="text-xs font-semibold text-ink/45">Settlements</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-ink">
            {ALL_SETTLEMENTS.length}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-6 flex gap-2">
        {(['all', 'in', 'out'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-accent text-white'
                : 'border border-ink/10 bg-white text-ink/60 hover:bg-ink/5'
            }`}
          >
            {f === 'all' ? 'All' : f === 'in' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {/* Settlement list */}
      <ul className="mt-4 flex flex-col gap-2.5">
        {shown.map((tx) => (
          <li
            key={tx.id}
            className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4"
          >
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
              style={{
                background: tx.type === 'in' ? '#1AAB7A' : '#7342E2',
              }}
            >
              {tx.type === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink">
                  {tx.type === 'in' ? tx.from : tx.to}
                </span>
                {tx.status === 'settled' ? (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                ) : (
                  <Clock size={13} className="shrink-0 text-amber-500" />
                )}
              </div>
              <div className="text-xs text-ink/45">{tx.purpose}</div>
            </div>

            <div className="hidden text-right sm:block">
              <div className="text-xs text-ink/35">{tx.date}</div>
              <div className="mt-0.5 font-mono text-[11px] text-ink/25">{tx.id}</div>
            </div>

            <div className="text-right">
              <div
                className={`text-sm font-bold ${
                  tx.type === 'in' ? 'text-emerald-600' : 'text-ink'
                }`}
              >
                {tx.type === 'in' ? '+' : '-'}
                {tx.amount < 0.01 ? tx.amount.toFixed(4) : tx.amount.toFixed(2)}{' '}
                <span
                  className="text-xs font-semibold"
                  style={{ color: tx.coinColor }}
                >
                  {tx.coin}
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  tx.status === 'settled' ? 'text-emerald-500' : 'text-amber-500'
                }`}
              >
                {tx.status === 'settled' ? 'Settled' : 'Pending'}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {shown.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-white/50 p-8 text-center text-sm text-ink/50">
          No settlements match this filter.
        </div>
      )}

      <p className="mt-6 text-xs text-ink/35">
        x402 payments settle on Arc in under a second. Human-approved settlements show
        the approving address in the full detail view.
      </p>
    </div>
  )
}
