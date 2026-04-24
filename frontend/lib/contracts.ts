// Deployed on Arc Testnet (Chain ID 5042002)
export const VAULT_ADDRESS = (
  process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
  '0x5e1ac795fEF51F6F261890Bb4d0119aD1f097D21'
) as `0x${string}`

export const PERP_ENGINE_ADDRESS = (
  process.env.NEXT_PUBLIC_PERP_ENGINE_ADDRESS ||
  '0xfdebeD9FAE7Cbd73E4E45EEA18DE4e4fad45A2e9'
) as `0x${string}`

export const ORACLE_ADDRESS = (
  process.env.NEXT_PUBLIC_ORACLE_ADDRESS ||
  '0x577dE275F2Bbe090E104422e931e5e74B680AB81'
) as `0x${string}`

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as `0x${string}`

// ─── ArcanaVault ABI ───────────────────────────────────────────────────────────
export const VAULT_ABI = [
  // ERC-4626 / ERC-20
  {
    type: 'function',
    name: 'asset',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAssets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertToAssets',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'convertToShares',
    inputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewDeposit',
    inputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'previewRedeem',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'shares', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Withdrawal
  {
    type: 'function',
    name: 'requestWithdraw',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeWithdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pendingWithdrawShares',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'withdrawalRequestedAt',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Strategy
  {
    type: 'function',
    name: 'activeStrategy',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'enum ArcanaStrategy.StrategyType' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setStrategy',
    inputs: [
      {
        name: 'newStrategy',
        type: 'uint8',
        internalType: 'enum ArcanaStrategy.StrategyType',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // State
  {
    type: 'function',
    name: 'hermesAgent',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalTradesExecuted',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lastHermesCycle',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPrivate',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'perpEngine',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract ArcanaPerpEngine' }],
    stateMutability: 'view',
  },
  // HERMES trade execution
  {
    type: 'function',
    name: 'executeOpen',
    inputs: [
      { name: 'market', type: 'bytes32', internalType: 'bytes32' },
      { name: 'isLong', type: 'bool', internalType: 'bool' },
      { name: 'collateralAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'leverage', type: 'uint8', internalType: 'uint8' },
    ],
    outputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeClose',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'pnl', type: 'int256', internalType: 'int256' }],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'StrategyChanged',
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      {
        name: 'from',
        type: 'uint8',
        indexed: false,
        internalType: 'enum ArcanaStrategy.StrategyType',
      },
      {
        name: 'to',
        type: 'uint8',
        indexed: false,
        internalType: 'enum ArcanaStrategy.StrategyType',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'HermesDecisionLogged',
    inputs: [
      { name: 'reasoning', type: 'string', indexed: false, internalType: 'string' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalRequested',
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'availableAt', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'WithdrawalCompleted',
    inputs: [
      { name: 'user', type: 'address', indexed: true, internalType: 'address' },
      { name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionExecuted',
    inputs: [
      { name: 'market', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'isLong', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'positionId', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'leverage', type: 'uint8', indexed: false, internalType: 'uint8' },
    ],
    anonymous: false,
  },
] as const

// ─── ArcanaPerpEngine ABI ──────────────────────────────────────────────────────
export const PERP_ENGINE_ABI = [
  {
    type: 'function',
    name: 'positions',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256', internalType: 'uint256' },
      { name: 'vault', type: 'address', internalType: 'address' },
      { name: 'market', type: 'bytes32', internalType: 'bytes32' },
      { name: 'isLong', type: 'bool', internalType: 'bool' },
      { name: 'size', type: 'uint256', internalType: 'uint256' },
      { name: 'entryPrice', type: 'uint256', internalType: 'uint256' },
      { name: 'leverage', type: 'uint8', internalType: 'uint8' },
      { name: 'collateral', type: 'uint256', internalType: 'uint256' },
      { name: 'openedAt', type: 'uint256', internalType: 'uint256' },
      { name: 'isOpen', type: 'bool', internalType: 'bool' },
      { name: 'fundingAccrued', type: 'int256', internalType: 'int256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVaultOpenPositions',
    inputs: [{ name: 'vault', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUnrealizedPnL',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'int256', internalType: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isLiquidatable',
    inputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextPositionId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vaultPositions',
    inputs: [
      { name: 'vault', type: 'address', internalType: 'address' },
      { name: 'index', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PositionOpened',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'vault', type: 'address', indexed: false, internalType: 'address' },
      { name: 'market', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'isLong', type: 'bool', indexed: false, internalType: 'bool' },
      { name: 'size', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'leverage', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'entryPrice', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionClosed',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'pnl', type: 'int256', indexed: false, internalType: 'int256' },
      { name: 'exitPrice', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionLiquidated',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'liquidator', type: 'address', indexed: false, internalType: 'address' },
      { name: 'pnl', type: 'int256', indexed: false, internalType: 'int256' },
    ],
    anonymous: false,
  },
] as const

// ─── ERC-20 USDC ABI ─────────────────────────────────────────────────────────
export const USDC_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const
