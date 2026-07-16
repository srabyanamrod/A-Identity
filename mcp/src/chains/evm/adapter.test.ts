import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEvmAdapter } from './adapter.js'
import { resolveRpcUrls, usdcUnits, fromUsdcUnits, txUrl, addressUrl } from './client.js'
import { ARC_CHAIN, getChainById } from '../registry.js'

// An env with no signer key — forces the prepared/no-key path deterministically,
// independent of whatever is in the real process env.
const NO_SIGNER: NodeJS.ProcessEnv = {}

test('createEvmAdapter rejects a non-EVM chain', () => {
  const stellar = getChainById('stellar')!
  assert.throws(() => createEvmAdapter(stellar))
})

test('usdcUnits / fromUsdcUnits round-trip at 6 decimals (Arc)', () => {
  assert.equal(usdcUnits(ARC_CHAIN, 1.5), 1_500_000n)
  assert.equal(usdcUnits(ARC_CHAIN, 0.05), 50_000n)
  assert.equal(fromUsdcUnits(ARC_CHAIN, 1_500_000n), 1.5)
})

test('resolveRpcUrls puts the primary first and honors the override env var', () => {
  const def = resolveRpcUrls(ARC_CHAIN, {})
  assert.equal(def[0], 'https://rpc.testnet.arc.network')
  assert.equal(def.length, 4)
  // The override REPLACES the primary (rpcUrls[0]); the 3 fallbacks stay. Same as the
  // original ARC_RPCS computation, so the length stays 4 and the old primary is gone.
  const overridden = resolveRpcUrls(ARC_CHAIN, { ARC_RPC_URL: 'https://my.node' })
  assert.equal(overridden[0], 'https://my.node')
  assert.equal(overridden.length, 4)
  assert.ok(!overridden.includes('https://rpc.testnet.arc.network'))
})

test('explorer link helpers use the descriptor explorer', () => {
  assert.equal(txUrl(ARC_CHAIN, '0xabc'), 'https://testnet.arcscan.app/tx/0xabc')
  assert.equal(addressUrl(ARC_CHAIN, '0xdef'), 'https://testnet.arcscan.app/address/0xdef')
})

test('without a signer, registerAgent returns the exact prepared ERC-8004 call', async () => {
  const arc = createEvmAdapter(ARC_CHAIN)
  const res = await arc.registerAgent('https://example/agent.json', NO_SIGNER)
  assert.equal(res.executed, false)
  if (res.executed === false) {
    assert.equal(res.contract, '0x8004A818BFB912233c491871b3d84c89A494BD9e')
    assert.equal(res.function, 'register(string metadataURI)')
    assert.deepEqual(res.args, ['https://example/agent.json'])
  }
})

test('without a signer, payUsdc returns the exact prepared USDC transfer (6 decimals)', async () => {
  const arc = createEvmAdapter(ARC_CHAIN)
  const res = await arc.payUsdc('0x1111111111111111111111111111111111111111', 2.5, NO_SIGNER)
  assert.equal(res.executed, false)
  if (res.executed === false) {
    assert.equal(res.contract, '0x3600000000000000000000000000000000000000')
    assert.equal(res.function, 'transfer(address to, uint256 amount)')
    assert.deepEqual(res.args, ['0x1111111111111111111111111111111111111111', '2500000'])
  }
})

test('without a signer, deployVault reports no-key (not reverted)', async () => {
  const arc = createEvmAdapter(ARC_CHAIN)
  const res = await arc.deployVault({ dailyCapUsd: 10, autoApproveUsd: 1 }, NO_SIGNER)
  assert.equal(res.executed, false)
  assert.equal(res.reverted, false)
})

test('without a signer, policyPay reports no-key (not reverted)', async () => {
  const arc = createEvmAdapter(ARC_CHAIN)
  const res = await arc.policyPay('0x2222222222222222222222222222222222222222', '0x1111111111111111111111111111111111111111', 1, NO_SIGNER)
  assert.equal(res.executed, false)
  if (res.executed === false) assert.equal(res.reverted, false)
})

test('without a signer, runEscrowDemo returns the prepared lifecycle', async () => {
  const arc = createEvmAdapter(ARC_CHAIN)
  const res = await arc.runEscrowDemo({}, NO_SIGNER)
  assert.equal(res.executed, false)
  if (res.executed === false) {
    assert.equal(res.contract, '0x0747EEf0706327138c69792bF28Cd525089e4583')
    assert.deepEqual(res.lifecycle, ['createJob', 'setBudget', 'approve(USDC)', 'fund', 'submit', 'complete'])
  }
})

test('the adapter constructs for a planned EVM chain (Base)', () => {
  const base = getChainById('base')!
  const adapter = createEvmAdapter(base)
  assert.equal(adapter.chain.id, 'base')
})
