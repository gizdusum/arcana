import { Signal, PriceMap, Position, Market } from '../types'

/**
 * ARES Strategy — Aggressive Donchian channel breakout with momentum confirmation.
 *
 * Rules:
 *   OPEN_LONG  when price breaks above 20-period Donchian upper channel
 *              AND ROC(20) > +0.5%
 *              AND volatility is not spiking (stdDev <= 2× historical avg)
 *   OPEN_SHORT when price breaks below 20-period Donchian lower channel
 *              AND ROC(20) < -0.5%
 *              AND volatility is not spiking
 *   CLOSE_ALL  when existing position moves against the channel
 *   Leverage: 10× when confidence > 0.85, 7× otherwise
 */
export class AresStrategy {
  readonly name = 'ARES' as const
  readonly maxLeverage = 10
  readonly longOnly = false
  readonly stopLossBPS = 2000   // 20%
  readonly takeProfitBPS = 5000 // 50%
  readonly cooldownSeconds = 300
  readonly maxPositionCount = 5

  private priceBuffer: Map<Market, number[]> = new Map()

  // Expose for explain()
  lastUpperChannel = 0
  lastLowerChannel = 0
  lastROC = 0
  lastStdDev = 0
  lastHistoricalStdDev = 0
  lastVolatilityFlag = false

  private readonly PRIMARY: Market = 'BTC/USD'
  private readonly SECONDARY: Market = 'ETH/USD'
  private readonly DONCHIAN_PERIOD = 20
  private readonly MIN_SAMPLES = 22  // need DONCHIAN_PERIOD + 2 for ROC

  analyze(prices: PriceMap, positions: Position[]): Signal {
    // Feed both markets but signal on BTC primarily
    this._addPrice(this.PRIMARY, prices['BTC/USD'])

    const buf = this._getBuf(this.PRIMARY)

    if (buf.length < this.MIN_SAMPLES) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: `ARES warming up: ${buf.length}/${this.MIN_SAMPLES} samples`,
      }
    }

    const currentPrice = prices['BTC/USD']

    // Donchian channel: highest high and lowest low over last DONCHIAN_PERIOD prices
    const window = buf.slice(-this.DONCHIAN_PERIOD)
    this.lastUpperChannel = Math.max(...window)
    this.lastLowerChannel = Math.min(...window)

    // Rate of change: (currentPrice - price20PeriodsAgo) / price20PeriodsAgo
    const price20Ago = buf[buf.length - this.DONCHIAN_PERIOD - 1]
    this.lastROC = (currentPrice - price20Ago) / price20Ago

    // Volatility: rolling standard deviation of last 20 prices
    this.lastStdDev = this._stdDev(window)
    this.lastHistoricalStdDev = this._historicalStdDevAvg(buf)

    this.lastVolatilityFlag =
      this.lastHistoricalStdDev > 0 && this.lastStdDev > 2 * this.lastHistoricalStdDev

    if (this.lastVolatilityFlag) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: this.explain({ action: 'HOLD', confidence: 0 }, prices),
      }
    }

    const openPositions = positions.filter((p) => p.isOpen)

    // Manage existing positions: close on channel reversal
    if (openPositions.length > 0) {
      const firstPos = openPositions[0]
      const closeSignal = this._shouldClose(firstPos, currentPrice)
      if (closeSignal) {
        return {
          action: 'CLOSE_ALL',
          market: this.PRIMARY,
          confidence: 0.9,
          reasoning: this.explain({ action: 'CLOSE_ALL', confidence: 0.9 }, prices),
        }
      }
    }

    if (openPositions.length >= this.maxPositionCount) {
      return {
        action: 'HOLD',
        confidence: 0,
        reasoning: `ARES: max positions reached`,
      }
    }

    // Breakout detection (use prev bar's channel so we don't self-reference)
    const prevWindow = buf.slice(-(this.DONCHIAN_PERIOD + 1), -1)
    const prevUpper = Math.max(...prevWindow)
    const prevLower = Math.min(...prevWindow)

    const longBreakout = currentPrice > prevUpper && this.lastROC > 0.005
    const shortBreakout = currentPrice < prevLower && this.lastROC < -0.005

    if (longBreakout) {
      const confidence = this._calcConfidence(this.lastROC, this.lastStdDev, true)
      const leverage = confidence > 0.85 ? this.maxLeverage : 7
      return {
        action: 'OPEN_LONG',
        market: this.PRIMARY,
        leverage,
        confidence,
        reasoning: this.explain({ action: 'OPEN_LONG', confidence }, prices),
      }
    }

    if (shortBreakout) {
      const confidence = this._calcConfidence(Math.abs(this.lastROC), this.lastStdDev, false)
      const leverage = confidence > 0.85 ? this.maxLeverage : 7
      return {
        action: 'OPEN_SHORT',
        market: this.PRIMARY,
        leverage,
        confidence,
        reasoning: this.explain({ action: 'OPEN_SHORT', confidence }, prices),
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
      `ARES | Channel[${this.lastLowerChannel.toFixed(0)}–${this.lastUpperChannel.toFixed(0)}] ` +
      `ROC=${(this.lastROC * 100).toFixed(3)}% ` +
      `σ=${this.lastStdDev.toFixed(0)}${this.lastVolatilityFlag ? '(VOLATILE!)' : ''} ` +
      `→ ${signal.action} | BTC=$${prices['BTC/USD'].toLocaleString()}`
    )
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private _addPrice(market: Market, price: number): void {
    const buf = this._getBuf(market)
    buf.push(price)
    if (buf.length > 200) buf.shift()
  }

  private _getBuf(market: Market): number[] {
    if (!this.priceBuffer.has(market)) this.priceBuffer.set(market, [])
    return this.priceBuffer.get(market)!
  }

  private _shouldClose(pos: Position, currentPrice: number): boolean {
    if (!pos.isOpen) return false
    // Close long if price falls back below lower channel
    if (pos.isLong && currentPrice < this.lastLowerChannel) return true
    // Close short if price rises back above upper channel
    if (!pos.isLong && currentPrice > this.lastUpperChannel) return true
    return false
  }

  private _stdDev(prices: number[]): number {
    if (prices.length < 2) return 0
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length
    const variance = prices.reduce((sum, p) => sum + (p - mean) ** 2, 0) / prices.length
    return Math.sqrt(variance)
  }

  /**
   * Compute historical average stdDev by sampling windows of DONCHIAN_PERIOD
   * every DONCHIAN_PERIOD ticks through the buffer.
   */
  private _historicalStdDevAvg(buf: number[]): number {
    const n = this.DONCHIAN_PERIOD
    const devs: number[] = []
    for (let i = n; i <= buf.length; i += n) {
      devs.push(this._stdDev(buf.slice(i - n, i)))
    }
    if (devs.length === 0) return 0
    return devs.reduce((a, b) => a + b, 0) / devs.length
  }

  /**
   * Confidence 0.0–1.0: based on breakout magnitude and low volatility.
   */
  private _calcConfidence(rocAbs: number, stdDev: number, _bullish: boolean): number {
    // ROC score: 0.5% = 0.5, 2% = 1.0
    const rocScore = Math.min(rocAbs / 0.02, 1.0)

    // Volatility score: lower relative stdDev → higher confidence
    const relVolatility =
      this.lastHistoricalStdDev > 0 ? stdDev / this.lastHistoricalStdDev : 1.0
    const volScore = Math.max(0, 1 - (relVolatility - 0.5))

    return Math.min(0.5 * rocScore + 0.5 * volScore, 0.98)
  }
}
