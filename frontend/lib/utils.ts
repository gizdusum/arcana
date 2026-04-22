// ─── USDC formatting (6 decimals) ────────────────────────────────────────────

export function formatUSDC(amount: bigint): string {
  const num = Number(amount) / 1e6
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatUSDCRaw(amount: bigint): string {
  const num = Number(amount) / 1e6
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── Address formatting ───────────────────────────────────────────────────────

export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

// ─── PnL formatting ───────────────────────────────────────────────────────────

export function formatPnL(pnl: number): { text: string; colorClass: string } {
  const sign = pnl >= 0 ? '+' : ''
  const text = `${sign}${pnl.toFixed(2)}%`
  const colorClass = pnl >= 0 ? 'text-arc-mint' : 'text-arc-red'
  return { text, colorClass }
}

export function formatPnLUSDC(pnl: bigint): { text: string; colorClass: string } {
  const num = Number(pnl) / 1e6
  const sign = num >= 0 ? '+' : ''
  const text = `${sign}$${Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
  const colorClass = num >= 0 ? 'text-arc-mint' : 'text-arc-red'
  return { text, colorClass }
}

// ─── Leverage formatting ──────────────────────────────────────────────────────

export function formatLeverage(leverage: number): string {
  return `${leverage}x`
}

// ─── Market bytes32 → human readable ─────────────────────────────────────────

const MARKET_MAP: Record<string, string> = {
  // keccak256("BTC/USD") hex prefix matching
  '0x4254432f555344': 'BTC/USD',
  '0x4554482f555344': 'ETH/USD',
}

export function formatMarket(market: `0x${string}`): string {
  // Try hex decode
  try {
    const hex = market.replace('0x', '')
    const bytes = hex.match(/.{1,2}/g) || []
    const str = bytes
      .map((b) => String.fromCharCode(parseInt(b, 16)))
      .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127)
      .join('')
      .trim()
    if (str.includes('/') && str.length > 3) return str
  } catch {
    // ignore
  }

  // Check known markets
  if (MARKET_MAP[market.toLowerCase()]) return MARKET_MAP[market.toLowerCase()]

  // Fallback: short hex
  return `${market.slice(0, 8)}...`
}

// ─── Time formatting ──────────────────────────────────────────────────────────

export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    const s = diff % 60
    return s > 0 ? `${m}m ${s}s ago` : `${m}m ago`
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`
  }
  const d = Math.floor(diff / 86400)
  return `${d}d ago`
}

// ─── Strategy colors ──────────────────────────────────────────────────────────

export function strategyColor(strategy: 'APOLLO' | 'ATLAS' | 'ARES'): string {
  switch (strategy) {
    case 'APOLLO':
      return '#7c6af7' // arc-violet
    case 'ATLAS':
      return '#4f8fff' // blue
    case 'ARES':
      return '#ff4f6b' // arc-red
  }
}

export function strategyBgClass(strategy: 'APOLLO' | 'ATLAS' | 'ARES'): string {
  switch (strategy) {
    case 'APOLLO':
      return 'bg-arc-violet/10 border-arc-violet/30 text-arc-violet'
    case 'ATLAS':
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400'
    case 'ARES':
      return 'bg-arc-red/10 border-arc-red/30 text-arc-red'
  }
}

// ─── Price formatting (8 decimals from Chainlink) ────────────────────────────

export function formatPrice(price: bigint): string {
  const num = Number(price) / 1e8
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

// ─── Mock NAV history for charts ─────────────────────────────────────────────

export interface NavPoint {
  time: string
  value: number
  timestamp: number
}

export function generateMockNavHistory(
  baseValue: number,
  period: '24H' | '7D' | '30D'
): NavPoint[] {
  const now = Date.now()
  let points: number
  let intervalMs: number

  switch (period) {
    case '24H':
      points = 48
      intervalMs = 30 * 60 * 1000 // 30 min
      break
    case '7D':
      points = 84
      intervalMs = 2 * 60 * 60 * 1000 // 2 hours
      break
    case '30D':
      points = 90
      intervalMs = 8 * 60 * 60 * 1000 // 8 hours
      break
  }

  const result: NavPoint[] = []
  let value = baseValue * 0.93 // start ~7% below

  for (let i = points; i >= 0; i--) {
    const timestamp = now - i * intervalMs
    const date = new Date(timestamp)

    let label: string
    if (period === '24H') {
      label = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    } else if (period === '7D') {
      label = date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', hour12: false })
    } else {
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    // Random walk with upward bias
    const change = (Math.random() - 0.42) * (baseValue * 0.01)
    value = Math.max(value + change, baseValue * 0.5)

    result.push({
      time: label,
      value: Math.round(value * 100) / 100,
      timestamp: Math.floor(timestamp / 1000),
    })
  }

  // Ensure last point is close to baseValue
  if (result.length > 0) {
    result[result.length - 1].value = baseValue
  }

  return result
}
