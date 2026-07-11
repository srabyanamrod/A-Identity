/**
 * Real x402 pay-per-request rail.
 *
 * A resource server answers an unpaid request with HTTP 402 + machine-readable
 * payment requirements. The client pays real USDC on Arc and retries with the tx
 * hash in an `X-PAYMENT` header. The server VERIFIES the payment on-chain (a USDC
 * Transfer to `payTo` of at least the price, not previously spent) and only then
 * serves the resource. No mocks: the price is real USDC, the check reads the chain,
 * and spent tx hashes are rejected (replay protection).
 */
import { randomBytes } from 'node:crypto'
import { CONTRACTS, ARC_RPC, ARC_EXPLORER } from './arc-contracts.js'
import { loadSpentPayments, persistSpentPayment } from './storage.js'

/** Price per call: 0.001 USDC (6 decimals). A true sub-cent nanopayment. */
const PRICE = 1000n

/** The single resource this rail sells. A redeemed payment is bound to this id. */
export const X402_RESOURCE = '/api/x402/data'

// ── request binding: a redeemed payment must answer a fresh server challenge ──────
//
// A bare "USDC Transfer to payTo of >= price" is not, on its own, bound to THIS
// request: a client could present an unrelated transfer. We bind the redemption to
// a server-issued, single-use, short-lived `nonce` for a named `resource`. The
// client must first GET the 402 (which mints the nonce), then pay, then redeem with
// that nonce — so a stockpiled/unrelated payment can't blind-unlock the resource.
// In-memory + TTL: correct for the single backend instance we deploy; a horizontally
// scaled deploy would move this to shared storage (see the SIWE/KYA nonce note).
const NONCE_TTL_MS = 15 * 60 * 1000
const issuedNonces = new Map<string, { resource: string; exp: number }>()

function pruneNonces(now: number) {
  for (const [n, v] of issuedNonces) if (v.exp <= now) issuedNonces.delete(n)
}

/** Mint a fresh single-use nonce bound to `resource`, returned in the 402 challenge. */
export function issueX402Nonce(resource: string = X402_RESOURCE): string {
  const now = Date.now()
  pruneNonces(now)
  const nonce = randomBytes(16).toString('hex')
  issuedNonces.set(nonce, { resource, exp: now + NONCE_TTL_MS })
  return nonce
}

/** True if `nonce` is a live, unconsumed challenge for `resource`. Does NOT consume it
 *  (the payment may still be confirming, so the client retries with the same nonce). */
export function x402NonceValid(nonce: string | undefined, resource: string = X402_RESOURCE): boolean {
  if (!nonce) return false
  const now = Date.now()
  pruneNonces(now)
  const v = issuedNonces.get(nonce)
  return !!v && v.exp > now && v.resource === resource
}

/** Consume a nonce so a single challenge unlocks the resource exactly once. */
export function consumeX402Nonce(nonce: string): void {
  issuedNonces.delete(nonce)
}

/** Spent payment tx hashes — a payment can unlock the resource exactly once. Backed
 *  by durable storage (Postgres/JSON) so a restart can't reset replay protection. */
const spent = new Set<string>()

/** Hydrate the in-memory set from durable storage exactly once, before the first check. */
let hydrated: Promise<void> | null = null
function ensureHydrated(): Promise<void> {
  if (!hydrated) {
    hydrated = loadSpentPayments()
      .then((hashes) => hashes.forEach((h) => spent.add(h.toLowerCase())))
      .catch((e) => console.error('[x402] hydrate spent set failed:', e instanceof Error ? e.message : e))
  }
  return hydrated
}

const TRANSFER_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const

async function publicClient() {
  const { createPublicClient, http } = await import('viem')
  return createPublicClient({ transport: http(ARC_RPC, { timeout: 8000, retryCount: 1 }) })
}

/** The seller's receiving address: the configured payTo, else the signer address. */
export async function x402PayTo(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (env.X402_PAY_TO && /^0x[0-9a-fA-F]{40}$/.test(env.X402_PAY_TO)) return env.X402_PAY_TO.toLowerCase()
  const key = env.ARC_SIGNER_KEY
  if (!key) return null
  const { privateKeyToAccount } = await import('viem/accounts')
  return privateKeyToAccount(key as `0x${string}`).address.toLowerCase()
}

/** The 402 body: what to pay, to whom, on which asset/network, and the single-use
 *  `nonce` that binds a later redemption to this challenge (echo it in X-Payment-Nonce). */
export function paymentRequirements(payTo: string, nonce?: string) {
  return {
    x402Version: 1,
    error: 'payment required',
    nonce,
    accepts: [
      {
        scheme: 'exact',
        network: 'arc-testnet',
        asset: CONTRACTS.usdc,
        assetSymbol: 'USDC',
        decimals: 6,
        maxAmountRequired: PRICE.toString(),
        payTo,
        resource: X402_RESOURCE,
        nonce,
        description: 'Premium: live Arc chain data, settled per request in USDC',
      },
    ],
  }
}

/** Verify a payment tx: a real USDC Transfer to payTo of >= PRICE, not already spent. */
export async function verifyPayment(
  txHash: string,
  payTo: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, reason: 'invalid tx hash' }
  await ensureHydrated()
  const key = txHash.toLowerCase()
  if (spent.has(key)) return { ok: false, reason: 'payment already used' }
  try {
    const client = await publicClient()
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` })
    if (receipt.status !== 'success') return { ok: false, reason: 'payment tx did not succeed' }
    const { parseEventLogs } = await import('viem')
    const transfers = parseEventLogs({ abi: TRANSFER_ABI, eventName: 'Transfer', logs: receipt.logs })
    const paid = transfers.find(
      (l) =>
        (l.address as string).toLowerCase() === CONTRACTS.usdc.toLowerCase() &&
        (l.args as { to: string }).to.toLowerCase() === payTo &&
        (l.args as { value: bigint }).value >= PRICE,
    )
    if (!paid) return { ok: false, reason: `no USDC payment of >= ${PRICE} to ${payTo} in this tx` }
    spent.add(key)
    await persistSpentPayment(key) // durable: survives restarts so the payment can't be replayed
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'verification error' }
  }
}

/** The real resource served after payment: live Arc chain data. */
export async function premiumResource(txHash: string) {
  let arcBlock: string | null = null
  try {
    arcBlock = (await (await publicClient()).getBlockNumber()).toString()
  } catch {
    /* RPC hiccup — still return the paid receipt */
  }
  return {
    paid: true,
    tx: txHash,
    explorerUrl: `${ARC_EXPLORER}/tx/${txHash}`,
    resource: { title: 'Live Arc chain data', arcBlock, chainId: 5042002, servedAt: new Date().toISOString() },
  }
}
