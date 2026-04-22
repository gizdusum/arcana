export type StrategyType = 'APOLLO' | 'ATLAS' | 'ARES'
export type ActionType = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE' | 'CLOSE_ALL' | 'HOLD'
export type Market = 'BTC/USD' | 'ETH/USD'

export interface Signal {
  action: ActionType
  market?: Market
  leverage?: number
  confidence: number  // 0.0 to 1.0
  reasoning?: string
  positionId?: number
}

export interface Position {
  id: bigint
  vault: string
  market: string
  isLong: boolean
  size: bigint           // USDC 6 dec
  entryPrice: bigint     // 8 dec
  leverage: number
  collateral: bigint     // USDC 6 dec
  openedAt: bigint
  isOpen: boolean
  fundingAccrued: bigint
}

export interface PriceMap {
  'BTC/USD': number
  'ETH/USD': number
}

export interface HermesDecision {
  id: string
  timestamp: number
  strategy: StrategyType
  action: ActionType
  market: string
  confidence: number
  reasoning: string
  priceAtDecision: number
  positionId?: number
  txHash?: string
}

export interface HermesConfig {
  rpcUrl: string
  privateKey: string
  vaultAddress: string
  perpEngineAddress: string
  oracleAddress: string
  strategy: StrategyType
  cycleInterval: number   // seconds
  oracleMode: 'chainlink' | 'mock'
}

export interface StrategyConfig {
  name: StrategyType
  maxLeverage: number
  longOnly: boolean
  stopLossBPS: number
  takeProfitBPS: number
  cooldownSeconds: number
  maxPositionCount: number
}
