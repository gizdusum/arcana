import { createPublicClient, http, keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from './chains'
import { PERP_ENGINE_ABI, VAULT_ABI } from './abis'
import { OracleService } from './oracle'
import { TransactionExecutor } from './executor'
import { DecisionLogger } from './logger'
import { ApolloStrategy } from './strategies/apollo'
import { AtlasStrategy } from './strategies/atlas'
import { AresStrategy } from './strategies/ares'
import {
  HermesConfig,
  HermesDecision,
  PriceMap,
  Position,
  Signal,
  StrategyType,
} from './types'

type StrategyImpl = ApolloStrategy | AtlasStrategy | AresStrategy

const MARKET_KEYS: Record<string, `0x${string}`> = {
  'BTC/USD': keccak256(toBytes('BTC/USD')),
  'ETH/USD': keccak256(toBytes('ETH/USD')),
}

// Minimum collateral to open a position (10 USDC = 10_000_000 in 6 dec)
const MIN_COLLATERAL = 10_000_000n

// Fraction of vault balance to use per trade (10%)
const COLLATERAL_FRACTION = 0.10

// ─── Guardrail constants ──────────────────────────────────────────────────────
const SCALE_IN_ENABLED       = true
const SCALE_IN_MAX_PCT       = 0.50          // max 50% of existing collateral per add
const SCALE_IN_MIN_PROFIT_PCT = 0.05         // only scale in when ≥+5% in profit
const SCALE_IN_COOLDOWN_MS   = 5 * 60 * 1000 // 5 min between adds in same direction
const MAX_TOTAL_EXPOSURE_PCT = 0.25          // total open collateral ≤ 25% of vault
const HARD_STOP_THRESHOLD    = -0.40         // close when ≥40% of collateral is lost

export class HermesAgent {
  private isRunning = false
  private cycleCount = 0
  private strategy: StrategyImpl
  private oracleService: OracleService
  private executor: TransactionExecutor
  private logger: DecisionLogger
  private publicClient
  private config: HermesConfig

  constructor(config: HermesConfig) {
    this.config = config
    this.strategy = this._createStrategy(config.strategy)

    this.oracleService = new OracleService(config.oracleAddress, config.privateKey)
    this.executor = new TransactionExecutor(
      config.privateKey,
      config.vaultAddress,
      config.oracleAddress
    )
    this.logger = new DecisionLogger(
      process.env['DB_PATH'] ?? './data/decisions.db'
    )
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(config.rpcUrl),
    })
  }

  async start(): Promise<void> {
    this.isRunning = true
    const stratName = this.strategy.name
    console.log('╔══════════════════════════════════════════════════════╗')
    console.log(`║  ARCANA — HERMES AGENT DAEMON                        ║`)
    console.log(`║  Strategy : ${stratName.padEnd(41)}║`)
    console.log(`║  Vault    : ${this.config.vaultAddress.slice(0, 10)}...${this.config.vaultAddress.slice(-8).padEnd(22)}║`)
    console.log(`║  Chain    : Arc Testnet (${this.config.rpcUrl.slice(0, 26)})    ║`)
    console.log(`║  Interval : ${String(this.config.cycleInterval) + 's'} cycles${' '.repeat(35 - String(this.config.cycleInterval).length)}║`)
    console.log('╚══════════════════════════════════════════════════════╝')

    while (this.isRunning) {
      try {
        await this.runCycle()
        this.cycleCount++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[HERMES] Cycle error: ${msg}`)
      }
      await this._sleep(this.config.cycleInterval * 1000)
    }

    console.log('[HERMES] Daemon stopped gracefully.')
    this.logger.close()
  }

  async stop(): Promise<void> {
    console.log('[HERMES] Shutdown signal received. Stopping after current cycle…')
    this.isRunning = false
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Core Cycle
  // ─────────────────────────────────────────────────────────────────────────

  async runCycle(): Promise<void> {
    const cycleStart = Date.now()
    console.log(`\n[HERMES] ── Cycle #${this.cycleCount} ──────────────────────────────`)

    // 1. Fetch prices from CoinGecko
    const prices = await this.oracleService.fetchAll()

    // 2. Push prices to on-chain oracle (mock mode)
    if (this.config.oracleMode === 'mock') {
      try {
        await this.oracleService.pushToChain(prices)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[HERMES] Oracle push failed: ${msg}`)
      }
    }

    // 3. Read open positions from PerpEngine
    const positions = await this._fetchPositions()
    console.log(`[HERMES] Open positions: ${positions.length}`)

    // 4. Manage existing positions (stop-loss / take-profit)
    await this._managePositions(positions, prices)

    // 4b. Enforce protocol guardrails (hard-stop before liquidation)
    await this._enforceGuardrails(positions, prices)

    // 5. Re-fetch positions after potential closures
    const currentPositions = await this._fetchPositions()

    // 6. Analyze for new signal
    const signal = this.strategy.analyze(prices, currentPositions)

    const cycleDuration = Date.now() - cycleStart
    this._printCycleSummary(signal, prices, currentPositions, cycleDuration)

    // 7. Execute if signal warrants action
    const CONFIDENCE_THRESHOLD = 0.68
    if (
      signal.action !== 'HOLD' &&
      signal.confidence >= CONFIDENCE_THRESHOLD
    ) {
      await this._executeSignal(signal, prices)
    } else if (signal.action !== 'HOLD') {
      console.log(
        `[HERMES] Signal ${signal.action} confidence ${signal.confidence.toFixed(3)} below threshold ${CONFIDENCE_THRESHOLD} — holding`
      )
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Position Management
  // ─────────────────────────────────────────────────────────────────────────

  private async _managePositions(positions: Position[], prices: PriceMap): Promise<void> {
    for (const pos of positions) {
      if (!pos.isOpen) continue

      const marketStr = this._marketKeyToString(pos.market)
      const currentPrice = prices[marketStr as keyof PriceMap] ?? 0
      if (currentPrice === 0) continue

      const pnlPct = this._calculatePnLPercent(pos, currentPrice)
      const slThreshold = -(this.strategy.stopLossBPS / 10_000)
      const tpThreshold = this.strategy.takeProfitBPS / 10_000

      let shouldClose = false
      let closeReason = ''

      if (pnlPct <= slThreshold) {
        shouldClose = true
        closeReason = `Stop-loss triggered: PnL=${(pnlPct * 100).toFixed(2)}%`
      } else if (pnlPct >= tpThreshold) {
        shouldClose = true
        closeReason = `Take-profit triggered: PnL=${(pnlPct * 100).toFixed(2)}%`
      }

      if (shouldClose) {
        console.log(`[HERMES] Closing position #${pos.id}: ${closeReason}`)
        try {
          const result = await this.executor.executeVaultTx('executeClose', [pos.id])
          const decision: HermesDecision = {
            id: `${Date.now()}-close-${pos.id}`,
            timestamp: Date.now(),
            strategy: this.strategy.name as StrategyType,
            action: 'CLOSE',
            market: marketStr,
            confidence: 0.95,
            reasoning: closeReason,
            priceAtDecision: currentPrice,
            positionId: Number(pos.id),
            txHash: result.hash,
          }
          await this.logger.record(decision)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[HERMES] Failed to close position #${pos.id}: ${msg}`)
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Guardrails
  // ─────────────────────────────────────────────────────────────────────────

  private async _enforceGuardrails(positions: Position[], prices: PriceMap): Promise<void> {
    for (const pos of positions) {
      if (!pos.isOpen) continue

      const marketStr = this._marketKeyToString(pos.market)
      const currentPrice = prices[marketStr as keyof PriceMap] ?? 0
      if (currentPrice === 0) continue

      const pnlPct = this._calculatePnLPercent(pos, currentPrice)

      if (pnlPct <= HARD_STOP_THRESHOLD) {
        const closeReason = `Hard-stop: PnL=${(pnlPct * 100).toFixed(2)}% ≤ ${(HARD_STOP_THRESHOLD * 100).toFixed(0)}% — closing #${pos.id}`
        console.log(`[HERMES] 🛑 ${closeReason}`)
        try {
          const result = await this.executor.executeVaultTx('executeClose', [pos.id])
          const decision: HermesDecision = {
            id: `${Date.now()}-hardstop-${pos.id}`,
            timestamp: Date.now(),
            strategy: this.strategy.name as StrategyType,
            action: 'CLOSE',
            market: marketStr,
            confidence: 0.99,
            reasoning: closeReason,
            priceAtDecision: currentPrice,
            positionId: Number(pos.id),
            txHash: result.hash,
          }
          await this.logger.record(decision)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          // "Position not open" is expected on double-close; swallow silently
          if (!msg.includes('not open')) {
            console.error(`[HERMES] Hard-stop executeClose failed for #${pos.id}: ${msg}`)
          }
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Signal Execution
  // ─────────────────────────────────────────────────────────────────────────

  private async _executeSignal(signal: Signal, prices: PriceMap): Promise<void> {
    const market = signal.market ?? 'BTC/USD'
    const marketKey = MARKET_KEYS[market]
    if (!marketKey) {
      console.warn(`[HERMES] Unknown market: ${market}`)
      return
    }

    let txHash: string | undefined
    let positionId: number | undefined

    try {
      if (signal.action === 'OPEN_LONG' || signal.action === 'OPEN_SHORT') {
        // Determine base collateral: fraction of vault balance
        const vaultBalance = await this._getVaultBalance()
        const collateral = this._computeCollateral(vaultBalance, signal.confidence)

        const isLong = signal.action === 'OPEN_LONG'
        const leverage = signal.leverage ?? this.strategy.maxLeverage

        // ── Guardrail: fetch current open positions for checks ───────────────
        const allOpen = await this._fetchPositions()
        const openPositions = allOpen.filter((p) => p.isOpen)
        const sameDir = openPositions.filter((p) => p.isLong === isLong)

        let finalCollateral = collateral

        // ── a/b) Scale-in check ──────────────────────────────────────────────
        if (sameDir.length > 0) {
          // This is a scale-in attempt (same-direction position already open)
          if (!SCALE_IN_ENABLED) {
            console.log(`[HERMES] Scale-in disabled — skipping additional ${isLong ? 'LONG' : 'SHORT'} on ${market}`)
            return
          }

          // Require at least one same-direction position to be profitable
          const anyProfitable = sameDir.some((p) => {
            const currentPrice = prices[this._marketKeyToString(p.market) as keyof PriceMap] ?? 0
            return currentPrice > 0 && this._calculatePnLPercent(p, currentPrice) >= SCALE_IN_MIN_PROFIT_PCT
          })
          if (!anyProfitable) {
            console.log(
              `[HERMES] Scale-in blocked — no same-direction position is ≥+${(SCALE_IN_MIN_PROFIT_PCT * 100).toFixed(0)}% profit (no averaging down)`
            )
            return
          }

          // Cooldown: block if most recent same-direction open was within cooldown window
          const latestOpenedAt = sameDir.reduce(
            (max, p) => (p.openedAt > max ? p.openedAt : max),
            0n
          )
          const msSinceLastOpen = Date.now() - Number(latestOpenedAt) * 1000
          if (msSinceLastOpen < SCALE_IN_COOLDOWN_MS) {
            console.log(
              `[HERMES] Scale-in cooldown active — ${Math.ceil((SCALE_IN_COOLDOWN_MS - msSinceLastOpen) / 1000)}s remaining`
            )
            return
          }

          // Cap new collateral at SCALE_IN_MAX_PCT of existing same-direction collateral
          const existingCollateral = sameDir.reduce((sum, p) => sum + p.collateral, 0n)
          const scaleInCap = BigInt(Math.floor(Number(existingCollateral) * SCALE_IN_MAX_PCT))
          if (collateral > scaleInCap) {
            console.log(
              `[HERMES] Scale-in cap applied: ${Number(collateral) / 1e6} → ${Number(scaleInCap) / 1e6} USDC`
            )
            finalCollateral = scaleInCap
          }
        }

        // ── c) Total exposure cap ────────────────────────────────────────────
        const totalLocked = openPositions.reduce((sum, p) => sum + p.collateral, 0n)
        const projectedTotal = totalLocked + finalCollateral
        const exposurePct = vaultBalance > 0n ? Number(projectedTotal) / Number(vaultBalance) : 1
        if (exposurePct > MAX_TOTAL_EXPOSURE_PCT) {
          console.log(
            `[HERMES] Exposure cap: projected ${(exposurePct * 100).toFixed(1)}% > ${(MAX_TOTAL_EXPOSURE_PCT * 100).toFixed(0)}% of vault — skipping`
          )
          return
        }

        // ── d) Minimum collateral check (post-guardrail) ─────────────────────
        if (finalCollateral < MIN_COLLATERAL) {
          console.warn(
            `[HERMES] Post-guardrail collateral ${Number(finalCollateral) / 1e6} USDC < min ${Number(MIN_COLLATERAL) / 1e6} USDC — skipping`
          )
          return
        }

        // ── Execute ──────────────────────────────────────────────────────────
        console.log(
          `[HERMES] Opening ${isLong ? 'LONG' : 'SHORT'} on ${market} ` +
          `| collateral=${Number(finalCollateral) / 1e6} USDC | leverage=${leverage}x` +
          (sameDir.length > 0 ? ' [scale-in]' : '')
        )

        const result = await this.executor.executeVaultTx('executeOpen', [
          marketKey,
          isLong,
          finalCollateral,
          leverage,
        ])
        txHash = result.hash
        positionId = await this._findLatestPositionId()

        // Log decision on-chain
        await this.executor.executeVaultTx('logDecision', [
          signal.reasoning ?? 'No reasoning provided',
        ])
      } else if (signal.action === 'CLOSE_ALL') {
        const openPositions = await this._fetchPositions()
        for (const pos of openPositions) {
          if (!pos.isOpen) continue
          console.log(`[HERMES] Closing position #${pos.id} (CLOSE_ALL)`)
          const result = await this.executor.executeVaultTx('executeClose', [pos.id])
          txHash = result.hash
        }
      } else if (signal.action === 'CLOSE' && signal.positionId !== undefined) {
        const result = await this.executor.executeVaultTx('executeClose', [
          BigInt(signal.positionId),
        ])
        txHash = result.hash
        positionId = signal.positionId
      }

      // Record decision to SQLite
      const decision: HermesDecision = {
        id: `${Date.now()}-${signal.action.toLowerCase()}`,
        timestamp: Date.now(),
        strategy: this.strategy.name as StrategyType,
        action: signal.action,
        market,
        confidence: signal.confidence,
        reasoning: signal.reasoning ?? '',
        priceAtDecision: prices[market as keyof PriceMap] ?? 0,
        positionId,
        txHash,
      }
      await this.logger.record(decision)
      console.log(`[HERMES] Decision recorded | tx=${txHash ?? 'none'}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[HERMES] Failed to execute ${signal.action}: ${msg}`)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async _fetchPositions(): Promise<Position[]> {
    try {
      const openIds = await this.publicClient.readContract({
        address: this.config.perpEngineAddress as `0x${string}`,
        abi: PERP_ENGINE_ABI,
        functionName: 'getVaultOpenPositions',
        args: [this.config.vaultAddress as `0x${string}`],
      }) as bigint[]

      const positions: Position[] = []
      for (const posId of openIds) {
        const raw = await this.publicClient.readContract({
          address: this.config.perpEngineAddress as `0x${string}`,
          abi: PERP_ENGINE_ABI,
          functionName: 'positions',
          args: [posId],
        }) as [bigint, string, `0x${string}`, boolean, bigint, bigint, number, bigint, bigint, boolean, bigint]

        positions.push({
          id: raw[0],
          vault: raw[1],
          market: raw[2],
          isLong: raw[3],
          size: raw[4],
          entryPrice: raw[5],
          leverage: raw[6],
          collateral: raw[7],
          openedAt: raw[8],
          isOpen: raw[9],
          fundingAccrued: raw[10],
        })
      }
      return positions
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[HERMES] Failed to fetch positions: ${msg}`)
      return []
    }
  }

  private async _getVaultBalance(): Promise<bigint> {
    try {
      const balance = await this.executor.getVaultTotalAssets()
      return balance
    } catch {
      return 0n
    }
  }

  private _computeCollateral(vaultBalance: bigint, confidence: number): bigint {
    // Scale collateral fraction by confidence (0.68–1.0 → 7%–15%)
    const fraction = COLLATERAL_FRACTION * (0.7 + 0.3 * confidence)
    const raw = Number(vaultBalance) * fraction
    // Round to nearest USDC unit (1 unit = 1 in 6-dec = $0.000001)
    return BigInt(Math.floor(raw))
  }

  private async _findLatestPositionId(): Promise<number | undefined> {
    try {
      const nextId = await this.publicClient.readContract({
        address: this.config.perpEngineAddress as `0x${string}`,
        abi: PERP_ENGINE_ABI,
        functionName: 'nextPositionId',
      }) as bigint
      return Number(nextId) - 1
    } catch {
      return undefined
    }
  }

  private _calculatePnLPercent(pos: Position, currentPrice: number): number {
    const entryPrice = Number(pos.entryPrice) / 1e8
    if (entryPrice === 0) return 0
    const delta = (currentPrice - entryPrice) / entryPrice
    return pos.isLong ? delta * pos.leverage : -delta * pos.leverage
  }

  private _marketKeyToString(marketKey: string): string {
    // Reverse-lookup market key
    for (const [name, key] of Object.entries(MARKET_KEYS)) {
      if (key.toLowerCase() === marketKey.toLowerCase()) return name
    }
    return marketKey
  }

  private _printCycleSummary(
    signal: Signal,
    prices: PriceMap,
    positions: Position[],
    durationMs: number
  ): void {
    const openCount = positions.filter((p) => p.isOpen).length
    console.log(
      `[HERMES] BTC=$${prices['BTC/USD'].toLocaleString()} | ETH=$${prices['ETH/USD'].toLocaleString()} ` +
      `| Open: ${openCount} | Signal: ${signal.action} (conf=${signal.confidence.toFixed(3)}) ` +
      `| Cycle took ${durationMs}ms`
    )
  }

  private _createStrategy(name: StrategyType): StrategyImpl {
    switch (name) {
      case 'APOLLO': return new ApolloStrategy()
      case 'ATLAS': return new AtlasStrategy()
      case 'ARES': return new AresStrategy()
      default: {
        const exhaustive: never = name
        throw new Error(`Unknown strategy: ${exhaustive}`)
      }
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
