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

  useEffect(() => {
    const sym = symbol.toLowerCase()
    const connect = () => {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${sym}@depth20@1000ms`)
      wsRef.current = ws

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
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [symbol])

  return { bids, asks }
}

export function OrderBook({ symbol }: Props) {
  const { bids, asks } = useLevels(symbol)
  const isEth = symbol === 'ETHUSDT'
  const priceDec = isEth ? 2 : 1
  const qtyDec = isEth ? 4 : 5

  const maxBid = bids.length ? bids[0].total : 0
  const maxAsk = asks.length ? asks[asks.length - 1].total : 0
  const maxTotal = Math.max(maxBid, maxAsk)

  const fmtP = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: priceDec, maximumFractionDigits: priceDec })
  const fmtQ = (n: number) => n.toFixed(qtyDec)

  const spread = bids.length && asks.length
    ? Math.abs(bids[0].price - asks[asks.length - 1].price)
    : null

  return (
    <div className="flex flex-col h-full select-none" style={{ background: 'var(--surface)', fontSize: '11px' }}>
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>Order Book</span>
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>depth 20</span>
      </div>

      {/* Column labels */}
      <div className="grid grid-cols-3 px-3 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
        {['Price', 'Qty', 'Total'].map((h) => (
          <span key={h} className="font-mono uppercase tracking-widest" style={{ color: 'var(--ink-3)', fontSize: '0.6rem' }}>
            {h}
          </span>
        ))}
      </div>

      {/* Asks (sells — red) reversed so highest ask is at top */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {asks.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <span className="font-mono text-2xs animate-pulse" style={{ color: 'var(--ink-3)' }}>connecting...</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {asks.map((row, i) => (
              <div
                key={i}
                className="relative grid grid-cols-3 px-3 py-0.5 hover:opacity-80 cursor-default"
              >
                <div
                  className="absolute right-0 top-0 bottom-0 opacity-15"
                  style={{ background: '#c94e4e', width: `${(row.total / maxTotal) * 100}%` }}
                />
                <span className="font-mono relative z-10" style={{ color: '#c94e4e' }}>{fmtP(row.price)}</span>
                <span className="font-mono relative z-10 text-right" style={{ color: 'var(--ink-2)' }}>{fmtQ(row.qty)}</span>
                <span className="font-mono relative z-10 text-right" style={{ color: 'var(--ink-3)' }}>{fmtQ(row.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spread */}
      <div className="px-3 py-1.5 border-y flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Spread</span>
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>
          {spread !== null ? `$${spread.toFixed(priceDec)}` : '—'}
        </span>
      </div>

      {/* Bids (buys — green) */}
      <div className="flex-1 overflow-hidden">
        {bids.map((row, i) => (
          <div
            key={i}
            className="relative grid grid-cols-3 px-3 py-0.5 hover:opacity-80 cursor-default"
          >
            <div
              className="absolute right-0 top-0 bottom-0 opacity-15"
              style={{ background: '#1db87a', width: `${(row.total / maxTotal) * 100}%` }}
            />
            <span className="font-mono relative z-10" style={{ color: '#1db87a' }}>{fmtP(row.price)}</span>
            <span className="font-mono relative z-10 text-right" style={{ color: 'var(--ink-2)' }}>{fmtQ(row.qty)}</span>
            <span className="font-mono relative z-10 text-right" style={{ color: 'var(--ink-3)' }}>{fmtQ(row.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
