/**
 * Shared EVM ABIs, verbatim from the Arc integration. These are standard across every
 * EVM chain (ERC-721 identity, ERC-20 USDC, ERC-8183 commerce, ERC-8004 validation), so
 * they live here once and every EVM chain adapter reuses them.
 */

export const IDENTITY_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'register', stateMutability: 'nonpayable', inputs: [{ name: 'metadataURI', type: 'string' }], outputs: [{ type: 'uint256' }] },
  { type: 'event', name: 'Transfer', inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'tokenId', type: 'uint256', indexed: true },
  ] },
] as const

export const ERC20_ABI = [
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

export const COMMERCE_ABI = [
  { type: 'function', name: 'createJob', stateMutability: 'nonpayable', inputs: [
    { name: 'provider', type: 'address' },
    { name: 'evaluator', type: 'address' },
    { name: 'expiredAt', type: 'uint256' },
    { name: 'description', type: 'string' },
    { name: 'hook', type: 'address' },
  ], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'setBudget', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'amount', type: 'uint256' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'fund', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'submit', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'deliverable', type: 'bytes32' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'complete', stateMutability: 'nonpayable', inputs: [
    { name: 'jobId', type: 'uint256' }, { name: 'reason', type: 'bytes32' }, { name: 'optParams', type: 'bytes' },
  ], outputs: [] },
  { type: 'function', name: 'getJob', stateMutability: 'view', inputs: [{ name: 'jobId', type: 'uint256' }], outputs: [
    { type: 'tuple', components: [
      { name: 'id', type: 'uint256' }, { name: 'client', type: 'address' }, { name: 'provider', type: 'address' },
      { name: 'evaluator', type: 'address' }, { name: 'description', type: 'string' }, { name: 'budget', type: 'uint256' },
      { name: 'expiredAt', type: 'uint256' }, { name: 'status', type: 'uint8' }, { name: 'hook', type: 'address' },
    ] },
  ] },
  { type: 'event', name: 'JobCreated', inputs: [
    { name: 'jobId', type: 'uint256', indexed: true }, { name: 'client', type: 'address', indexed: true },
    { name: 'provider', type: 'address', indexed: true }, { name: 'evaluator', type: 'address', indexed: false },
    { name: 'expiredAt', type: 'uint256', indexed: false }, { name: 'hook', type: 'address', indexed: false },
  ] },
] as const

/** ERC-8183 job status enum → label. */
export const JOB_STATUS = ['Open', 'Funded', 'Submitted', 'Completed', 'Rejected', 'Expired'] as const

export const VALIDATION_ABI = [
  { type: 'function', name: 'validationRequest', stateMutability: 'nonpayable', inputs: [
    { name: 'validatorAddress', type: 'address' }, { name: 'agentId', type: 'uint256' },
    { name: 'requestURI', type: 'string' }, { name: 'requestHash', type: 'bytes32' },
  ], outputs: [] },
  { type: 'function', name: 'validationResponse', stateMutability: 'nonpayable', inputs: [
    { name: 'requestHash', type: 'bytes32' }, { name: 'response', type: 'uint8' },
    { name: 'responseURI', type: 'string' }, { name: 'responseHash', type: 'bytes32' }, { name: 'tag', type: 'string' },
  ], outputs: [] },
  { type: 'function', name: 'getValidationStatus', stateMutability: 'view', inputs: [{ name: 'requestHash', type: 'bytes32' }], outputs: [
    { name: 'validatorAddress', type: 'address' }, { name: 'agentId', type: 'uint256' }, { name: 'response', type: 'uint8' },
    { name: 'responseHash', type: 'bytes32' }, { name: 'tag', type: 'string' }, { name: 'lastUpdate', type: 'uint256' },
  ] },
  { type: 'function', name: 'getSummary', stateMutability: 'view', inputs: [
    { name: 'agentId', type: 'uint256' }, { name: 'validatorAddresses', type: 'address[]' }, { name: 'tag', type: 'string' },
  ], outputs: [{ name: 'count', type: 'uint64' }, { name: 'averageResponse', type: 'uint8' }] },
  { type: 'function', name: 'getAgentValidations', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: 'requestHashes', type: 'bytes32[]' }] },
] as const

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
export const ZERO_HASH = ('0x' + '0'.repeat(64)) as `0x${string}`
