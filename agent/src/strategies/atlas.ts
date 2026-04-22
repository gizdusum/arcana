import { Signal, PriceMap, Position, Market } from '../types'

interface Candle {
  open: number
  high: number
  low: number
  close: number
}

interface TradeRecord {
  pnlPct: number
  openTs: number
  closeTs: number
}

/**
 * ATLAS Strategy — Balanced multi-timeframe trend following with volatility scaling.
 *
 * Timeframes (simulated via 15-second ticks):
 *   15m: last 60 ticks  (60 × 15s = 15min)
 *   1h:  last 240 ticks (240 × 15s = 1hr), downsampled to 1-min candles
 *   4h:  last 960 ticks (960 × 15s = 4hr), downsampled to 5-min candles
 *
 * Signal when all three timeframes agree on direction.
 * ATR-based position sizing: higher ATR → smaller position (volatility scaling).
 * Reduce leverage if rolling Sharpe (last 20 trades) < 1.0.
 * Can go LONG or SHORT.
 */
export class AtlasStrategy {
  readonly name = 'ATLAS' as const
  readonly maxLeverage = 5
  readonly longOnly = false
  readonly stopLossBPS = 1000   // 10%
  readonly takeProfitBPS = 2000 // 20%
  readonly cooldownSeconds = 600
  readonly maxPositionCount = 3

  // Tick buffers per market (15s ticks)
  private tickBuffer: Map<Market, number[]> = new Map()

  // Trade history for Sharpe calculation
  private tradeHistory: TradeRecord[] = []
  private pendingOpenTs = 0
  private pendingOpenPrice = 0

  // Expose internals for explain()
  lastATR = 0
  lastSharpe = 0
  lastTimeframeAgreement: 'BULLISH' | 'BEARISH' | 'MIXED' = 'MIXED'
  lastAtrVolatile = false

  private readonly PRIMARY: Market = 'BTC/USD'
  private readonly TICKS_15M = 60
  private readonly TICKS_1H = 240
  private readonly TICKS_4H = 960

  analyze(prices: PriceMap, positions: Position[]): Signal {
    const buf = this._getBuf(this.PRIMARY)
    buf.push(prices[this.PRIMARY])

    // Cap at 4h window + a little extra
    if (buf.length > this.TICKS_4H + 10) buf.shift()

    if (buf.length < this.TICKS_15M) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: `ATLAS warming up: ${buf.length}/${this.TICKS_15M} ticks`,
      }
    }

    // Compute EMA trends across timeframes
    const dir15m = this._timeframeDirection(buf, this.TICKS_15M)
    const dir1h = buf.length >= this.TICKS_1H
      ? this._timeframeDirection(buf, this.TICKS_1H)
      : dir15m
    const dir4h = buf.length >= this.TICKS_4H
      ? this._timeframeDirection(buf, this.TICKS_4H)
      : dir1h

    const bullish = dir15m === 1 && dir1h === 1 && dir4h === 1
    const bearish = dir15m === -1 && dir1h === -1 && dir4h === -1

    this.lastTimeframeAgreement = bullish ? 'BULLISH' : bearish ? 'BEARISH' : 'MIXED'

    // ATR (14-period, using last 15 ticks)
    const atrSamples = buf.slice(-15)
    this.lastATR = this._calcATR(atrSamples)

    // Volatility filter: skip if ATR > 2× historical average
    const historicalATR = this._historicalAverageATR(buf)
    this.lastAtrVolatile = historicalATR > 0 && this.lastATR > 2 * historicalATR
    if (this.lastAtrVolatile) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: `ATLAS: ATR spike detected (${this.lastATR.toFixed(0)} > 2×avg ${historicalATR.toFixed(0)}), skipping`,
      }
    }

    // Sharpe ratio (last 20 trades)
    this.lastSharpe = this._rollingSharpePct()
    const leverageMultiplier = this.lastSharpe < 1.0 ? 0.6 : 1.0
    const baseLeverage = Math.max(1, Math.round(this.maxLeverage * leverageMultiplier))

    // ATR-based leverage scaling: if ATR is high, reduce leverage
    const atrScaling = historicalATR > 0
      ? Math.max(0.5, 1 - (this.lastATR - historicalATR) / historicalATR)
      : 1.0
    const finalLeverage = Math.max(1, Math.min(this.maxLeverage, Math.round(baseLeverage * atrScaling)))

    const openPositions = positions.filter((p) => p.isOpen)
    const hasOpen = openPositions.length > 0

    // Manage existing positions: close if trend reverses
    if (hasOpen) {
      const firstOpen = openPositions[0]
      const wasLong = firstOpen.isLong
      if ((wasLong && bearish) || (!wasLong && bullish)) {
        return {
          action: 'CLOSE_ALL',
          market: this.PRIMARY,
          confidence: 0.8,
          reasoning: this.explain({ action: 'CLOSE_ALL', confidence: 0.8 }, prices),
        }
      }
    }

    if (!bullish && !bearish) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: this.explain({ action: 'HOLD', confidence: 0 }, prices),
      }
    }

    if (openPositions.length >= this.maxPositionCount) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: `ATLAS: max positions (${this.maxPositionCount}) reached`,
      }
    }

    const confidence = this._calcConfidence(buf, bullish)
    const action: Signal['action'] = bullish ? 'OPEN_LONG' : 'OPEN_SHORT'

    return {
      action,
      market: this.PRIMARY,
      leverage: finalLeverage,
      confidence,
      reasoning: this.explain({ action, confidence }, prices),
    }
  }

  explain(signal: Signal, prices: PriceMap): string {
    return (
      `ATLAS | Timeframes: ${this.lastTimeframeAgreement} | ` +
      `ATR=${this.lastATR.toFixed(0)}${this.lastAtrVolatile ? '(VOLATILE)' : ''} | ` +
      `Sharpe=${this.lastSharpe.toFixed(2)} → ${signal.action} ` +
      `| BTC=$${prices['BTC/USD'].toLocaleString()}`
    )
  }

  /**
   * Record a completed trade's PnL percentage for Sharpe calculation.
   */
  recordTrade(openPrice: number, closePrice: number, isLong: boolean, openTs: number, closeTs: number): void {
    const pnlPct = isLong
      ? (closePrice - openPrice) / openPrice
      : (openPrice - closePrice) / openPrice
    this.tradeHistory.push({ pnlPct, openTs, closeTs })
    if (this.tradeHistory.length > 50) this.tradeHistory.shift()
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private _getBuf(market: Market): number[] {
    if (!this.tickBuffer.has(market)) this.tickBuffer.set(market, [])
    return this.tickBuffer.get(market)!
  }

  /**
   * Determine trend direction for a window of ticks: +1 bullish, -1 bearish, 0 neutral.
   * Uses short EMA vs long EMA on the last `ticks` prices.
   */
  private _timeframeDirection(buf: number[], ticks: number): 1 | -1 | 0 {
    const window = buf.slice(-ticks)
    if (window.length < 10) return 0

    const shortPeriod = Math.max(5, Math.floor(ticks * 0.1))
    const longPeriod = Math.max(10, Math.floor(ticks * 0.3))

    const emaShort = this._calcEMA(window, shortPeriod)
    const emaLong = this._calcEMA(window, longPeriod)

    if (emaShort > emaLong * 1.0005) return 1   // bullish (>0.05% threshold)
    if (emaShort < emaLong * 0.9995) return -1  // bearish
    return 0
  }

  private _calcEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0
    if (prices.length < period) return prices[prices.length - 1]
    const k = 2 / (period + 1)
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k)
    }
    return ema
  }

  /**
   * Average True Range over a price series (simplified: uses |close - prev_close|).
   */
  private _calcATR(prices: number[]): number {
    if (prices.length < 2) return 0
    let sum = 0
    for (let i = 1; i < prices.length; i++) {
      sum += Math.abs(prices[i] - prices[i - 1])
    }
    return sum / (prices.length - 1)
  }

  /**
   * Historical average ATR (uses windows of 15 ticks, sampled every 15 ticks).
   */
  private _historicalAverageATR(buf: number[]): number {
    const windowSize = 15
    const step = 15
    const atrs: number[] = []
    for (let i = windowSize; i <= buf.length; i += step) {
      const window = buf.slice(i - windowSize, i)
      atrs.push(this._calcATR(window))
    }
    if (atrs.length === 0) return 0
    return atrs.reduce((a, b) => a + b, 0) / atrs.length
  }

  /**
   * Rolling Sharpe ratio over the last 20 completed trades.
   * Returns 0 if insufficient history.
   */
  private _rollingSharpePct(): number {
    const recent = this.tradeHistory.slice(-20)
    if (recent.length < 3) return 1.5 // assume decent Sharpe with no history
    const returns = recent.map((t) => t.pnlPct)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance =
      returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) return mean > 0 ? 3.0 : 0
    return mean / stdDev
  }

  /**
   * 0.0–1.0 confidence based on EMA divergence across timeframes.
   */
  private _calcConfidence(buf: number[], bullish: boolean): number {
    const window = buf.slice(-this.TICKS_15M)
    if (window.length < 10) return 0.5
    const ema10 = this._calcEMA(window, Math.min(10, window.length))
    const ema30 = this._calcEMA(window, Math.min(30, window.length))
    if (ema30 === 0) return 0.5
    const separation = Math.abs(ema10 - ema30) / ema30
    const directionScore = bullish ? (ema10 > ema30 ? 1 : 0) : (ema10 < ema30 ? 1 : 0)
    const base = Math.min(separation / 0.02, 1.0) // 2% separation = full score
    return Math.min(0.4 + 0.5 * base * directionScore, 0.98)
  }
}
