import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAINS,
  getChain,
  requireChain,
  getChainById,
  getChainByEvmId,
  evmChains,
  liveChains,
  ARC_CHAIN,
} from './registry.js'
import { isValidCaip2, evmChainIdFromCaip2 } from './caip.js'

test('every descriptor has a valid, unique CAIP-2 id', () => {
  const seen = new Set<string>()
  for (const c of CHAINS) {
    assert.ok(isValidCaip2(c.caip2), `invalid caip2: ${c.caip2}`)
    assert.ok(!seen.has(c.caip2), `duplicate caip2: ${c.caip2}`)
    seen.add(c.caip2)
  }
})

test('every id slug is unique', () => {
  const ids = CHAINS.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('EVM chains: caip2 reference matches evmChainId; non-EVM have null', () => {
  for (const c of CHAINS) {
    if (c.ecosystem === 'evm') {
      assert.equal(evmChainIdFromCaip2(c.caip2), c.evmChainId, `mismatch for ${c.id}`)
    } else {
      assert.equal(c.evmChainId, null, `${c.id} should have null evmChainId`)
    }
  }
})

test('lookups resolve the same descriptor by caip2, id, and evm id', () => {
  const arc = getChain('eip155:5042002')
  assert.ok(arc)
  assert.equal(getChainById('arc'), arc)
  assert.equal(getChainByEvmId(5042002), arc)
  assert.equal(requireChain('eip155:5042002'), arc)
})

test('requireChain throws on unknown chain', () => {
  assert.throws(() => requireChain('eip155:999999999'))
})

test('getChain returns undefined for unknown chain', () => {
  assert.equal(getChain('eip155:999999999'), undefined)
})

test('Arc is the one live chain and carries all its known contracts', () => {
  const live = liveChains()
  assert.equal(live.length, 1)
  assert.equal(live[0].id, 'arc')
  assert.equal(ARC_CHAIN.id, 'arc')
  // Guard the exact live Arc addresses against silent drift.
  assert.equal(ARC_CHAIN.contracts.identityRegistry, '0x8004A818BFB912233c491871b3d84c89A494BD9e')
  assert.equal(ARC_CHAIN.contracts.reputationRegistry, '0x8004B663056A597Dffe9eCcC1965A193B7388713')
  assert.equal(ARC_CHAIN.contracts.validationRegistry, '0x8004Cb1BF31DAf7788923b405b754f57acEB4272')
  assert.equal(ARC_CHAIN.contracts.agenticCommerce, '0x0747EEf0706327138c69792bF28Cd525089e4583')
  assert.equal(ARC_CHAIN.contracts.usdc, '0x3600000000000000000000000000000000000000')
  assert.equal(ARC_CHAIN.evmChainId, 5042002)
  assert.equal(ARC_CHAIN.usdcDecimals, 6)
  assert.equal(ARC_CHAIN.explorer, 'https://testnet.arcscan.app')
  assert.equal(ARC_CHAIN.rpcUrls[0], 'https://rpc.testnet.arc.network')
  assert.equal(ARC_CHAIN.signerEnvVar, 'ARC_SIGNER_KEY')
})

test('the six next chains are present and planned', () => {
  for (const id of ['base', 'arbitrum', 'avalanche', 'xlayer', 'stellar', 'solana']) {
    const c = getChainById(id)
    assert.ok(c, `${id} missing from registry`)
    assert.equal(c.status, 'planned', `${id} should be planned`)
  }
})

test('four of the next chains are EVM, two are non-EVM', () => {
  const planned = CHAINS.filter((c) => c.status === 'planned')
  assert.equal(planned.filter((c) => c.ecosystem === 'evm').length, 4)
  assert.equal(planned.filter((c) => c.ecosystem !== 'evm').length, 2)
})

test('evmChains includes Arc and the four planned EVM chains', () => {
  const ids = evmChains().map((c) => c.id).sort()
  assert.deepEqual(ids, ['arbitrum', 'arc', 'avalanche', 'base', 'xlayer'])
})
