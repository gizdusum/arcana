'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import {
  VAULT_ADDRESS,
  PERP_ENGINE_ADDRESS,
  PERP_ENGINE_ABI,
  VAULT_ABI,
} from '@/lib/contracts'
import { formatMarket, timeAgo } from '@/lib/utils'
import { AreaChart, Area, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts'

// Lazy-load the trading chart (client-only)
const TradingChart = nextDynamic(
  () => import('@/components/TradingChart').then((m) => m.TradingChart),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center"><span className="font-mono text-xs animate-pulse" style={{ color: 'var(--ink-3)' }}>Loading chart...</span></div> }
)

// ─── Types ─────────────────────────────────────────────────────────────────

type Prices = { btc: number; eth: number; btcChg: number; ethChg: number }

function useLivePrices() {
  const [prices, setPrices] = useState<Prices | null>(null)
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
      )
      const d = await r.json()
      setPrices({
        btc: d.bitcoin.usd,
        eth: d.ethereum.usd,
        btcChg: d.bitcoin.usd_24h_change ?? 0,
        ethChg: d.ethereum.usd_24h_change ?? 0,
      })
    } catch {}
  }, [])
  useEffect(() => { fetch_(); const iv = setInterval(fetch_, 15_000); return () => clearInterval(iv) }, [fetch_])
  return prices
}

// ─── Market selector bar ───────────────────────────────────────────────────

function MarketBar({
  selected,
  onSelect,
  prices,
}: {
  selected: 'BTC' | 'ETH'
  onSelect: (a: 'BTC' | 'ETH') => void
  prices: Prices | null
}) {
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = (n: number) => (n >= 0 ? '+' : '')

  const markets: { sym: 'BTC' | 'ETH'; id: string }[] = [
    { sym: 'BTC', id: 'bitcoin' },
    { sym: 'ETH', id: 'ethereum' },
  ]

  return (
    <div
      className="flex items-center gap-0 border-b shrink-0"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '52px' }}
    >
      {markets.map(({ sym }) => {
        const price = sym === 'BTC' ? prices?.btc : prices?.eth
        const chg = sym === 'BTC' ? prices?.btcChg : prices?.ethChg
        const active = selected === sym
        return (
          <button
            key={sym}
            onClick={() => onSelect(sym)}
            className="relative flex items-center gap-3 px-5 h-full border-r font-mono transition-all"
            style={{
              borderColor: 'var(--border)',
              background: active ? 'var(--surface-2)' : 'transparent',
            }}
          >
            {active && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: 'var(--arc)' }}
              />
            )}
            <div className="text-left">
              <div className="text-sm font-medium" style={{ color: active ? 'var(--ink)' : 'var(--ink-2)' }}>
                {sym}/USDC
              </div>
              {price && (
                <div className="flex items-center gap-1.5 text-2xs">
                  <span style={{ color: 'var(--ink)' }}>${fmt(price)}</span>
                  <span style={{ color: (chg ?? 0) >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                    {sign(chg ?? 0)}{(chg ?? 0).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </button>
        )
      })}

      <div className="flex-1" />

      {/* Live indicator */}
      <div className="flex items-center gap-2 px-5">
        <span className="h-1.5 w-1.5 rounded-full hermes-alive" style={{ background: 'var(--gain)' }} />
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Live · 15s</span>
      </div>
    </div>
  )
}

// ─── Position detail panel ─────────────────────────────────────────────────

function PositionPanel({
  positionId,
  prices,
  onClose,
  isClosing,
}: {
  positionId: bigint
  prices: Prices | null
  onClose: (id: bigint) => void
  isClosing: boolean
}) {
  const [priceHistory, setPriceHistory] = useState<{ t: number; price: number }[]>([])
  const marketRef = useRef<string | null>(null)
  const pricesRef = useRef(prices)
  pricesRef.current = prices

  const { data: pos, refetch: refetchPos } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'positions',
    args: [positionId],
  })
  const { data: pnlRaw, refetch: refetchPnl } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'getUnrealizedPnL',
    args: [positionId],
  })

  useEffect(() => {
    if (pos) {
      const [,, market] = pos
      marketRef.current = formatMarket(market as `0x${string}`).split('/')[0] ?? 'ETH'
    }
  }, [pos])

  useEffect(() => {
    if (!prices || !marketRef.current) return
    const price = marketRef.current === 'BTC' ? prices.btc : prices.eth
    setPriceHistory((prev) => [...prev.slice(-120), { t: Date.now(), price }])
  }, [prices])

  useEffect(() => {
    const iv = setInterval(() => {
      refetchPos()
      refetchPnl()
      const p = pricesRef.current
      if (!p || !marketRef.current) return
      const price = marketRef.current === 'BTC' ? p.btc : p.eth
      setPriceHistory((prev) => [...prev.slice(-120), { t: Date.now(), price }])
    }, 5_000)
    return () => clearInterval(iv)
  }, [refetchPos, refetchPnl])

  if (!pos) return null

  const [id, , market, isLong, size, entryPrice, leverage, collateral, openedAt, isOpen] = pos
  if (!isOpen) return null

  const pnlNum = pnlRaw !== undefined ? Number(pnlRaw) / 1e6 : 0
  const collateralNum = Number(collateral) / 1e6
  const sizeNum = Number(size) / 1e6
  const entryPriceNum = Number(entryPrice) / 1e8
  const levNum = Number(leverage)
  const pnlPct = collateralNum > 0 ? (pnlNum / collateralNum) * 100 : 0
  const isProfit = pnlNum >= 0
  const dirColor = isLong ? 'var(--gain)' : 'var(--loss)'
  const pnlColor = isProfit ? 'var(--gain)' : 'var(--loss)'
  const marketStr = formatMarket(market as `0x${string}`)
  const asset = marketStr.split('/')[0] ?? 'ETH'
  const currentPrice = prices ? (asset === 'BTC' ? prices.btc : prices.eth) : null
  const liqBuffer = 1 / levNum
  const liqPrice = isLong ? entryPriceNum * (1 - liqBuffer) : entryPriceNum * (1 + liqBuffer)

  const allPrices = priceHistory.map((p) => p.price)
  const minP = allPrices.length ? Math.min(...allPrices, entryPriceNum) : entryPriceNum
  const maxP = allPrices.length ? Math.max(...allPrices, entryPriceNum) : entryPriceNum
  const pad = (maxP - minP) * 0.3 || entryPriceNum * 0.002
  const yDomain: [number, number] = [minP - pad, maxP + pad]
  const gradId = `grad-${positionId}`

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{
        border: `1px solid var(--border)`,
        background: 'var(--surface)',
        boxShadow: `0 2px 16px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Position header */}
      <div
        className="flex items-center px-4 py-3 gap-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      >
        <span
          className="font-mono text-xs font-bold px-2 py-0.5 rounded-sm"
          style={{ color: dirColor, background: `${isLong ? 'rgba(29,184,122,' : 'rgba(201,78,78,'}0.12)`, border: `1px solid ${isLong ? 'rgba(29,184,122,' : 'rgba(201,78,78,'}0.25)` }}
        >
          {isLong ? 'LONG' : 'SHORT'}
        </span>
        <span className="font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>{marketStr}</span>
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>{levNum}×</span>
        <div className="flex-1" />
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>#{id.toString()} · {timeAgo(Number(openedAt))}</span>
      </div>

      {/* P&L hero */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-end justify-between mb-1">
          <div>
            <span
              className="font-mono text-3xl font-light tabular-nums"
              style={{ color: pnlColor, textShadow: `0 0 20px ${isProfit ? 'rgba(29,184,122,' : 'rgba(201,78,78,'}0.3)`, transition: 'color 0.3s' }}
            >
              {pnlNum >= 0 ? '+' : ''}${Math.abs(pnlNum).toFixed(2)}
            </span>
            <span className="font-mono text-sm ml-2 mb-0.5 inline-block" style={{ color: pnlColor, opacity: 0.7 }}>
              {pnlNum >= 0 ? '+' : ''}{Math.abs(pnlPct).toFixed(2)}%
            </span>
          </div>
          {currentPrice && (
            <div className="text-right">
              <div className="font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>Current</div>
            </div>
          )}
        </div>
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Unrealized P&L</span>
      </div>

      {/* Mini sparkline */}
      <div className="px-4 pb-3 pt-1">
        <div
          className="rounded-sm overflow-hidden"
          style={{ height: '72px', border: `1px solid var(--border)`, background: 'var(--bg)' }}
        >
          {priceHistory.length < 2 ? (
            <div className="h-full flex items-center justify-center">
              <span className="font-mono text-2xs animate-pulse" style={{ color: 'var(--ink-3)' }}>collecting data...</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isLong ? '#1db87a' : '#c94e4e'} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={isLong ? '#1db87a' : '#c94e4e'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceLine
                  y={entryPriceNum}
                  stroke={isLong ? '#1db87a' : '#c94e4e'}
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isLong ? '#1db87a' : '#c94e4e'}
                  strokeWidth={1.5}
                  fill={`url(#${gradId})`}
                  dot={false}
                  isAnimationActive={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div
                        className="font-mono text-2xs px-2 py-1 rounded-sm"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                      >
                        ${(payload[0].value as number).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    )
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex justify-between mt-1">
          <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Entry ${entryPriceNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          <span className="font-mono text-2xs" style={{ color: '#c94e4e', opacity: 0.7 }}>Liq. ${liqPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px mx-4 mb-4 rounded-sm overflow-hidden" style={{ background: 'var(--border)' }}>
        {[
          { label: 'Size', value: `$${sizeNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
          { label: 'Collateral', value: `$${collateralNum.toFixed(2)}` },
          { label: 'Entry Price', value: `$${entryPriceNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
          { label: 'Liq. Price', value: `$${liqPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, color: '#c94e4e' },
        ].map((m) => (
          <div key={m.label} className="px-3 py-2.5" style={{ background: 'var(--surface)' }}>
            <div className="font-mono text-2xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--ink-3)' }}>{m.label}</div>
            <div className="font-mono text-xs font-medium" style={{ color: m.color ?? 'var(--ink)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Close button */}
      <div className="px-4 pb-4">
        <button
          onClick={() => onClose(positionId)}
          disabled={isClosing}
          className="w-full font-mono text-xs py-2.5 rounded-sm transition-all disabled:opacity-40"
          style={{ border: '1px solid rgba(201,78,78,0.3)', color: '#c94e4e', background: 'rgba(201,78,78,0.06)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,78,78,0.12)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,78,78,0.06)' }}
        >
          {isClosing ? 'closing...' : 'Close Position'}
        </button>
      </div>
    </div>
  )
}

// ─── No positions state ────────────────────────────────────────────────────

function EmptyPanel() {
  return (
    <div
      className="rounded-sm flex flex-col items-center justify-center py-16 text-center"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center mb-5"
        style={{ background: 'rgba(110,95,240,0.08)', border: '1px solid rgba(110,95,240,0.15)' }}
      >
        <span className="font-mono text-lg" style={{ color: 'var(--arc)', opacity: 0.5 }}>∅</span>
      </div>
      <p className="font-mono text-sm mb-1" style={{ color: 'var(--ink-2)' }}>No open positions</p>
      <p className="font-mono text-2xs mb-6" style={{ color: 'var(--ink-3)' }}>
        Positions appear here when ARCANA opens a trade
      </p>
      <Link
        href="/app"
        className="font-mono text-xs border px-4 py-2 rounded-sm transition-all"
        style={{ color: 'var(--arc)', borderColor: 'rgba(110,95,240,0.2)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.06)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        Open new position →
      </Link>
    </div>
  )
}

// ─── Agent status bar ──────────────────────────────────────────────────────

function AgentBar() {
  const { data: activeStrategyIndex } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'activeStrategy' })
  const { data: totalTrades } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalTradesExecuted' })
  const { data: lastCycle } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lastHermesCycle' })

  const NAMES = ['APOLLO', 'ATLAS', 'ARES'] as const
  const COLORS: Record<string, string> = { APOLLO: '#6e5ff0', ATLAS: '#3d9ac2', ARES: '#c94e4e' }
  const stratName = activeStrategyIndex !== undefined ? NAMES[Number(activeStrategyIndex)] : null
  const accent = stratName ? COLORS[stratName] : 'var(--hermes)'

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b text-xs font-mono shrink-0"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <span className="h-2 w-2 rounded-full hermes-alive" style={{ background: accent }} />
      <span style={{ color: accent }}>ARCANA</span>
      {stratName && (
        <>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <span style={{ color: 'var(--ink)' }}>{stratName}</span>
        </>
      )}
      {lastCycle && Number(lastCycle) > 0 && (
        <>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <span style={{ color: 'var(--ink-2)' }}>Last cycle {timeAgo(Number(lastCycle))}</span>
        </>
      )}
      {totalTrades !== undefined && (
        <>
          <span style={{ color: 'var(--border-2)' }}>·</span>
          <span style={{ color: 'var(--ink-2)' }}>{totalTrades.toString()} trades</span>
        </>
      )}
      <div className="flex-1" />
      <Link href="/app" className="transition-colors" style={{ color: 'var(--ink-2)' }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--ink)' }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--ink-2)' }}
      >
        + New Position
      </Link>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function TradePage() {
  const { isConnected } = useAccount()
  const prices = useLivePrices()
  const [selectedAsset, setSelectedAsset] = useState<'BTC' | 'ETH'>('ETH')
  const [closingId, setClosingId] = useState<bigint | null>(null)

  const { data: positionIds, refetch: refetchPositions } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'getVaultOpenPositions',
    args: VAULT_ADDRESS ? [VAULT_ADDRESS] : undefined,
    query: { enabled: !!VAULT_ADDRESS },
  })

  useEffect(() => {
    const iv = setInterval(refetchPositions, 10_000)
    return () => clearInterval(iv)
  }, [refetchPositions])

  const { writeContract, data: closeTx } = useWriteContract()
  const { isSuccess: closeSuccess } = useWaitForTransactionReceipt({ hash: closeTx })

  useEffect(() => {
    if (closeSuccess) { setClosingId(null); refetchPositions() }
  }, [closeSuccess, refetchPositions])

  const handleClose = useCallback(async (positionId: bigint) => {
    if (!VAULT_ADDRESS) return
    setClosingId(positionId)
    try {
      writeContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'closePosition' as never,
        args: [positionId] as never,
      })
    } catch { setClosingId(null) }
  }, [writeContract])

  const ids = positionIds ?? []

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div
          className="flex flex-col items-center justify-center min-h-[400px] rounded-sm border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="font-mono text-sm mb-1" style={{ color: 'var(--ink-2)' }}>Connect wallet to view positions</p>
          <p className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Your open trades appear here in real-time</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
      <AgentBar />
      <MarketBar selected={selectedAsset} onSelect={setSelectedAsset} prices={prices} />

      {/* Main exchange layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chart */}
          <div className="flex-1 min-h-0 relative" style={{ background: 'var(--bg)' }}>
            <TradingChart
              asset={selectedAsset}
              accent="var(--arc)"
            />
          </div>

          {/* Bottom: positions table */}
          <div
            className="border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', height: '220px', overflow: 'auto' }}
          >
            {/* Table header */}
            <div
              className="flex items-center px-4 py-2.5 border-b gap-4 sticky top-0 z-10"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>
                Open Positions
              </span>
              {ids.length > 0 && (
                <span
                  className="font-mono text-2xs px-1.5 py-0.5 rounded-full"
                  style={{ color: 'var(--arc)', background: 'rgba(110,95,240,0.1)' }}
                >
                  {ids.length}
                </span>
              )}
              <div className="flex-1" />
              <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
                P&L updates every 5s
              </span>
            </div>

            {ids.length === 0 ? (
              <div className="flex items-center justify-center h-28">
                <p className="font-mono text-xs" style={{ color: 'var(--ink-3)' }}>No open positions</p>
              </div>
            ) : (
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Market', 'Side', 'Size', 'Entry Price', 'Lev', 'P&L', 'Action'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left"
                        style={{ color: 'var(--ink-3)', fontWeight: 400, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.6rem' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id) => (
                    <PositionRow
                      key={id.toString()}
                      positionId={id}
                      prices={prices}
                      onClose={handleClose}
                      isClosing={closingId === id}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right panel: position details */}
        <div
          className="border-l overflow-y-auto"
          style={{
            width: '300px',
            minWidth: '280px',
            borderColor: 'var(--border)',
            background: 'var(--surface)',
          }}
        >
          {/* Panel header */}
          <div
            className="px-4 py-3 border-b sticky top-0 z-10"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>Positions</span>
          </div>

          <div className="p-3 space-y-3">
            {ids.length === 0 ? (
              <EmptyPanel />
            ) : (
              ids.map((id) => (
                <PositionPanel
                  key={id.toString()}
                  positionId={id}
                  prices={prices}
                  onClose={handleClose}
                  isClosing={closingId === id}
                />
              ))
            )}
          </div>

          {/* Footer note */}
          <div className="px-4 pb-4 pt-2">
            <p className="font-mono text-2xs leading-relaxed" style={{ color: 'var(--ink-3)' }}>
              Positions managed autonomously by ARCANA. P&L is unrealized at current oracle price. Liquidation prices are estimates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Inline position row (table) ───────────────────────────────────────────

function PositionRow({
  positionId,
  prices,
  onClose,
  isClosing,
}: {
  positionId: bigint
  prices: Prices | null
  onClose: (id: bigint) => void
  isClosing: boolean
}) {
  const { data: pos } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'positions',
    args: [positionId],
  })
  const { data: pnl } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'getUnrealizedPnL',
    args: [positionId],
  })

  if (!pos) return null

  const [, , market, isLong, size, entryPrice, leverage, collateral, , isOpen] = pos
  if (!isOpen) return null

  const pnlNum = pnl !== undefined ? Number(pnl) / 1e6 : 0
  const pnlPct = Number(collateral) > 0 ? ((pnlNum / (Number(collateral) / 1e6)) * 100).toFixed(2) : '0.00'
  const sizeNum = (Number(size) / 1e6).toFixed(2)
  const entryNum = Number(entryPrice) / 1e8
  const levNum = Number(leverage)

  return (
    <tr
      className="border-t transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <td className="px-4 py-2.5" style={{ color: 'var(--ink)' }}>{formatMarket(market as `0x${string}`)}</td>
      <td className="px-4 py-2.5">
        <span
          className="font-mono text-2xs px-1.5 py-0.5 rounded-sm"
          style={{
            color: isLong ? 'var(--gain)' : 'var(--loss)',
            background: isLong ? 'rgba(29,184,122,0.1)' : 'rgba(201,78,78,0.1)',
            border: `1px solid ${isLong ? 'rgba(29,184,122,0.2)' : 'rgba(201,78,78,0.2)'}`,
          }}
        >
          {isLong ? 'LONG' : 'SHORT'}
        </span>
      </td>
      <td className="px-4 py-2.5" style={{ color: 'var(--ink)' }}>${sizeNum}</td>
      <td className="px-4 py-2.5" style={{ color: 'var(--ink-2)' }}>
        ${entryNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </td>
      <td className="px-4 py-2.5" style={{ color: 'var(--ink-2)' }}>{levNum}×</td>
      <td className="px-4 py-2.5">
        <span style={{ color: pnlNum >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
          {pnlNum >= 0 ? '+' : ''}${Math.abs(pnlNum).toFixed(2)}
          <span className="ml-1 opacity-60" style={{ color: 'var(--ink-3)' }}>
            ({pnlNum >= 0 ? '+' : ''}{pnlPct}%)
          </span>
        </span>
      </td>
      <td className="px-4 py-2.5">
        <button
          onClick={() => onClose(positionId)}
          disabled={isClosing}
          className="font-mono text-2xs px-2.5 py-1 rounded-sm transition-all disabled:opacity-40"
          style={{ color: '#c94e4e', border: '1px solid rgba(201,78,78,0.25)', background: 'rgba(201,78,78,0.06)' }}
        >
          {isClosing ? '...' : 'Close'}
        </button>
      </td>
    </tr>
  )
}
