'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  useAccount,
  useReadContract,
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
import { useOpenPositionIds } from '@/lib/useOpenPositionIds'
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react'

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
type Direction = 'long' | 'short'

interface Ticker {
  lastPrice: number
  priceChange: number
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
}

const STRAT_NAMES = ['APOLLO', 'ATLAS', 'ARES'] as const
const STRAT_ACCENTS: Record<string, string> = { APOLLO: '#6e5ff0', ATLAS: '#3d9ac2', ARES: '#c94e4e' }
const STRAT_MAX_LEV: Record<string, number> = { APOLLO: 3, ATLAS: 5, ARES: 10 }
const STRAT_LONG_ONLY: Record<string, boolean> = { APOLLO: true, ATLAS: false, ARES: false }

// ─── Loaders ────────────────────────────────────────────────────────────────

function ChartLoader() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg)' }}>
      <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--arc)', borderTopColor: 'transparent' }} />
      <span className="font-mono text-xs" style={{ color: 'var(--ink-3)' }}>Loading chart...</span>
    </div>
  )
}

// ─── 24h Ticker ─────────────────────────────────────────────────────────────

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

// ─── Market header ───────────────────────────────────────────────────────────

function MarketHeader({ asset, onSelect }: { asset: Asset; onSelect: (a: Asset) => void }) {
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
          {asset === a && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--arc)' }} />}
          <span className="font-semibold">{a}-PERP</span>
          <span style={{ color: 'var(--ink-3)', fontSize: '0.6rem' }}>USDC</span>
        </button>
      ))}

      <div className="h-6 w-px mx-2 shrink-0" style={{ background: 'var(--border-2)' }} />

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
        <div className="font-mono text-2xs" style={{ color: isPositive ? 'var(--gain)' : 'var(--loss)' }}>
          {ticker ? `${isPositive ? '+' : ''}${ticker.priceChangePercent.toFixed(2)}%` : '—'}
        </div>
      </div>

      {ticker && (
        <div className="flex items-center gap-6 px-4 overflow-x-auto">
          {[
            { label: '24h Change', value: `${ticker.priceChange >= 0 ? '+' : ''}$${fmt(ticker.priceChange)}`, color: isPositive ? 'var(--gain)' : 'var(--loss)' },
            { label: '24h High', value: `$${fmt(ticker.highPrice, asset === 'ETH' ? 2 : 1)}`, color: 'var(--ink)' },
            { label: '24h Low', value: `$${fmt(ticker.lowPrice, asset === 'ETH' ? 2 : 1)}`, color: 'var(--ink)' },
            { label: '24h Volume', value: fmtVol(ticker.quoteVolume), color: 'var(--ink-2)' },
          ].map((s) => (
            <div key={s.label} className="shrink-0">
              <div className="font-mono text-2xs uppercase tracking-widest mb-0.5" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 px-4 shrink-0">
        <span className="h-1.5 w-1.5 rounded-full hermes-alive" style={{ background: 'var(--gain)' }} />
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Arc Testnet</span>
      </div>
    </div>
  )
}

// ─── Live mark price hook ────────────────────────────────────────────────────

function useMarkPrice(market: string | null) {
  const [price, setPrice] = useState<number | null>(null)
  useEffect(() => {
    if (!market) return
    const isBtc = market.includes('BTC')
    const restSym = isBtc ? 'BTCUSDT' : 'ETHUSDT'
    const wsSym  = isBtc ? 'btcusdt'  : 'ethusdt'

    // REST cold-start: populate before WebSocket sends its first tick
    fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${restSym}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d?.price) setPrice(prev => prev === null ? Number(d.price) : prev) })
      .catch(() => {})

    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSym}@miniTicker`)
    ws.onmessage = (e) => {
      try { setPrice(parseFloat(JSON.parse(e.data).c)) } catch {}
    }
    ws.onerror = () => ws.close()
    return () => ws.close()
  }, [market])
  return price
}

// ─── Position row ─────────────────────────────────────────────────────────────

function PositionRow({
  positionId,
  onRequestClose,
  onRequestAdjust,
}: {
  positionId: bigint
  onRequestClose: (id: bigint, marketStr: string, isLong: boolean) => void
  onRequestAdjust: (id: bigint, marketStr: string, isLong: boolean) => void
}) {
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

  const marketStr = pos ? formatMarket(pos[2] as `0x${string}`) : ''
  const markPrice = useMarkPrice(pos ? marketStr : null)

  useEffect(() => {
    if (!pos) return
    const iv = setInterval(() => { refetchPos(); refetchPnl() }, 5_000)
    return () => clearInterval(iv)
  }, [pos, refetchPos, refetchPnl])

  if (!pos) return (
    <tr>
      <td colSpan={9} className="px-4 py-3">
        <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
      </td>
    </tr>
  )

  // Use explicit index access — safer with viem named tuples
  const posId = pos[0] as bigint
  const market = pos[2] as `0x${string}`
  const isLong = pos[3] as boolean
  const size = pos[4] as bigint
  const entryPrice = pos[5] as bigint
  const leverage = pos[6] as number
  const collateral = pos[7] as bigint
  const openedAt = pos[8] as bigint
  const isOpen = pos[9] as boolean
  const fundingAccrued = pos[10] as bigint

  if (!isOpen) return null

  const collateralNum = Number(collateral) / 1e6
  const sizeNum = Number(size) / 1e6
  const entryNum = Number(entryPrice) / 1e8
  // TODO(post-launch): mock oracle is only updated at trade-open. SL/TP/liquidation won't trigger between trades. Needs a periodic oracle pusher (cron or watcher) before this can be removed.
  // Client-side P&L using live mark price; falls back to on-chain pnlRaw when WebSocket not yet connected.
  const pnlNum = pnlRaw !== undefined ? Number(pnlRaw) / 1e6 : 0
  const totalPnl = markPrice !== null
    ? (isLong ? 1 : -1) * (markPrice - entryNum) / entryNum * sizeNum
    : pnlNum
  const levNum = Number(leverage)
  const pnlPct = collateralNum > 0 ? (totalPnl / collateralNum) * 100 : 0
  const liqBuffer = 1 / levNum
  const liqPrice = isLong ? entryNum * (1 - liqBuffer) : entryNum * (1 + liqBuffer)
  const isProfit = totalPnl >= 0
  const pnlColor = isProfit ? 'var(--gain)' : 'var(--loss)'
  const dirColor = isLong ? 'var(--gain)' : 'var(--loss)'

  // Health factor: how close to liquidation (0 = healthy, 100 = liquidated)
  const currentPriceFmt = markPrice ?? entryNum
  const priceDelta = isLong ? (currentPriceFmt - entryNum) : (entryNum - currentPriceFmt)
  const healthPct = Math.min(100, Math.max(0, ((entryNum * liqBuffer - Math.abs(priceDelta)) / (entryNum * liqBuffer)) * 100))

  const fmtP = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

  return (
    <tr
      className="border-t transition-colors"
      style={{ borderColor: 'var(--border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      {/* Market / Side */}
      <td className="px-4 py-2.5">
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
          <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>
            {marketStr}
          </span>
        </div>
        <div className="font-mono text-2xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
          #{posId.toString()} · {timeAgo(Number(openedAt))}
        </div>
      </td>

      {/* Size */}
      <td className="px-3 py-2.5 font-mono text-xs tabular-nums" style={{ color: 'var(--ink)' }}>
        ${sizeNum.toLocaleString('en-US', { maximumFractionDigits: 0 })}
      </td>

      {/* Collateral */}
      <td className="px-3 py-2.5 font-mono text-xs tabular-nums" style={{ color: 'var(--ink-2)' }}>
        ${collateralNum.toFixed(2)}
      </td>

      {/* Leverage */}
      <td className="px-3 py-2.5">
        <span
          className="font-mono text-2xs px-1.5 py-0.5 rounded-sm"
          style={{ color: 'var(--arc)', background: 'rgba(110,95,240,0.1)', border: '1px solid rgba(110,95,240,0.2)' }}
        >
          {levNum}×
        </span>
      </td>

      {/* Entry */}
      <td className="px-3 py-2.5 font-mono text-xs tabular-nums" style={{ color: 'var(--ink-2)' }}>
        {fmtP(entryNum)}
      </td>

      {/* Mark */}
      <td className="px-3 py-2.5 font-mono text-xs tabular-nums" style={{ color: 'var(--ink)' }}>
        {markPrice ? fmtP(markPrice) : '—'}
      </td>

      {/* Liq Price */}
      <td className="px-3 py-2.5">
        <div className="font-mono text-xs tabular-nums" style={{ color: '#e05555', opacity: 0.85 }}>
          {fmtP(liqPrice)}
        </div>
        {/* Health bar */}
        <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ width: '52px', background: 'var(--border-2)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${healthPct}%`,
              background: healthPct > 60 ? 'var(--gain)' : healthPct > 30 ? '#b8913a' : '#c94e4e',
            }}
          />
        </div>
      </td>

      {/* P&L */}
      <td className="px-3 py-2.5">
        <div className="font-mono text-xs font-medium tabular-nums" style={{ color: pnlColor }}>
          {isProfit ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
        </div>
        <div className="font-mono text-2xs" style={{ color: pnlColor, opacity: 0.7 }}>
          {isProfit ? '+' : ''}{Math.abs(pnlPct).toFixed(2)}%
        </div>
      </td>

      {/* Action */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRequestAdjust(posId, marketStr, isLong)}
            className="font-mono text-2xs px-2.5 py-1.5 rounded-sm transition-all"
            style={{
              color: 'var(--arc)',
              border: '1px solid rgba(110,95,240,0.25)',
              background: 'rgba(110,95,240,0.05)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.12)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.05)' }}
          >
            Revise
          </button>
          <button
            onClick={() => onRequestClose(posId, marketStr, isLong)}
            className="font-mono text-2xs px-2.5 py-1.5 rounded-sm transition-all"
            style={{
              color: '#e05555',
              border: '1px solid rgba(201,78,78,0.25)',
              background: 'rgba(201,78,78,0.05)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,78,78,0.12)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,78,78,0.05)' }}
          >
            Close
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Close confirm modal ──────────────────────────────────────────────────────

function CloseConfirmModal({
  positionId,
  marketStr,
  isLong,
  onConfirm,
  onCancel,
}: {
  positionId: bigint
  marketStr: string
  isLong: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel, onConfirm])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-sm rounded-sm overflow-hidden"
        style={{
          background: 'var(--surface)',
          border: '1px solid rgba(201,78,78,0.3)',
          boxShadow: '0 0 60px rgba(201,78,78,0.1), 0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(201,78,78,0.15)', background: 'rgba(201,78,78,0.06)' }}>
          <span className="font-mono text-xs font-medium tracking-widest uppercase flex-1" style={{ color: '#e05555' }}>
            Close Position #{positionId.toString()}
          </span>
          <button onClick={onCancel} className="font-mono text-sm" style={{ color: 'var(--ink-3)' }}>×</button>
        </div>
        <div className="px-5 py-5">
          <p className="font-mono text-sm mb-2" style={{ color: 'var(--ink)' }}>
            Close {isLong ? 'LONG' : 'SHORT'} {marketStr}?
          </p>
          <p className="font-mono text-xs mb-5 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
            ARCANA will execute the close on-chain at the current oracle price. No wallet signature needed.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 font-mono text-sm py-2.5 rounded-sm transition-all"
              style={{ background: 'rgba(201,78,78,0.12)', color: '#e05555', border: '1px solid rgba(201,78,78,0.28)' }}
            >
              Request Close
            </button>
            <button
              onClick={onCancel}
              className="font-mono text-sm px-5 py-2.5 rounded-sm"
              style={{ border: '1px solid var(--border)', color: 'var(--ink-3)' }}
            >
              Cancel
            </button>
          </div>
          <p className="font-mono text-2xs text-center mt-3" style={{ color: 'var(--ink-3)', opacity: 0.5 }}>
            Enter to confirm · Esc to cancel
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Positions panel ──────────────────────────────────────────────────────────

function PositionsPanel({
  tab,
  onTabChange,
  positionIds,
  isLoading,
  onRefresh,
  onRequestClose,
  onRequestAdjust,
}: {
  tab: Tab
  onTabChange: (t: Tab) => void
  positionIds: readonly bigint[]
  isLoading: boolean
  onRefresh: () => void
  onRequestClose: (id: bigint, marketStr: string, isLong: boolean) => void
  onRequestAdjust: (id: bigint, marketStr: string, isLong: boolean) => void
}) {
  const height = positionIds.length > 0 ? '300px' : '220px'
  return (
    <div
      className="border-t flex flex-col"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)', height, flexShrink: 0 }}
    >
      <div
        className="flex items-center gap-0 border-b shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', height: '38px' }}
      >
        {([['positions', 'Positions'], ['history', 'Trade History']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className="relative px-4 h-full font-mono text-xs transition-all"
            style={{ color: tab === t ? 'var(--ink)' : 'var(--ink-2)', background: 'transparent' }}
          >
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--arc)' }} />}
            {label}
            {t === 'positions' && positionIds.length > 0 && (
              <span className="ml-1.5 font-mono text-2xs px-1 py-0.5 rounded-full" style={{ color: 'var(--arc)', background: 'rgba(110,95,240,0.1)' }}>
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

      <div className="flex-1 overflow-auto">
        {tab === 'positions' && (
          positionIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-6">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(110,95,240,0.06)', border: '1px solid rgba(110,95,240,0.15)' }}
              >
                <span className="font-mono text-lg" style={{ color: 'var(--arc)', opacity: 0.4 }}>◉</span>
              </div>
              <div className="text-center">
                <span className="font-mono text-xs block mb-1" style={{ color: 'var(--ink)' }}>No open positions</span>
                <span className="font-mono text-2xs leading-relaxed" style={{ color: 'var(--ink-3)' }}>
                  Use the ARCANA terminal to open a position — it executes on-chain instantly.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/app"
                  className="font-mono text-2xs px-4 py-1.5 rounded-sm border transition-all"
                  style={{ color: 'var(--arc)', borderColor: 'rgba(110,95,240,0.25)', background: 'rgba(110,95,240,0.04)' }}
                >
                  Open via ARCANA →
                </Link>
                <button
                  onClick={onRefresh}
                  className="font-mono text-2xs px-3 py-1.5 rounded-sm border transition-all"
                  style={{ color: 'var(--ink-3)', borderColor: 'var(--border)' }}
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Market / Side', 'Size', 'Collateral', 'Lev', 'Entry', 'Mark', 'Liq. / Health', 'P&L', 'Action'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-normal"
                      style={{ color: 'var(--ink-3)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}
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
                    onRequestClose={onRequestClose}
                    onRequestAdjust={onRequestAdjust}
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

// ─── Order panel (right side) ─────────────────────────────────────────────────

function OrderPanel({ asset, ticker }: { asset: Asset; ticker: Ticker | null }) {
  const router = useRouter()
  const { address } = useAccount()
  const [direction, setDirection] = useState<Direction>('long')
  const [collateral, setCollateral] = useState('50')
  const [leverage, setLeverage] = useState(3)

  // Vault data
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
  const { data: lastCycle } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'lastHermesCycle',
  })

  // User vault balance
  const { data: userShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })
  const { data: userValueRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: userShares && userShares > 0n ? [userShares] : undefined,
    query: { enabled: !!userShares && userShares > 0n },
  })

  const stratName = activeStrategyIndex !== undefined ? STRAT_NAMES[Number(activeStrategyIndex)] : null
  const accent = stratName ? STRAT_ACCENTS[stratName] : 'var(--arc)'
  const maxLev = stratName ? STRAT_MAX_LEV[stratName] : 3
  const longOnly = stratName ? STRAT_LONG_ONLY[stratName] : false
  const userValue = userValueRaw ? (Number(userValueRaw) / 1e6).toFixed(2) : null
  const tvl = totalAssets ? (Number(totalAssets) / 1e6).toFixed(2) : '—'

  // Clamp leverage to strategy max
  const effectiveLev = Math.min(leverage, maxLev)
  const collateralNum = parseFloat(collateral) || 0
  const positionSize = collateralNum * effectiveLev
  const currentPrice = ticker?.lastPrice ?? null
  const liqBuffer = 1 / effectiveLev
  const estLiq = currentPrice
    ? direction === 'long'
      ? currentPrice * (1 - liqBuffer)
      : currentPrice * (1 + liqBuffer)
    : null

  const leverageMarks = [1, 2, 3, 5, 7, 10].filter((l) => l <= maxLev)

  const handleOrder = () => {
    const msg = `${direction} ${asset} ${collateral} usdc ${effectiveLev}x leverage`
    router.push(`/app?msg=${encodeURIComponent(msg)}`)
  }

  const fmtP = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Strategy status */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full hermes-alive" style={{ background: accent }} />
            <span className="font-mono text-2xs font-medium" style={{ color: accent }}>
              {stratName ?? 'No Strategy'}
            </span>
          </div>
          {lastCycle && Number(lastCycle) > 0 && (
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
              Last cycle {timeAgo(Number(lastCycle))}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Vault TVL</div>
            <div className="font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>${tvl}</div>
          </div>
          {userValue && (
            <div className="text-right">
              <div className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>My Deposit</div>
              <div className="font-mono text-sm font-medium" style={{ color: accent }}>${userValue}</div>
            </div>
          )}
        </div>
      </div>

      {/* Direction toggle */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="font-mono text-2xs uppercase tracking-widest mb-2" style={{ color: 'var(--ink-3)' }}>Side</div>
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-sm" style={{ background: 'var(--surface-2)' }}>
          <button
            onClick={() => setDirection('long')}
            disabled={false}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm font-mono text-xs font-medium transition-all"
            style={{
              background: direction === 'long' ? 'rgba(29,184,122,0.12)' : 'transparent',
              color: direction === 'long' ? 'var(--gain)' : 'var(--ink-3)',
              border: direction === 'long' ? '1px solid rgba(29,184,122,0.25)' : '1px solid transparent',
            }}
          >
            <ArrowUpRight size={12} />
            Long
          </button>
          <button
            onClick={() => !longOnly && setDirection('short')}
            disabled={longOnly}
            className="flex items-center justify-center gap-1.5 py-2 rounded-sm font-mono text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: direction === 'short' ? 'rgba(201,78,78,0.12)' : 'transparent',
              color: direction === 'short' ? 'var(--loss)' : 'var(--ink-3)',
              border: direction === 'short' ? '1px solid rgba(201,78,78,0.25)' : '1px solid transparent',
            }}
          >
            <ArrowDownRight size={12} />
            Short
            {longOnly && <span className="text-2xs opacity-50 ml-0.5">(locked)</span>}
          </button>
        </div>
      </div>

      {/* Collateral input */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-2xs uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>Collateral</span>
          <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>USDC</span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-sm"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <input
            type="number"
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
            placeholder="0.00"
            min="1"
            className="flex-1 bg-transparent font-mono text-sm outline-none"
            style={{ color: 'var(--ink)', caretColor: accent }}
          />
          <div className="flex gap-1">
            {['10', '50', '100'].map((v) => (
              <button
                key={v}
                onClick={() => setCollateral(v)}
                className="font-mono text-2xs px-1.5 py-0.5 rounded-sm transition-all"
                style={{
                  color: collateral === v ? accent : 'var(--ink-3)',
                  background: collateral === v ? `${accent}15` : 'transparent',
                  border: `1px solid ${collateral === v ? `${accent}30` : 'transparent'}`,
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leverage */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-2xs uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>Leverage</span>
          <span className="font-mono text-sm font-medium" style={{ color: accent }}>{effectiveLev}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxLev}
          step={1}
          value={effectiveLev}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full accent-arc h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: accent }}
        />
        <div className="flex justify-between mt-1.5">
          {[1, ...leverageMarks.slice(1)].map((m) => (
            <button
              key={m}
              onClick={() => setLeverage(m)}
              className="font-mono text-2xs transition-all"
              style={{
                color: effectiveLev === m ? accent : 'var(--ink-3)',
                fontWeight: effectiveLev === m ? 600 : 400,
              }}
            >
              {m}×
            </button>
          ))}
        </div>
      </div>

      {/* Position summary */}
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="space-y-2">
          {[
            { label: 'Position Size', value: positionSize > 0 ? `$${fmtP(positionSize)}` : '—', color: 'var(--ink)' },
            { label: 'Est. Entry', value: currentPrice ? `$${fmtP(currentPrice)}` : '—', color: 'var(--ink-2)' },
            { label: 'Est. Liquidation', value: estLiq ? `$${fmtP(estLiq)}` : '—', color: '#e05555' },
            { label: 'Max ROE', value: `${(effectiveLev * 100).toFixed(0)}%`, color: direction === 'long' ? 'var(--gain)' : 'var(--loss)' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>{row.label}</span>
              <span className="font-mono text-xs tabular-nums" style={{ color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Order button */}
      <div className="px-4 py-4">
        <button
          onClick={handleOrder}
          disabled={!collateralNum || collateralNum <= 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-sm font-mono text-xs tracking-widest uppercase transition-all disabled:opacity-40"
          style={{
            background: direction === 'long' ? 'rgba(29,184,122,0.12)' : 'rgba(201,78,78,0.12)',
            color: direction === 'long' ? 'var(--gain)' : 'var(--loss)',
            border: `1px solid ${direction === 'long' ? 'rgba(29,184,122,0.28)' : 'rgba(201,78,78,0.28)'}`,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = direction === 'long' ? 'rgba(29,184,122,0.2)' : 'rgba(201,78,78,0.2)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = direction === 'long' ? 'rgba(29,184,122,0.12)' : 'rgba(201,78,78,0.12)'
          }}
        >
          <Zap size={13} />
          {direction === 'long' ? 'Long' : 'Short'} {asset} via ARCANA
        </button>

        <p className="font-mono text-2xs mt-2 text-center leading-relaxed" style={{ color: 'var(--ink-3)', opacity: 0.6 }}>
          Routes to ARCANA agent · Hermes executes autonomously
        </p>

        <Link
          href="/vault"
          className="mt-3 w-full flex items-center justify-center gap-1.5 font-mono text-2xs py-2 rounded-sm border transition-all"
          style={{ color: 'var(--arc)', borderColor: 'rgba(110,95,240,0.2)', background: 'rgba(110,95,240,0.04)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.08)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(110,95,240,0.04)' }}
        >
          Manage Vault →
        </Link>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TradePage() {
  const { isConnected } = useAccount()
  const router = useRouter()
  const [asset, setAsset] = useState<Asset>('ETH')
  const [tab, setTab] = useState<Tab>('positions')
  const [showOrderBook, setShowOrderBook] = useState(true)
  const [closeConfirm, setCloseConfirm] = useState<{
    id: bigint; marketStr: string; isLong: boolean
  } | null>(null)

  const { ticker } = useTicker(asset)

  const tvSymbol = asset === 'ETH' ? 'BINANCE:ETHUSDT' : 'BINANCE:BTCUSDT'
  const bncSymbol = asset === 'ETH' ? 'ETHUSDT' : 'BTCUSDT'
  const { ids, isLoading: posLoading, refetch: refetchPositions } = useOpenPositionIds(VAULT_ADDRESS)

  const handleRequestClose = useCallback((id: bigint, marketStr: string, isLong: boolean) => {
    setCloseConfirm({ id, marketStr, isLong })
  }, [])

  const handleRequestAdjust = useCallback((id: bigint, marketStr: string, isLong: boolean) => {
    const msg = `Please revise my ${isLong ? 'long' : 'short'} ${marketStr} position #${id.toString()} and suggest the best adjustment`
    router.push(`/app?msg=${encodeURIComponent(msg)}`)
  }, [router])

  const [closingId, setClosingId] = useState<bigint | null>(null)
  const [closeStatus, setCloseStatus] = useState<string | null>(null)

  const handleConfirmClose = useCallback(async () => {
    if (!closeConfirm) return
    const { id, marketStr } = closeConfirm
    setCloseConfirm(null)
    setClosingId(id)
    setCloseStatus('Closing position...')
    try {
      const asset = marketStr.includes('BTC') ? 'BTC' : 'ETH'
      const res = await fetch('/api/hermes/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: id.toString(), asset }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCloseStatus(`Failed: ${data.error ?? 'unknown error'}`)
      } else {
        setCloseStatus('Position closed')
        setTimeout(() => { setClosingId(null); setCloseStatus(null); refetchPositions() }, 3000)
      }
    } catch (err) {
      setCloseStatus(`Error: ${err instanceof Error ? err.message.slice(0, 60) : 'unknown'}`)
    } finally {
      setTimeout(() => { if (closingId) { setClosingId(null); setCloseStatus(null) } }, 8000)
    }
  }, [closeConfirm, closingId, refetchPositions])

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] mx-auto max-w-md gap-6 px-4">
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
    <>
      {closeConfirm && (
        <CloseConfirmModal
          positionId={closeConfirm.id}
          marketStr={closeConfirm.marketStr}
          isLong={closeConfirm.isLong}
          onConfirm={handleConfirmClose}
          onCancel={() => setCloseConfirm(null)}
        />
      )}
      {closeStatus && (
        <div
          className="fixed bottom-6 right-6 z-50 font-mono text-xs px-4 py-3 rounded-sm border"
          style={{
            background: 'var(--surface)',
            borderColor: closeStatus.startsWith('Failed') || closeStatus.startsWith('Error') ? 'rgba(201,78,78,0.4)' : 'rgba(110,95,240,0.3)',
            color: closeStatus.startsWith('Failed') || closeStatus.startsWith('Error') ? 'var(--loss)' : 'var(--arc)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          {closeStatus}
        </div>
      )}

      <div
        className="flex flex-col"
        style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', background: 'var(--bg)', minHeight: 0 }}
      >
        {/* Market header */}
        <MarketHeader asset={asset} onSelect={setAsset} />

        {/* Main exchange area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Order book */}
          {showOrderBook && (
            <div className="border-r shrink-0" style={{ width: '200px', borderColor: 'var(--border)', overflow: 'hidden' }}>
              <OrderBook symbol={bncSymbol as 'ETHUSDT' | 'BTCUSDT'} />
            </div>
          )}

          {/* Chart area */}
          <div className="flex flex-col flex-1 min-w-0">
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

            <div className="flex-1 min-h-0">
              <TVChart symbol={tvSymbol} interval="60" />
            </div>
          </div>

          {/* Order panel */}
          <div className="shrink-0 overflow-y-auto" style={{ width: '260px' }}>
            <OrderPanel asset={asset} ticker={ticker} />
          </div>
        </div>

        {/* Positions panel */}
        <PositionsPanel
          tab={tab}
          onTabChange={setTab}
          positionIds={ids}
          isLoading={posLoading}
          onRefresh={refetchPositions}
          onRequestClose={handleRequestClose}
          onRequestAdjust={handleRequestAdjust}
        />
      </div>
    </>
  )
}
