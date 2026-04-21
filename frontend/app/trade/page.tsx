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
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react'

const TVChart = nextDynamic(
  () => import('@/components/TVChart').then((m) => m.TVChart),
  { ssr: false, loading: () => <ChartLoader /> }
)
const OrderBook = nextDynamic(
  () => import('@/components/OrderBook').then((m) => m.OrderBook),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center"><span className="font-mono text-2xs animate-pulse" style={{ color: 'var(--ink-3)' }}>Loading...</span></div> }
)

// ─── Types ──────────────────────────────────────────────────────────────────

type Asset = 'ETH' | 'BTC'
type Tab = 'positions' | 'history'

interface Ticker {
  lastPrice: number
  priceChange: number
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
}

// ─── Loaders ────────────────────────────────────────────────────────────────

function ChartLoader() {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-3"
      style={{ background: 'var(--bg)' }}
    >
      <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--arc)', borderTopColor: 'transparent' }} />
      <span className="font-mono text-xs" style={{ color: 'var(--ink-3)' }}>Loading chart...</span>
    </div>
  )
}

// ─── 24h Ticker data (Binance REST) ─────────────────────────────────────────

function useTicker(asset: Asset) {
  const [ticker, setTicker] = useState<Ticker | null>(null)
  const [prev, setPrev] = useState<number | null>(null)

  const sym = asset === 'ETH' ? 'ETHUSDT' : 'BTCUSDT'

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`)
      const d = await r.json()
      setTicker({
        lastPrice: parseFloat(d.lastPrice),
        priceChange: parseFloat(d.priceChange),
        priceChangePercent: parseFloat(d.priceChangePercent),
        highPrice: parseFloat(d.highPrice),
        lowPrice: parseFloat(d.lowPrice),
        volume: parseFloat(d.volume),
        quoteVolume: parseFloat(d.quoteVolume),
      })
    } catch {}
  }, [sym])

  useEffect(() => {
    fetch_()
    const iv = setInterval(fetch_, 5_000)
    return () => clearInterval(iv)
  }, [fetch_])

  // Live price via WebSocket
  useEffect(() => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym.toLowerCase()}@trade`)
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data)
        const newPrice = parseFloat(d.p)
        setTicker((prev_) => {
          if (!prev_) return prev_
          setPrev(prev_.lastPrice)
          return { ...prev_, lastPrice: newPrice }
        })
      } catch {}
    }
    ws.onerror = () => ws.close()
    return () => ws.close()
  }, [sym])

  return { ticker, prev }
}

// ─── Market header bar ────────────────────────────────────────────────────────

function MarketHeader({
  asset,
  onSelect,
}: {
  asset: Asset
  onSelect: (a: Asset) => void
}) {
  const { ticker, prev } = useTicker(asset)
  const isUp = ticker && prev ? ticker.lastPrice >= prev : true
  const isPositive = ticker ? ticker.priceChangePercent >= 0 : true

  const fmt = (n: number, dec = 2) =>
    n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  const fmtVol = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    return `$${n.toFixed(0)}`
  }

  return (
    <div
      className="flex items-center gap-0 border-b shrink-0 overflow-x-auto"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '52px', minHeight: '52px' }}
    >
      {/* Market tabs */}
      {(['ETH', 'BTC'] as Asset[]).map((a) => (
        <button
          key={a}
          onClick={() => onSelect(a)}
          className="flex items-center gap-2 px-4 h-full border-r font-mono text-xs transition-all shrink-0"
          style={{
            borderColor: 'var(--border)',
            background: asset === a ? 'var(--surface-2)' : 'transparent',
            color: asset === a ? 'var(--ink)' : 'var(--ink-2)',
            position: 'relative',
          }}
        >
          {asset === a && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ background: 'var(--arc)' }}
            />
          )}
          <span className="font-semibold">{a}-PERP</span>
          <span style={{ color: 'var(--ink-3)', fontSize: '0.6rem' }}>USDC</span>
        </button>
      ))}

      {/* Divider */}
      <div className="h-6 w-px mx-2 shrink-0" style={{ background: 'var(--border-2)' }} />

      {/* Price */}
      <div className="px-3 shrink-0">
        <div
          className="font-mono text-lg font-medium tabular-nums transition-colors duration-200"
          style={{
            color: isUp ? 'var(--gain)' : 'var(--loss)',
            textShadow: isUp ? '0 0 12px rgba(29,184,122,0.3)' : '0 0 12px rgba(201,78,78,0.3)',
          }}
        >
          {ticker ? `$${fmt(ticker.lastPrice, asset === 'ETH' ? 2 : 1)}` : '—'}
        </div>
        <div
          className="font-mono text-2xs"
          style={{ color: isPositive ? 'var(--gain)' : 'var(--loss)' }}
        >
          {ticker
            ? `${isPositive ? '+' : ''}${ticker.priceChangePercent.toFixed(2)}%`
            : '—'}
        </div>
      </div>

      {/* Stats */}
      {ticker && (
        <div className="flex items-center gap-6 px-4 overflow-x-auto">
          {[
            { label: '24h Change', value: `${ticker.priceChange >= 0 ? '+' : ''}$${fmt(ticker.priceChange)}`, color: isPositive ? 'var(--gain)' : 'var(--loss)' },
            { label: '24h High', value: `$${fmt(ticker.highPrice, asset === 'ETH' ? 2 : 1)}`, color: 'var(--ink)' },
            { label: '24h Low', value: `$${fmt(ticker.lowPrice, asset === 'ETH' ? 2 : 1)}`, color: 'var(--ink)' },
            { label: '24h Volume', value: fmtVol(ticker.quoteVolume), color: 'var(--ink-2)' },
          ].map((s) => (
            <div key={s.label} className="shrink-0">
              <div className="font-mono text-2xs uppercase tracking-widest mb-0.5" style={{ color: 'var(--ink-3)' }}>
                {s.label}
              </div>
              <div className="font-mono text-xs tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Arc Testnet badge */}
      <div className="flex items-center gap-1.5 px-4 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full hermes-alive" style={{ background: 'var(--gain)' }} />
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Arc Testnet</span>
      </div>
    </div>
  )
}

// ─── Position row ─────────────────────────────────────────────────────────────

function PositionRow({
  positionId,
  asset,
  onClose,
  isClosing,
}: {
  positionId: bigint
  asset: Asset
  onClose: (id: bigint) => void
  isClosing: boolean
}) {
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)

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

  // Subscribe to live price
  useEffect(() => {
    if (!pos) return
    const [,, market] = pos
    const mkt = formatMarket(market as `0x${string}`).split('/')[0]
    const sym = mkt === 'BTC' ? 'btcusdt' : 'ethusdt'
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@miniTicker`)
    ws.onmessage = (e) => {
      try { setCurrentPrice(parseFloat(JSON.parse(e.data).c)) } catch {}
    }
    ws.onerror = () => ws.close()

    const refetchIv = setInterval(() => { refetchPos(); refetchPnl() }, 5_000)
    return () => { ws.close(); clearInterval(refetchIv) }
  }, [pos, refetchPos, refetchPnl])

  if (!pos) return (
    <tr>
      <td colSpan={9} className="px-4 py-3">
        <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
      </td>
    </tr>
  )

  const [id, , market, isLong, size, entryPrice, leverage, collateral, openedAt, isOpen] = pos
  if (!isOpen) return null

  const pnlNum = pnlRaw !== undefined ? Number(pnlRaw) / 1e6 : 0
  const collateralNum = Number(collateral) / 1e6
  const sizeNum = Number(size) / 1e6
  const entryNum = Number(entryPrice) / 1e8
  const levNum = Number(leverage)
  const pnlPct = collateralNum > 0 ? (pnlNum / collateralNum) * 100 : 0
  const liqBuffer = 1 / levNum
  const liqPrice = isLong ? entryNum * (1 - liqBuffer) : entryNum * (1 + liqBuffer)
  const marketStr = formatMarket(market as `0x${string}`)
  const isProfit = pnlNum >= 0
  const pnlColor = isProfit ? 'var(--gain)' : 'var(--loss)'
  const dirColor = isLong ? 'var(--gain)' : 'var(--loss)'

  const fmtP = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

  return (
    <tr
      className="border-t transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Market */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-2xs px-1.5 py-0.5 rounded-sm font-bold"
            style={{
              color: dirColor,
              background: isLong ? 'rgba(29,184,122,0.1)' : 'rgba(201,78,78,0.1)',
              border: `1px solid ${isLong ? 'rgba(29,184,122,0.2)' : 'rgba(201,78,78,0.2)'}`,
            }}
          >
            {isLong ? 'LONG' : 'SHORT'}
          </span>
          <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>{marketStr}</span>
        </div>
        <div className="font-mono text-2xs mt-0.5" style={{ color: 'var(--ink-3)' }}>#{id.toString()} · {timeAgo(Number(openedAt))}</div>
      </td>

      {/* Size */}
      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--ink)' }}>
        ${sizeNum.toLocaleString('en-US', { maximumFractionDigits: 2 })}
      </td>

      {/* Collateral */}
      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--ink-2)' }}>
        ${collateralNum.toFixed(2)}
      </td>

      {/* Leverage */}
      <td className="px-4 py-3">
        <span
          className="font-mono text-2xs px-1.5 py-0.5 rounded-sm"
          style={{ color: 'var(--arc)', background: 'rgba(110,95,240,0.1)', border: '1px solid rgba(110,95,240,0.2)' }}
        >
          {levNum}×
        </span>
      </td>

      {/* Entry Price */}
      <td className="px-4 py-3 font-mono text-xs tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {fmtP(entryNum)}
      </td>

      {/* Mark Price */}
      <td className="px-4 py-3 font-mono text-xs tabular-nums" style={{ color: 'var(--ink)' }}>
        {currentPrice ? fmtP(currentPrice) : '—'}
      </td>

      {/* Liq Price */}
      <td className="px-4 py-3 font-mono text-xs tabular-nums" style={{ color: '#c94e4e', opacity: 0.8 }}>
        {fmtP(liqPrice)}
      </td>

      {/* P&L */}
      <td className="px-4 py-3">
        <div className="font-mono text-xs font-medium tabular-nums" style={{ color: pnlColor }}>
          {isProfit ? '+' : ''}${Math.abs(pnlNum).toFixed(2)}
        </div>
        <div className="font-mono text-2xs" style={{ color: pnlColor, opacity: 0.7 }}>
          {isProfit ? '+' : ''}{Math.abs(pnlPct).toFixed(2)}%
        </div>
      </td>

      {/* Close */}
      <td className="px-4 py-3">
        <button
          onClick={() => onClose(positionId)}
          disabled={isClosing}
          className="font-mono text-2xs px-3 py-1.5 rounded-sm transition-all disabled:opacity-40"
          style={{
            color: '#c94e4e',
            border: '1px solid rgba(201,78,78,0.25)',
            background: 'rgba(201,78,78,0.06)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,78,78,0.15)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,78,78,0.06)' }}
        >
          {isClosing ? '...' : 'Close'}
        </button>
      </td>
    </tr>
  )
}

// ─── Positions panel (bottom) ─────────────────────────────────────────────────

function PositionsPanel({
  tab,
  onTabChange,
  positionIds,
  asset,
  onClose,
  closingId,
  isLoading,
  onRefresh,
}: {
  tab: Tab
  onTabChange: (t: Tab) => void
  positionIds: readonly bigint[]
  asset: Asset
  onClose: (id: bigint) => void
  closingId: bigint | null
  isLoading: boolean
  onRefresh: () => void
}) {
  return (
    <div
      className="border-t flex flex-col"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '200px', maxHeight: '280px' }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center gap-0 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', height: '38px' }}
      >
        {([['positions', 'Positions'], ['history', 'Trade History']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className="relative px-4 h-full font-mono text-xs transition-all"
            style={{
              color: tab === t ? 'var(--ink)' : 'var(--ink-2)',
              background: 'transparent',
            }}
          >
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--arc)' }} />
            )}
            {label}
            {t === 'positions' && positionIds.length > 0 && (
              <span
                className="ml-1.5 font-mono text-2xs px-1 py-0.5 rounded-full"
                style={{ color: 'var(--arc)', background: 'rgba(110,95,240,0.1)' }}
              >
                {positionIds.length}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onRefresh}
          className="px-3 h-full flex items-center gap-1.5 font-mono text-2xs transition-all"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)' }}
        >
          <RefreshCw size={11} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
        <Link
          href="/app"
          className="px-3 h-full flex items-center gap-1.5 font-mono text-2xs border-l transition-all"
          style={{ color: 'var(--arc)', borderColor: 'var(--border)' }}
        >
          + Open via ARCANA
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === 'positions' && (
          positionIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
              <span className="font-mono text-xs" style={{ color: 'var(--ink-2)' }}>No open positions</span>
              <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
                Use ARCANA agent to open positions on Arc Testnet
              </span>
              <Link
                href="/app"
                className="mt-2 font-mono text-2xs px-4 py-1.5 rounded-sm border transition-all"
                style={{ color: 'var(--arc)', borderColor: 'rgba(110,95,240,0.25)' }}
              >
                Open ARCANA →
              </Link>
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Market / Side', 'Size', 'Collateral', 'Lev', 'Entry Price', 'Mark Price', 'Liq. Price', 'P&L', 'Action'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left font-normal"
                      style={{ color: 'var(--ink-3)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positionIds.map((id) => (
                  <PositionRow
                    key={id.toString()}
                    positionId={id}
                    asset={asset}
                    onClose={onClose}
                    isClosing={closingId === id}
                  />
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'history' && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <span className="font-mono text-xs" style={{ color: 'var(--ink-2)' }}>Trade history coming soon</span>
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-2xs mt-1 transition-colors"
              style={{ color: 'var(--arc)' }}
            >
              View on ArcScan <ExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ARCANA right panel ────────────────────────────────────────────────────────

function ArcanaPanel({ asset }: { asset: Asset }) {
  const { data: activeStrategyIndex } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'activeStrategy',
  })
  const { data: totalAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  })
  const { data: totalTrades } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalTradesExecuted',
  })
  const { data: lastCycle } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'lastHermesCycle',
  })

  const NAMES = ['APOLLO', 'ATLAS', 'ARES'] as const
  const COLORS: Record<string, string> = { APOLLO: '#6e5ff0', ATLAS: '#3d9ac2', ARES: '#c94e4e' }
  const RISK: Record<string, string> = { APOLLO: '3× Long', ATLAS: '5× L+S', ARES: '10× L+S' }
  const stratName = activeStrategyIndex !== undefined ? NAMES[Number(activeStrategyIndex)] : null
  const accent = stratName ? COLORS[stratName] : 'var(--hermes)'
  const tvl = totalAssets ? (Number(totalAssets) / 1e6).toFixed(2) : '—'

  const quickActions = [
    { label: `Long ${asset} · 50 USDC`, msg: `long ${asset} 50 USDC`, color: 'var(--gain)' },
    { label: `Long ${asset} · 100 USDC`, msg: `long ${asset} 100 USDC`, color: 'var(--gain)' },
    { label: `Short ${asset} · 50 USDC`, msg: `short ${asset} 50 USDC`, color: 'var(--loss)' },
    { label: 'Close all positions', msg: 'close all positions', color: 'var(--ink-2)' },
  ]

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Agent status */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="h-2 w-2 rounded-full hermes-alive" style={{ background: accent }} />
          <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>ARCANA</span>
          <span className="font-mono text-2xs" style={{ color: accent }}>Hermes 3</span>
        </div>

        {stratName && (
          <div
            className="flex items-center justify-between px-3 py-2 rounded-sm"
            style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}
          >
            <div>
              <div className="font-mono text-2xs uppercase tracking-widest" style={{ color: accent, opacity: 0.7 }}>Active Strategy</div>
              <div className="font-mono text-sm font-medium mt-0.5" style={{ color: accent }}>{stratName}</div>
            </div>
            <div>
              <div className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>{RISK[stratName]}</div>
              <Link
                href="/agent"
                className="font-mono text-2xs mt-0.5 block transition-colors"
                style={{ color: accent }}
              >
                Change →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Vault stats */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="font-mono text-2xs uppercase tracking-widest mb-2.5" style={{ color: 'var(--ink-3)' }}>
          Vault
        </div>
        <div className="space-y-2">
          {[
            { label: 'TVL', value: `$${tvl}` },
            { label: 'Total Trades', value: totalTrades?.toString() ?? '—' },
            { label: 'Last Cycle', value: lastCycle && Number(lastCycle) > 0 ? timeAgo(Number(lastCycle)) : '—' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>{row.label}</span>
              <span className="font-mono text-xs" style={{ color: 'var(--ink)' }}>{row.value}</span>
            </div>
          ))}
        </div>
        <Link
          href="/vault"
          className="mt-3 w-full flex items-center justify-center gap-1.5 font-mono text-2xs py-2 rounded-sm border transition-all"
          style={{ color: 'var(--arc)', borderColor: 'rgba(110,95,240,0.2)', background: 'rgba(110,95,240,0.05)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.1)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.05)' }}
        >
          Manage Vault →
        </Link>
      </div>

      {/* Quick actions */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="font-mono text-2xs uppercase tracking-widest mb-2.5" style={{ color: 'var(--ink-3)' }}>
          Quick Actions
        </div>
        <div className="space-y-2">
          {quickActions.map((a) => (
            <Link
              key={a.msg}
              href={`/app?msg=${encodeURIComponent(a.msg)}`}
              className="w-full flex items-center justify-between px-3 py-2 rounded-sm font-mono text-2xs border transition-all"
              style={{
                color: a.color,
                borderColor: `${a.color}20`,
                background: `${a.color}08`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${a.color}15` }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${a.color}08` }}
            >
              <span>{a.label}</span>
              <span style={{ opacity: 0.5 }}>→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Chat CTA */}
      <div className="px-4 py-4">
        <Link
          href="/app"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-mono text-xs tracking-widest uppercase transition-all"
          style={{
            background: 'var(--arc)',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(110,95,240,0.3)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
        >
          <span className="arc-alive inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
          Open ARCANA Agent
        </Link>
        <p className="font-mono text-2xs mt-2 text-center leading-relaxed" style={{ color: 'var(--ink-3)' }}>
          ARCANA manages positions autonomously based on your chosen strategy
        </p>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TradePage() {
  const { isConnected } = useAccount()
  const [asset, setAsset] = useState<Asset>('ETH')
  const [tab, setTab] = useState<Tab>('positions')
  const [closingId, setClosingId] = useState<bigint | null>(null)
  const [showOrderBook, setShowOrderBook] = useState(true)

  const tvSymbol = asset === 'ETH' ? 'BINANCE:ETHUSD' : 'BINANCE:BTCUSD'
  const bncSymbol = asset === 'ETH' ? 'ETHUSDT' : 'BTCUSDT'

  const {
    data: positionIds,
    isLoading: posLoading,
    refetch: refetchPositions,
  } = useReadContract({
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

  const handleClose = useCallback(
    async (positionId: bigint) => {
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
    },
    [writeContract]
  )

  const ids = positionIds ?? []

  if (!isConnected) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] mx-auto max-w-md gap-6 px-4"
      >
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(110,95,240,0.08)', border: '1px solid rgba(110,95,240,0.2)' }}
        >
          <span className="font-mono text-2xl" style={{ color: 'var(--arc)', opacity: 0.6 }}>◉</span>
        </div>
        <div className="text-center">
          <p className="font-mono text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Connect your wallet</p>
          <p className="font-mono text-xs" style={{ color: 'var(--ink-3)' }}>
            Connect to Arc Testnet to view positions and interact with ARCANA
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', background: 'var(--bg)' }}
    >
      {/* Market header */}
      <MarketHeader asset={asset} onSelect={setAsset} />

      {/* Main exchange area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Order book (collapsible) */}
        {showOrderBook && (
          <div
            className="border-r shrink-0"
            style={{ width: '200px', borderColor: 'var(--border)', overflow: 'hidden' }}
          >
            <OrderBook symbol={bncSymbol as 'ETHUSDT' | 'BTCUSDT'} />
          </div>
        )}

        {/* Chart */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Chart toolbar */}
          <div
            className="flex items-center gap-3 px-3 py-1.5 border-b shrink-0"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '36px' }}
          >
            <button
              onClick={() => setShowOrderBook((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-2xs px-2 py-1 rounded-sm border transition-all"
              style={{
                color: showOrderBook ? 'var(--arc)' : 'var(--ink-3)',
                borderColor: showOrderBook ? 'rgba(110,95,240,0.25)' : 'var(--border)',
                background: showOrderBook ? 'rgba(110,95,240,0.06)' : 'transparent',
              }}
            >
              {showOrderBook ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
              Order Book
            </button>
            <div className="h-3 w-px" style={{ background: 'var(--border)' }} />
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
              {tvSymbol} · TradingView
            </span>
            <div className="flex-1" />
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
              {ids.length} position{ids.length !== 1 ? 's' : ''} open
            </span>
          </div>

          {/* TradingView chart */}
          <div className="flex-1 min-h-0">
            <TVChart symbol={tvSymbol} interval="15" />
          </div>
        </div>

        {/* ARCANA panel */}
        <div
          className="shrink-0 overflow-y-auto"
          style={{ width: '260px', borderLeft: '1px solid var(--border)' }}
        >
          <ArcanaPanel asset={asset} />
        </div>
      </div>

      {/* Positions panel */}
      <PositionsPanel
        tab={tab}
        onTabChange={setTab}
        positionIds={ids}
        asset={asset}
        onClose={handleClose}
        closingId={closingId}
        isLoading={posLoading}
        onRefresh={refetchPositions}
      />
    </div>
  )
}
