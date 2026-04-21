'use client'

import { useState, useEffect, useRef } from 'react'

interface Level { price: number; qty: number; total: number }

interface Props {
  symbol: 'ETHUSDT' | 'BTCUSDT'
}

function useLevels(symbol: string) {
  const [bids, setBids] = useState<Level[]>([])
  const [asks, setAsks] = useState<Level[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const sym = symbol.toLowerCase()
    const connect = () => {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@depth20@1000ms`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          const process = (arr: [string, string][]): Level[] => {
            let running = 0
            return arr.slice(0, 14).map(([p, q]) => {
              running += parseFloat(q)
              return { price: parseFloat(p), qty: parseFloat(q), total: running }
            })
          }
          setBids(process(data.bids))
          setAsks(process([...data.asks].reverse()))
        } catch {}
      }

      ws.onerror = () => ws.close()
      ws.onclose = () => {
        setConnected(false)
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => { wsRef.current?.close() }
  }, [symbol])

  return { bids, asks, connected }
}

export function OrderBook({ symbol }: Props) {
  const { bids, asks, connected } = useLevels(symbol)
  const isEth = symbol === 'ETHUSDT'
  const priceDec = isEth ? 2 : 1
  const qtyDec  = isEth ? 4 : 5

  // Fix: use last item's total (largest cumulative) for scaling
  const maxBid = bids.length ? bids[bids.length - 1].total : 0
  const maxAsk = asks.length ? asks[asks.length - 1].total : 0
  const maxTotal = Math.max(maxBid, maxAsk)

  const fmtP = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: priceDec, maximumFractionDigits: priceDec })
  const fmtQ = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(2)}k`
    return n.toFixed(qtyDec)
  }

  const spread = bids.length && asks.length
    ? Math.abs(bids[0].price - asks[asks.length - 1].price)
    : null

  const spreadPct = bids.length && asks.length
    ? ((spread ?? 0) / bids[0].price) * 100
    : null

  const isEmpty = bids.length === 0 && asks.length === 0

  return (
    <div
      className="flex flex-col h-full select-none"
      style={{ background: 'var(--surface)', fontSize: '11px' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>
          Order Book
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: connected ? 'var(--gain)' : 'var(--loss)', opacity: 0.8 }}
          />
          <span className="font-mono" style={{ color: 'var(--ink-3)', fontSize: '0.6rem' }}>
            {connected ? 'live' : 'reconnecting'}
          </span>
        </div>
      </div>

      {/* Column labels */}
      <div
        className="grid px-3 py-1.5 border-b shrink-0"
        style={{ borderColor: 'var(--border)', gridTemplateColumns: '1fr 1fr 1fr' }}
      >
        {[['Price', 'left'], ['Qty', 'right'], ['Total', 'right']].map(([h, align]) => (
          <span
            key={h}
            className="font-mono uppercase tracking-widest"
            style={{
              color: 'var(--ink-3)',
              fontSize: '0.58rem',
              textAlign: align as 'left' | 'right',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Asks (sells — red) highest price at top, lowest near spread */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end shrink-0 min-h-0">
        {isEmpty ? (
          <div className="flex items-center justify-center flex-1">
            <span
              className="font-mono text-2xs animate-pulse"
              style={{ color: 'var(--ink-3)' }}
            >
              connecting...
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            {asks.map((row, i) => {
              const pct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0
              const intensity = 0.08 + (pct / 100) * 0.10
              return (
                <div
                  key={i}
                  className="relative px-3 hover:opacity-80 cursor-default"
                  style={{ paddingTop: '2px', paddingBottom: '2px' }}
                >
                  {/* Depth bar — from right edge inward */}
                  <div
                    className="absolute right-0 top-0 bottom-0 pointer-events-none"
                    style={{
                      width: `${pct}%`,
                      background: `rgba(201,78,78,${intensity})`,
                    }}
                  />
                  <div
                    className="grid relative z-10"
                    style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
                  >
                    <span
                      className="font-mono tabular-nums"
                      style={{ color: '#e05555', fontWeight: i === asks.length - 1 ? 600 : 400 }}
                    >
                      {fmtP(row.price)}
                    </span>
                    <span
                      className="font-mono tabular-nums text-right"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {fmtQ(row.qty)}
                    </span>
                    <span
                      className="font-mono tabular-nums text-right"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {fmtQ(row.total)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Spread */}
      <div
        className="px-3 border-y shrink-0"
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface-2)',
          paddingTop: '5px',
          paddingBottom: '5px',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="font-mono" style={{ color: 'var(--ink-3)', fontSize: '0.6rem' }}>
            SPREAD
          </span>
          <div className="text-right">
            <span className="font-mono tabular-nums" style={{ color: 'var(--ink-2)', fontSize: '0.65rem' }}>
              {spread !== null ? `$${spread.toFixed(priceDec)}` : '—'}
            </span>
            {spreadPct !== null && (
              <span
                className="font-mono ml-1"
                style={{ color: 'var(--ink-3)', fontSize: '0.58rem' }}
              >
                ({spreadPct.toFixed(3)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bids (buys — green) best bid at top */}
      <div className="flex-1 overflow-hidden min-h-0">
        {bids.map((row, i) => {
          const pct = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0
          const intensity = 0.08 + (pct / 100) * 0.10
          return (
            <div
              key={i}
              className="relative px-3 hover:opacity-80 cursor-default"
              style={{ paddingTop: '2px', paddingBottom: '2px' }}
            >
              {/* Depth bar */}
              <div
                className="absolute right-0 top-0 bottom-0 pointer-events-none"
                style={{
                  width: `${pct}%`,
                  background: `rgba(29,184,122,${intensity})`,
                }}
              />
              <div
                className="grid relative z-10"
                style={{ gridTemplateColumns: '1fr 1fr 1fr' }}
              >
                <span
                  className="font-mono tabular-nums"
                  style={{ color: '#1db87a', fontWeight: i === 0 ? 600 : 400 }}
                >
                  {fmtP(row.price)}
                </span>
                <span
                  className="font-mono tabular-nums text-right"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {fmtQ(row.qty)}
                </span>
                <span
                  className="font-mono tabular-nums text-right"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {fmtQ(row.total)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
