import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Plus,
  ShieldQuestion,
  Wallet as WalletIcon,
} from 'lucide-react'
import { CHAINS, type ChainId } from '../../lib/chains'
import { useArcStatus, useMcpChains } from '../../hooks/useMcp'
import UnifiedBalancePanel from '../../components/app/UnifiedBalancePanel'

type CoinBalance = { symbol: string; balance: number; color: string }

type ChainWallet = {
  chainId: ChainId
  coins: CoinBalance[]
}

const WALLETS: ChainWallet[] = [
  {
    chainId: 'arc',
    // Arc carries the Circle-native set: USDC (gas + settlement), EURC (euro),
    // USYC (tokenized money market fund, yield). No USDT on Arc.
    coins: [
      { symbol: 'USDC', balance: 142.50, color: '#2775CA' },
      { symbol: 'EURC', balance: 0, color: '#1F7A4D' },
      { symbol: 'USYC', balance: 0, color: '#0E7490' },
    ],
  },
  {
    chainId: 'base',
    coins: [
      { symbol: 'USDC', balance: 0, color: '#2775CA' },
      { symbol: 'USDT', balance: 0, color: '#26A17B' },
      { symbol: 'PYUSD', balance: 0, color: '#0E2A8C' },
    ],
  },
  {
    chainId: 'arbitrum',
    coins: [
      { symbol: 'USDC', balance: 0, color: '#2775CA' },
      { symbol: 'USDT', balance: 0, color: '#26A17B' },
    ],
  },
  {
    chainId: 'stellar',
    coins: [
      { symbol: 'USDC', balance: 0, color: '#2775CA' },
      { symbol: 'EURC', balance: 0, color: '#1F7A4D' },
    ],
  },
  {
    chainId: 'algorand',
    coins: [
      { symbol: 'USDC', balance: 0, color: '#2775CA' },
      { symbol: 'USDT', balance: 0, color: '#26A17B' },
    ],
  },
]

const TXS = [
  { id: 'x402-001', from: 'ResearchBot', to: 'My Agent', amount: 0.001, coin: 'USDC', coinColor: '#2775CA', type: 'in', when: '2m ago', label: 'Data query result', chain: 'arc' },
  { id: 'x402-002', from: 'My Agent', to: 'DataProvider', amount: 0.005, coin: 'USDC', coinColor: '#2775CA', type: 'out', when: '18m ago', label: 'API call fee', chain: 'arc' },
  { id: 'x402-003', from: 'My Agent', to: 'AnalyticsBot', amount: 0.0005, coin: 'USDC', coinColor: '#2775CA', type: 'out', when: '2h ago', label: 'Report generation', chain: 'base' },
  { id: 'x402-004', from: 'TradeAgent', to: 'My Agent', amount: 5.00, coin: 'USDC', coinColor: '#2775CA', type: 'in', when: '1d ago', label: 'Settlement payout', chain: 'arbitrum' },
] as const

export default function Wallet() {
  const [activeChain, setActiveChain] = useState<ChainId>('arc')
  const [showFund, setShowFund] = useState(false)
  const { chains: mcpChains } = useMcpChains()
  const { arc } = useArcStatus()

  const wallet = WALLETS.find((w) => w.chainId === activeChain)!
  const chain = CHAINS.find((c) => c.id === activeChain)!
  const totalUSD = WALLETS.flatMap((w) => w.coins).reduce((s, c) => s + c.balance, 0)

  // Merge MCP chain data (agent counts) with static config
  const mcpChainById = Object.fromEntries(mcpChains.map((c) => [c.id, c]))

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
      <p className="mt-1 text-sm text-ink/55">
        Your agent's multi-chain stablecoin wallet. Funds here pay for x402 actions.
        You control the limits in Permissions.
      </p>

      {/* Unified balance (Circle App Kit / Gateway) */}
      <div className="mt-6">
        <UnifiedBalancePanel />
      </div>

      {/* Per-chain balances heading */}
      <h3 className="mt-8 font-semibold">Per-chain balances</h3>
      <p className="mb-1 text-xs text-ink/45">
        Raw balances on each chain, before they are deposited into the unified balance.
      </p>

      {/* Total balance hero */}
      <div
        className="relative mt-6 overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #2775CA 0%, #1A4F8C 100%)' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-semibold opacity-75">
            <WalletIcon size={16} />
            Total balance (all chains)
          </div>
          <div className="mt-2 text-4xl font-bold tracking-tight">
            ${totalUSD.toFixed(2)}
          </div>
          <div className="mt-1 text-sm opacity-60">Arc + Base + Arbitrum One</div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowFund(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <Plus size={15} />
              Fund wallet
            </button>
          </div>
        </div>
      </div>

      {/* Human-on-the-loop */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/[0.05] p-4">
        <ShieldQuestion size={18} className="mt-0.5 shrink-0 text-accent" />
        <p className="text-sm text-ink/70">
          Moving real funds requires your approval. Connect a Circle Agent Wallet (Arc) or
          set up wallet contracts on Base and Arbitrum to go live.
        </p>
      </div>

      {/* Chain tabs */}
      <div className="mt-6 flex gap-2">
        {CHAINS.map((c) => {
          const mc = mcpChainById[c.id]
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChain(c.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeChain === c.id
                  ? 'text-white'
                  : 'border border-ink/10 bg-white text-ink/60 hover:bg-ink/5'
              }`}
              style={activeChain === c.id ? { background: c.color } : {}}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: c.color, opacity: activeChain === c.id ? 1 : 0.6 }}
              />
              {c.shortName}
              {mc && (
                <span className={`text-[10px] font-normal opacity-70`}>
                  {mc.agentCount} agent{mc.agentCount === 1 ? '' : 's'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Chain detail card */}
      <div className="mt-3 rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: chain.color }}
              />
              <span className="font-semibold text-ink">{chain.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  chain.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : chain.status === 'preview'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-ink/8 text-ink/50'
                }`}
              >
                {chain.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink/50">{chain.role}</p>
          </div>
          {chain.explorer && (
            <a
              href={chain.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              Explorer <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="mt-2 font-mono text-xs text-ink/30">
          {chain.chainId ? `chainId: ${chain.chainId}` : `caip2: ${chain.caip2 ?? 'n/a'}`}
          {chain.evmCompatible ? ' | EVM' : ' | non-EVM'}
        </div>

        {/* Protocols on this chain */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Payment: x402 */}
          {chain.protocols.payment.x402 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: '#2775CA18', color: '#2775CA' }}
              title={chain.protocols.payment.note}
            >
              x402 payments
            </span>
          )}
          {/* Identity standard */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              chain.protocols.identity.erc8004Native
                ? 'bg-accent/12 text-accent'
                : 'bg-ink/8 text-ink/60'
            }`}
            title={chain.protocols.identity.note}
          >
            {chain.protocols.identity.standard}
            {!chain.protocols.identity.erc8004Native && (
              <span className="opacity-60">(bridged)</span>
            )}
          </span>
        </div>

        {/* Live Arc status (read from the Arc testnet RPC via MCP) */}
        {activeChain === 'arc' && arc && (
          <div className="mt-4 rounded-xl border border-[#2775CA]/20 bg-[#2775CA]/[0.04] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink/70">
                <span
                  className={`h-2 w-2 rounded-full ${arc.online ? 'bg-emerald-400' : 'bg-amber-400'}`}
                />
                {arc.online ? 'Live on Arc testnet' : 'Arc testnet (RPC quiet)'}
              </div>
              <a
                href={arc.faucet}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#2775CA] hover:underline"
              >
                Get testnet USDC
              </a>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] font-semibold text-ink/40">Chain ID</div>
                <div className="font-mono text-sm font-bold text-ink">{arc.chainId ?? '5042002'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-ink/40">Latest block</div>
                <div className="font-mono text-sm font-bold text-ink">
                  {arc.blockNumber ? `#${arc.blockNumber}` : 'n/a'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-ink/40">Gas token</div>
                <div className="text-sm font-bold text-[#2775CA]">{arc.gasToken}</div>
              </div>
            </div>
          </div>
        )}

        {/* Coin balances for this chain */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {wallet.coins.map((coin) => (
            <div key={coin.symbol} className="rounded-xl border border-ink/8 bg-cream/50 p-3">
              <div
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white"
                style={{ background: coin.color }}
              >
                {coin.symbol[0]}
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight" style={{ color: coin.color }}>
                {coin.balance.toFixed(2)}
              </div>
              <div className="text-xs font-semibold text-ink/50">{coin.symbol}</div>
              {coin.balance === 0 && (
                <div className="mt-1 text-[10px] text-ink/30">Not funded</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fund modal */}
      {showFund && <FundModal onClose={() => setShowFund(false)} currentChain={activeChain} />}

      {/* Recent transactions */}
      <h3 className="mt-8 font-semibold">Recent transactions</h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {TXS.map((tx) => (
          <li key={tx.id} className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
              style={{ background: tx.type === 'in' ? '#1AAB7A' : '#7342E2' }}
            >
              {tx.type === 'in' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">
                {tx.type === 'in' ? tx.from : tx.to}
              </div>
              <div className="flex items-center gap-2 text-xs text-ink/45">
                <span>{tx.label}</span>
                <span
                  className="rounded-full px-1.5 py-0.5 font-semibold capitalize"
                  style={{
                    background: CHAINS.find((c) => c.id === tx.chain)?.color + '20',
                    color: CHAINS.find((c) => c.id === tx.chain)?.color,
                  }}
                >
                  {tx.chain}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${tx.type === 'in' ? 'text-emerald-600' : 'text-ink'}`}>
                {tx.type === 'in' ? '+' : '-'}
                {tx.amount < 0.01 ? tx.amount.toFixed(4) : tx.amount.toFixed(2)}{' '}
                <span className="text-xs font-semibold" style={{ color: tx.coinColor }}>
                  {tx.coin}
                </span>
              </div>
              <div className="text-[11px] text-ink/40">{tx.when}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FundModal({ onClose, currentChain }: { onClose: () => void; currentChain: string }) {
  const [amount, setAmount] = useState('')
  const [coin, setCoin] = useState('USDC')
  const [chain, setChain] = useState(currentChain)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white p-6 shadow-xl">
        <h3 className="font-semibold text-ink">Fund wallet</h3>
        <p className="mt-1 text-sm text-ink/55">
          Connect a Circle Agent Wallet (Arc) or set up a wallet on Base, Arbitrum, Stellar, or
          Algorand. This preview shows the flow only.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <select
            className="w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
            value={chain}
            onChange={(e) => setChain(e.target.value)}
          >
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.chainId ? ` (chainId ${c.chainId})` : c.caip2 ? ` (${c.caip2})` : ''}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
          >
            {(CHAINS.find((c) => c.id === chain)?.stablecoins ?? ['USDC']).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount (e.g. 50.00)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-cream/40 px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-ink/15 py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-accent py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Request (preview)
          </button>
        </div>
      </div>
    </div>
  )
}
