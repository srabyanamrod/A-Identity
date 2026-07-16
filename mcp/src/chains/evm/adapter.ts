/**
 * Generic EVM chain adapter. `createEvmAdapter(descriptor)` returns the full set of
 * on-chain operations — identity register, ERC-8183 escrow, USDC settlement, the
 * AgentSpendPolicy vault, and ERC-8004 KYA attestation — parameterized entirely by the
 * chain descriptor. A new EVM chain gets ALL of this by adding one descriptor to the
 * registry; there is no per-chain logic to copy.
 *
 * This is the faithful, parameterized extraction of the original Arc integration:
 * reads run keyless; writes are gated behind the chain's signer env var and stay
 * human-on-the-loop (prepared-or-executed). Behavior for the Arc descriptor is
 * identical to the original arc-contracts.ts. See ../../../MULTICHAIN-STRATEGY.md.
 */
import type { ChainDescriptor } from '../types.js'
import type {
  Prepared,
  Executed,
  VaultDeployed,
  VaultNoKey,
  VaultResult,
  ValidationExecuted,
} from '../types.js'
import {
  evmPublicClient,
  evmWalletClient,
  revertReason,
  usdcUnits,
  fromUsdcUnits,
  txUrl,
  addressUrl,
} from './client.js'
import { IDENTITY_ABI, ERC20_ABI, COMMERCE_ABI, VALIDATION_ABI, JOB_STATUS, ZERO_ADDRESS, ZERO_HASH } from './abis.js'
import { AgentSpendPolicyAbi, AgentSpendPolicyBytecode } from '../../contracts/AgentSpendPolicy.js'

type Hex = `0x${string}`

export function createEvmAdapter(chain: ChainDescriptor) {
  if (chain.ecosystem !== 'evm') {
    throw new Error(`createEvmAdapter: ${chain.id} is not an EVM chain (${chain.ecosystem})`)
  }

  const NO_KEY = `No ${chain.signerEnvVar ?? 'signer'} set. Fund a wallet and export the key to broadcast on-chain.`
  const tx = (h: string) => txUrl(chain, h)
  const c = chain.contracts
  // For the live app these are all defined; cast for viem's `0x${string}` address type.
  const identityRegistry = c.identityRegistry as Hex
  const validationRegistry = c.validationRegistry as Hex
  const agenticCommerce = c.agenticCommerce as Hex
  const usdc = c.usdc as Hex

  const publicClient = (env: NodeJS.ProcessEnv) => evmPublicClient(chain, env)
  const walletClient = (env: NodeJS.ProcessEnv) => evmWalletClient(chain, env)

  // ── live reads (no key) ────────────────────────────────────────────────────────
  async function readContracts() {
    const out = {
      network: chain.testnet ? `${chain.id}-testnet` : chain.id,
      chainId: chain.evmChainId,
      contracts: chain.contracts,
      explorer: chain.explorer,
      identity: {} as Record<string, unknown>,
      usdc: {} as Record<string, unknown>,
      reachable: false,
      checkedAt: new Date().toISOString(),
    }
    try {
      const client = await publicClient(process.env)
      // This registry is not enumerable (totalSupply reverts) and token ids are
      // non-sequential, so we don't report a registered-agents count from the
      // contract — better to omit it than to surface a silently-null field.
      if (identityRegistry) {
        const [name, symbol] = await Promise.allSettled([
          client.readContract({ address: identityRegistry, abi: IDENTITY_ABI, functionName: 'name' }),
          client.readContract({ address: identityRegistry, abi: IDENTITY_ABI, functionName: 'symbol' }),
        ])
        out.identity = {
          address: identityRegistry,
          name: name.status === 'fulfilled' ? name.value : null,
          symbol: symbol.status === 'fulfilled' ? symbol.value : null,
        }
      }
      if (usdc) {
        const [usym, udec] = await Promise.allSettled([
          client.readContract({ address: usdc, abi: ERC20_ABI, functionName: 'symbol' }),
          client.readContract({ address: usdc, abi: ERC20_ABI, functionName: 'decimals' }),
        ])
        out.usdc = {
          address: usdc,
          symbol: usym.status === 'fulfilled' ? usym.value : 'USDC',
          decimals: udec.status === 'fulfilled' ? (udec.value as number) : null,
        }
      }
      out.reachable = true
      return out
    } catch (err) {
      return { ...out, note: err instanceof Error ? err.message : String(err) }
    }
  }

  // ── writes (env-gated, human-on-the-loop) ──────────────────────────────────────
  async function registerAgent(metadataUri: string, env: NodeJS.ProcessEnv = process.env): Promise<Prepared | Executed> {
    const signer = await walletClient(env)
    if (!signer) {
      return {
        executed: false,
        contract: identityRegistry,
        function: 'register(string metadataURI)',
        args: [metadataUri],
        reason:
          `No ${chain.signerEnvVar ?? 'signer'} set. Fund a wallet at ${chain.faucet ?? 'the chain faucet'} and export ${chain.signerEnvVar ?? 'the key'} to broadcast this for real. This is the exact call that will be made.`,
      }
    }
    const { parseEventLogs } = await import('viem')
    const client = await publicClient(env)
    const hash = await signer.client.writeContract({
      address: identityRegistry,
      abi: IDENTITY_ABI,
      functionName: 'register',
      args: [metadataUri],
    })
    const receipt = await client.waitForTransactionReceipt({ hash })
    const logs = parseEventLogs({ abi: IDENTITY_ABI, eventName: 'Transfer', logs: receipt.logs })
    const agentId = logs[0] ? (logs[0].args as { tokenId: bigint }).tokenId.toString() : undefined
    return { executed: true, txHash: hash, explorerUrl: tx(hash), agentId }
  }

  async function createJob(
    input: { provider: string; evaluator: string; description: string; expiresInHours?: number },
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<Prepared | Executed> {
    const expiredAt = BigInt(Math.floor(Date.now() / 1000) + (input.expiresInHours ?? 24) * 3600)
    const args = [input.provider, input.evaluator, expiredAt, input.description, ZERO_ADDRESS]
    const signer = await walletClient(env)
    if (!signer) {
      return {
        executed: false,
        contract: agenticCommerce,
        function: 'createJob(address provider, address evaluator, uint256 expiredAt, string description, address hook)',
        args: args.map((a) => (typeof a === 'bigint' ? a.toString() : a)),
        reason:
          `No ${chain.signerEnvVar ?? 'signer'} set. This is the exact ERC-8183 createJob call. Fund a wallet and export the key to broadcast.`,
      }
    }
    const client = await publicClient(env)
    const hash = await signer.client.writeContract({
      address: agenticCommerce,
      abi: COMMERCE_ABI,
      functionName: 'createJob',
      args: args as never,
    })
    await client.waitForTransactionReceipt({ hash })
    return { executed: true, txHash: hash, explorerUrl: tx(hash) }
  }

  async function runEscrowDemo(
    input: { budgetUsd?: number; description?: string } = {},
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<
    | { executed: false; reason: string; contract: string; lifecycle: string[] }
    | {
        executed: true
        jobId: string
        budgetUsd: number
        steps: { step: string; txHash: string; explorerUrl: string }[]
        status: string
        failedAt?: string
        reason?: string
      }
  > {
    const budgetUsd = input.budgetUsd ?? 0.05
    const description =
      input.description ??
      'A-Identity ERC-8183 escrow demo: an agent hires an agent, USDC is held in escrow, released on delivery.'
    const lifecycle = ['createJob', 'setBudget', 'approve(USDC)', 'fund', 'submit', 'complete']
    const signer = await walletClient(env)
    if (!signer) {
      return {
        executed: false,
        reason: `No ${chain.signerEnvVar ?? 'signer'} set. With a funded key this broadcasts the full ERC-8183 escrow lifecycle (6 real txs).`,
        contract: agenticCommerce,
        lifecycle,
      }
    }
    const { keccak256, toHex, parseEventLogs } = await import('viem')
    const client = await publicClient(env)
    const me = signer.account.address
    const budget = usdcUnits(chain, budgetUsd)
    const zero = ZERO_ADDRESS
    const empty = '0x' as const
    const steps: { step: string; txHash: string; explorerUrl: string }[] = []
    const record = async (step: string, hash: Hex) => {
      await client.waitForTransactionReceipt({ hash })
      steps.push({ step, txHash: hash, explorerUrl: tx(hash) })
    }

    try {
      const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600)
      const createHash = await signer.client.writeContract({
        address: agenticCommerce, abi: COMMERCE_ABI, functionName: 'createJob',
        args: [me, me, expiredAt, description, zero],
      })
      const receipt = await client.waitForTransactionReceipt({ hash: createHash })
      steps.push({ step: 'createJob', txHash: createHash, explorerUrl: tx(createHash) })
      const logs = parseEventLogs({ abi: COMMERCE_ABI, eventName: 'JobCreated', logs: receipt.logs })
      const jobId = (logs[0]?.args as { jobId?: bigint })?.jobId
      if (jobId === undefined)
        return { executed: true, jobId: '?', budgetUsd, steps, status: 'Unknown', failedAt: 'createJob', reason: 'could not parse jobId from JobCreated' }

      await record('setBudget', await signer.client.writeContract({ address: agenticCommerce, abi: COMMERCE_ABI, functionName: 'setBudget', args: [jobId, budget, empty] }))
      await record('approve(USDC)', await signer.client.writeContract({ address: usdc, abi: ERC20_ABI, functionName: 'approve', args: [agenticCommerce, budget] }))
      await record('fund', await signer.client.writeContract({ address: agenticCommerce, abi: COMMERCE_ABI, functionName: 'fund', args: [jobId, empty] }))
      await record('submit', await signer.client.writeContract({ address: agenticCommerce, abi: COMMERCE_ABI, functionName: 'submit', args: [jobId, keccak256(toHex(`a-identity:deliverable:${jobId}`)), empty] }))
      await record('complete', await signer.client.writeContract({ address: agenticCommerce, abi: COMMERCE_ABI, functionName: 'complete', args: [jobId, keccak256(toHex(`a-identity:approved:${jobId}`)), empty] }))

      const job = (await client.readContract({ address: agenticCommerce, abi: COMMERCE_ABI, functionName: 'getJob', args: [jobId] })) as { status: number }
      return { executed: true, jobId: jobId.toString(), budgetUsd, steps, status: JOB_STATUS[Number(job.status)] ?? String(job.status) }
    } catch (err) {
      return { executed: true, jobId: steps.length ? '(partial)' : '?', budgetUsd, steps, status: 'Reverted', failedAt: lifecycle[steps.length] ?? '?', reason: await revertReason(err) }
    }
  }

  async function payUsdc(to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env): Promise<Prepared | Executed> {
    const amount = usdcUnits(chain, amountUsd)
    const signer = await walletClient(env)
    if (!signer) {
      return {
        executed: false,
        contract: usdc,
        function: 'transfer(address to, uint256 amount)',
        args: [to, amount.toString()],
        reason: `No ${chain.signerEnvVar ?? 'signer'} set. Fund a wallet and export the key to move real USDC.`,
      }
    }
    const client = await publicClient(env)
    const hash = await signer.client.writeContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to as Hex, amount],
    })
    await client.waitForTransactionReceipt({ hash })
    return { executed: true, txHash: hash, explorerUrl: tx(hash) }
  }

  // ── on-chain spend policy vault (AgentSpendPolicy) ──────────────────────────────
  async function deployVault(
    input: { owner?: string; operator?: string; dailyCapUsd: number; autoApproveUsd: number },
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<VaultDeployed | VaultNoKey> {
    const signer = await walletClient(env)
    if (!signer) return { executed: false, reverted: false, reason: NO_KEY }
    const owner = (input.owner ?? signer.account.address) as Hex
    const operator = (input.operator ?? signer.account.address) as Hex
    const client = await publicClient(env)
    const hash = await signer.client.deployContract({
      abi: AgentSpendPolicyAbi,
      bytecode: AgentSpendPolicyBytecode,
      args: [owner, operator, usdc, usdcUnits(chain, input.dailyCapUsd), usdcUnits(chain, input.autoApproveUsd)],
    })
    const receipt = await client.waitForTransactionReceipt({ hash })
    return { executed: true, vault: receipt.contractAddress as string, owner, operator, txHash: hash, explorerUrl: tx(hash) }
  }

  async function vaultWrite(vault: string, functionName: string, args: readonly unknown[], env: NodeJS.ProcessEnv): Promise<VaultResult> {
    const signer = await walletClient(env)
    if (!signer) return { executed: false, reverted: false, reason: NO_KEY }
    const client = await publicClient(env)
    try {
      const { request } = await client.simulateContract({
        address: vault as Hex,
        abi: AgentSpendPolicyAbi,
        functionName: functionName as never,
        args: args as never,
        account: signer.account,
      })
      const hash = await signer.client.writeContract(request as never)
      await client.waitForTransactionReceipt({ hash })
      return { executed: true, txHash: hash, explorerUrl: tx(hash) }
    } catch (err) {
      return { executed: false, reverted: true, reason: await revertReason(err) }
    }
  }

  const policyPay = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
    vaultWrite(vault, 'pay', [to as Hex, usdcUnits(chain, amountUsd)], env)
  const policyOwnerPay = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
    vaultWrite(vault, 'ownerPay', [to as Hex, usdcUnits(chain, amountUsd)], env)
  const policySetPolicy = (
    vault: string,
    input: { dailyCapUsd: number; autoApproveUsd: number; allowlistEnabled: boolean },
    env: NodeJS.ProcessEnv = process.env,
  ) => vaultWrite(vault, 'setPolicy', [usdcUnits(chain, input.dailyCapUsd), usdcUnits(chain, input.autoApproveUsd), input.allowlistEnabled], env)
  const policySetFrozen = (vault: string, frozen: boolean, env: NodeJS.ProcessEnv = process.env) =>
    vaultWrite(vault, 'setFrozen', [frozen], env)
  const policySetAllowed = (vault: string, payee: string, ok: boolean, env: NodeJS.ProcessEnv = process.env) =>
    vaultWrite(vault, 'setAllowed', [payee as Hex, ok], env)
  const policyWithdraw = (vault: string, to: string, amountUsd: number, env: NodeJS.ProcessEnv = process.env) =>
    vaultWrite(vault, 'withdraw', [to as Hex, usdcUnits(chain, amountUsd)], env)

  async function readVault(vault: string) {
    const client = await publicClient(process.env)
    const read = (functionName: string, args: readonly unknown[] = []) =>
      client.readContract({ address: vault as Hex, abi: AgentSpendPolicyAbi, functionName: functionName as never, args: args as never })
    const [owner, operator, dailyCap, autoApproveMax, frozen, allowlistEnabled, spentToday, balance] = await Promise.all([
      read('owner'), read('operator'), read('dailyCap'), read('autoApproveMax'),
      read('frozen'), read('allowlistEnabled'), read('spentToday'), read('balance'),
    ])
    return {
      vault,
      owner: owner as string,
      operator: operator as string,
      dailyCapUsd: fromUsdcUnits(chain, dailyCap as bigint),
      autoApproveUsd: fromUsdcUnits(chain, autoApproveMax as bigint),
      frozen: frozen as boolean,
      allowlistEnabled: allowlistEnabled as boolean,
      spentTodayUsd: fromUsdcUnits(chain, spentToday as bigint),
      balanceUsd: fromUsdcUnits(chain, balance as bigint),
      explorer: addressUrl(chain, vault),
    }
  }

  // ── KYA attestation: ERC-8004 ValidationRegistry ────────────────────────────────
  async function recordValidation(agentId: bigint, requestUri: string, env: NodeJS.ProcessEnv = process.env): Promise<Prepared | ValidationExecuted> {
    const { keccak256, toHex } = await import('viem')
    const requestHash = keccak256(toHex(`kya:${agentId.toString()}:${requestUri}:${Date.now()}`))
    const signer = await walletClient(env)
    if (!signer) {
      return {
        executed: false,
        contract: validationRegistry,
        function: 'validationRequest(address,uint256,string,bytes32) + validationResponse(bytes32,uint8,string,bytes32,string)',
        args: [agentId.toString(), requestUri, requestHash],
        reason: `No ${chain.signerEnvVar ?? 'signer'} set. This opens + answers an ERC-8004 validation (response=100, tag "kya") for the agent.`,
      }
    }
    const client = await publicClient(env)
    const validator = signer.account.address
    const reqTx = await signer.client.writeContract({
      address: validationRegistry, abi: VALIDATION_ABI, functionName: 'validationRequest',
      args: [validator, agentId, requestUri, requestHash],
    })
    await client.waitForTransactionReceipt({ hash: reqTx })
    const respTx = await signer.client.writeContract({
      address: validationRegistry, abi: VALIDATION_ABI, functionName: 'validationResponse',
      args: [requestHash, 100, requestUri, ZERO_HASH, 'kya'],
    })
    await client.waitForTransactionReceipt({ hash: respTx })
    return { executed: true, txHash: respTx, explorerUrl: tx(respTx), requestHash }
  }

  async function readValidation(agentId: bigint, env: NodeJS.ProcessEnv = process.env) {
    const client = await publicClient(env)
    try {
      const validator = (await walletClient(env))?.account.address
      const hashes = (await client.readContract({
        address: validationRegistry, abi: VALIDATION_ABI, functionName: 'getAgentValidations', args: [agentId],
      })) as readonly string[]
      let kyaCount = 0
      let kyaAverage = 0
      if (validator) {
        const summary = (await client.readContract({
          address: validationRegistry, abi: VALIDATION_ABI, functionName: 'getSummary',
          args: [agentId, [validator as Hex], 'kya'],
        })) as readonly [bigint, number]
        kyaCount = Number(summary[0])
        kyaAverage = Number(summary[1])
      }
      return {
        agentId: agentId.toString(),
        validations: hashes.length,
        kyaCount,
        kyaAverage,
        registry: validationRegistry,
        explorer: addressUrl(chain, validationRegistry),
      }
    } catch (e) {
      return { agentId: agentId.toString(), error: e instanceof Error ? e.message : String(e) }
    }
  }

  return {
    chain,
    readContracts,
    registerAgent,
    createJob,
    runEscrowDemo,
    payUsdc,
    deployVault,
    policyPay,
    policyOwnerPay,
    policySetPolicy,
    policySetFrozen,
    policySetAllowed,
    policyWithdraw,
    readVault,
    recordValidation,
    readValidation,
  }
}

export type EvmAdapter = ReturnType<typeof createEvmAdapter>
