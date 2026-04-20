import { Signal, PriceMap, Position, Market } from '../types'

/**
 * APOLLO Strategy — Conservative long-only EMA/RSI trend following.
 *
 * Rules:
 *   OPEN_LONG  when: EMA20 > EMA50 AND RSI(14) < 65 AND no open positions
 *   CLOSE_ALL  when: EMA20 < EMA50 OR RSI(14) > 75
 *   HOLD       otherwise
 *
 * Requires at least 50 price observations before generating signals.
 */
export class ApolloStrategy {
  readonly name = 'APOLLO' as const
  readonly maxLeverage = 3
  readonly longOnly = true
  readonly stopLossBPS = 500      // 5%
  readonly takeProfitBPS = 1000   // 10%
  readonly cooldownSeconds = 900
  readonly maxPositionCount = 2

  private priceBuffer: Map<Market, number[]> = new Map()
  lastEMA20 = 0
  lastEMA50 = 0
  lastRSI = 0

  private readonly PRIMARY_MARKET: Market = 'BTC/USD'
  private readonly MIN_SAMPLES = 50

  analyze(prices: PriceMap, positions: Position[]): Signal {
    // Accumulate price history for BTC/USD
    const buf = this._getBuf(this.PRIMARY_MARKET)
    buf.push(prices[this.PRIMARY_MARKET])

    // Keep buffer at most 200 entries to avoid unbounded growth
    if (buf.length > 200) buf.shift()

    // Not enough data yet
    if (buf.length < this.MIN_SAMPLES) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: `Warming up: ${buf.length}/${this.MIN_SAMPLES} samples collected`,
      }
    }

    this.lastEMA20 = this._calcEMA(buf, 20)
    this.lastEMA50 = this._calcEMA(buf, 50)
    this.lastRSI = this._calcRSI(buf, 14)

    const hasOpenPositions = positions.some((p) => p.isOpen)
    const emaBullish = this.lastEMA20 > this.lastEMA50
    const emaBearish = this.lastEMA20 < this.lastEMA50
    const rsiBearish = this.lastRSI > 75
    const rsiOk = this.lastRSI < 65

    // Trigger close if trend reverses
    if (emaBearish || rsiBearish) {
      if (hasOpenPositions) {
        return {
          action: 'CLOSE_ALL',
          market: this.PRIMARY_MARKET,
          confidence: this._scoreConfidence(this.lastEMA20, this.lastEMA50, this.lastRSI),
          reasoning: this.explain({ action: 'CLOSE_ALL', confidence: 0 }, prices),
        }
      }
    }

    // Entry signal
    if (emaBullish && rsiOk && !hasOpenPositions) {
      const confidence = this._scoreConfidence(this.lastEMA20, this.lastEMA50, this.lastRSI)
      return {
        action: 'OPEN_LONG',
        market: this.PRIMARY_MARKET,
        leverage: this.maxLeverage,
        confidence,
        reasoning: this.explain({ action: 'OPEN_LONG', confidence }, prices),
      }
    }

    return {
      action: 'HOLD',
      confidence: 0,
      reasoning: this.explain({ action: 'HOLD', confidence: 0 }, prices),
    }
  }

  explain(signal: Signal, prices: PriceMap): string {
    return (
      `EMA20=${this.lastEMA20.toFixed(0)} vs EMA50=${this.lastEMA50.toFixed(0)}, ` +
      `RSI=${this.lastRSI.toFixed(1)} → ${signal.action}` +
      `${signal.market ? ' on ' + signal.market : ''} ` +
      `| BTC=$${prices['BTC/USD'].toLocaleString()}`
    )
  }

  private _getBuf(market: Market): number[] {
    if (!this.priceBuffer.has(market)) {
      this.priceBuffer.set(market, [])
    }
    return this.priceBuffer.get(market)!
  }

  /**
   * Exponential Moving Average.
   * EMA_t = price_t * k + EMA_{t-1} * (1 - k), where k = 2/(period+1)
   */
  private _calcEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1]

    const k = 2 / (period + 1)
    // Seed EMA with simple MA of first `period` values
    let ema =
      prices.slice(0, period).reduce((a, b) => a + b, 0) / period

    for (let i = period; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k)
    }
    return ema
  }

  /**
   * Relative Strength Index over `period` bars.
   */
  private _calcRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50 // neutral default

    let avgGain = 0
    let avgLoss = 0

    // Initial averages
    for (let i = 1; i <= period; i++) {
      const delta = prices[i] - prices[i - 1]
      if (delta > 0) avgGain += delta
      else avgLoss += Math.abs(delta)
    }
    avgGain /= period
    avgLoss /= period

    // Smooth RSI for remaining bars
    for (let i = period + 1; i < prices.length; i++) {
      const delta = prices[i] - prices[i - 1]
      const gain = delta > 0 ? delta : 0
      const loss = delta < 0 ? Math.abs(delta) : 0
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
    }

    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }

  /**
   * Compute a 0.0–1.0 confidence score based on EMA separation and RSI distance.
   */
  private _scoreConfidence(ema20: number, ema50: number, rsi: number): number {
    // EMA separation score: how much EMA20 diverges from EMA50 (as % of EMA50)
    const emaSep = ema50 > 0 ? Math.abs(ema20 - ema50) / ema50 : 0
    const emaScore = Math.min(emaSep / 0.05, 1.0) // 5% separation = full score

    // RSI distance from neutral zone (35–65)
    let rsiScore = 0
    if (rsi >= 35 && rsi <= 65) {
      rsiScore = 1 - Math.abs(rsi - 50) / 15
    } else {
      rsiScore = Math.max(0, 1 - Math.abs(rsi - 50) / 30)
    }

    return Math.min(0.5 * emaScore + 0.5 * rsiScore, 1.0)
  }
}
