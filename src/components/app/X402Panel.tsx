import { useState } from 'react'
import { encodeFunctionData } from 'viem'
import { CheckCircle2, ExternalLink, Lock, Zap } from 'lucide-react'

import { MCP_BASE } from '../../lib/mcpBase'
import { getActiveInjectedProvider } from '../../lib/wallets'

const ERC20_TRANSFER = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

type Accepts = {
  asset: string
  assetSymbol: string
  decimals: number
  maxAmountRequired: string
  payTo: string
  description: string
}
type Resource = {
  paid: boolean
  tx: string
  explorerUrl: string
  resource: { title: string; arcBlock: string | null; chainId: number; servedAt: string }
}

type Phase = 'idle' | 'quoting' | 'paying' | 'verifying' | 'done' | 'error'

export default function X402Panel() {
  const [req, setReq] = useState<Accepts | null>(null)
  const [resource, setResource] = useState<Resource | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)

  const priceUsdc = req ? Number(req.maxAmountRequired) / 10 ** req.decimals : 0.001

  const call = async () => {
    setError(null)
    setResource(null)
    setTx(null)
    try {
      // 1. Unpaid request -> expect 402 with payment requirements.
      setPhase('quoting')
      const quote = await fetch(`${MCP_BASE}/api/x402/data`)
      if (quote.status === 501) throw new Error('x402 is not configured on the server.')
      if (quote.status !== 402) throw new Error(`Unexpected response: HTTP ${quote.status}`)
      const reqs = (await quote.json()) as { accepts: Accepts[] }
      const accepts = reqs.accepts?.[0]
      if (!accepts) throw new Error('No payment requirements returned.')
      setReq(accepts)

      // 2. Pay the required USDC on Arc from the connected wallet (same EIP-6963
      //    discovery the rest of the app uses, not a raw window.ethereum grab).
      const eth = getActiveInjectedProvider()
      if (!eth) throw new Error('No wallet found. Connect a browser wallet to pay.')
      setPhase('paying')
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      const from = accounts?.[0]
      if (!from) throw new Error('No account selected.')
      const data = encodeFunctionData({
        abi: ERC20_TRANSFER,
        functionName: 'transfer',
        args: [accepts.payTo as `0x${string}`, BigInt(accepts.maxAmountRequired)],
      })
      const txHash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: accepts.asset, data }],
      })) as string
      setTx(txHash)

      // 3. Retry with the payment proof until the server verifies it on-chain.
      setPhase('verifying')
      let paid: Resource | null = null
      for (let i = 0; i < 20; i++) {
        const pr = await fetch(`${MCP_BASE}/api/x402/data`, { headers: { 'X-Payment': txHash } })
        if (pr.status === 200) {
          paid = (await pr.json()) as Resource
          break
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      if (!paid) throw new Error('Payment not verified yet. Give it a moment and try again.')
      setResource(paid)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'x402 call failed')
      setPhase('error')
    }
  }

  const busy = phase === 'quoting' || phase === 'paying' || phase === 'verifying'
  const label =
    phase === 'quoting'
      ? 'Getting quote...'
      : phase === 'paying'
        ? 'Confirm in your wallet...'
        : phase === 'verifying'
          ? 'Verifying payment on Arc...'
          : `Pay ${priceUsdc} USDC & call`

  return (
    <section className="mt-8 rounded-2xl border border-[#7342E2]/20 bg-[#7342E2]/[0.04] p-6">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#7342E2] text-white">
          <Zap size={15} />
        </div>
        <div>
          <h3 className="font-semibold text-ink">x402 — pay-per-call API</h3>
          <p className="text-xs text-ink/55">
            A real HTTP 402 rail: the server asks for payment, you pay USDC on Arc, it verifies
            on-chain and serves. One payment unlocks one call.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={call}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-[#7342E2] px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          <Lock size={14} />
          {label}
        </button>
        {req && phase !== 'done' && (
          <span className="text-xs text-ink/50">
            {priceUsdc} USDC to {req.payTo.slice(0, 8)}...{req.payTo.slice(-4)}
          </span>
        )}
      </div>

      {tx && phase === 'verifying' && (
        <p className="mt-2 font-mono text-xs text-ink/45">paid tx {tx.slice(0, 12)}... — verifying on Arc</p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {resource && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={15} /> Unlocked — paid per request
          </div>
          <div className="mt-2 grid gap-1 text-xs text-ink/70">
            <div>
              <span className="text-ink/45">Resource:</span> {resource.resource.title}
            </div>
            <div>
              <span className="text-ink/45">Live Arc block:</span> #{resource.resource.arcBlock ?? 'n/a'}
            </div>
            <a
              href={resource.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#2775CA] hover:underline"
            >
              View payment on arcscan <ExternalLink size={11} />
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
