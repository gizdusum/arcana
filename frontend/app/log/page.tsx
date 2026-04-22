'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { formatTime } from '@/lib/utils'

interface Decision {
  id: string
  timestamp: number
  strategy: string
  action: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE' | 'CLOSE_ALL' | 'HOLD'
  market: string
  confidence: number
  reasoning: string
  priceAtDecision: number
  positionId?: number
  txHash?: string
  leverage?: number
}

const MOCK_DECISIONS: Decision[] = [
  {
    id: '1',
    timestamp: Math.floor(Date.now() / 1000) - 23,
    strategy: 'ATLAS',
    action: 'OPEN_LONG',
    market: 'BTC/USD',
    confidence: 0.81,
    leverage: 3,
    reasoning: 'EMA20 (67,420) crossed above EMA50 (66,891), RSI=54.2 — momentum confirmed',
    priceAtDecision: 67420,
    txHash: '0xabcd1234ef567890abcd1234ef567890abcd1234ef567890abcd1234ef567890',
  },
  {
    id: '2',
    timestamp: Math.floor(Date.now() / 1000) - 1847,
    strategy: 'ATLAS',
    action: 'CLOSE',
    market: 'ETH/USD',
    confidence: 0.73,
    reasoning: 'Take-profit threshold reached at +18.4%. Closing ETH/USD long position.',
    priceAtDecision: 3812,
    positionId: 2,
    txHash: '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
  },
  {
    id: '3',
    timestamp: Math.floor(Date.now() / 1000) - 4302,
    strategy: 'ATLAS',
    action: 'HOLD',
    market: 'BTC/USD',
    confidence: 0.55,
    reasoning: 'RSI=68.4 approaching overbought. No new position opened. Holding.',
    priceAtDecision: 66980,
  },
  {
    id: '4',
    timestamp: Math.floor(Date.now() / 1000) - 8710,
    strategy: 'ATLAS',
    action: 'OPEN_SHORT',
    market: 'ETH/USD',
    confidence: 0.77,
    leverage: 2,
    reasoning: 'Bearish engulfing candle on 1H. EMA50 rejected at resistance. Short signal confirmed.',
    priceAtDecision: 3756,
    txHash: '0x1234abcd5678ef901234abcd5678ef901234abcd5678ef901234abcd5678ef90',
  },
  {
    id: '5',
    timestamp: Math.floor(Date.now() / 1000) - 12048,
    strategy: 'ATLAS',
    action: 'OPEN_LONG',
    market: 'BTC/USD',
    confidence: 0.84,
    leverage: 4,
    reasoning: 'Strong breakout above 65,000 resistance. Volume surge +240%. RSI=58.1, healthy momentum.',
    priceAtDecision: 65120,
    txHash: '0xfeedcafe1234567890abcdef1234567890abcdef1234567890abcdef12345678',
  },
  {
    id: '6',
    timestamp: Math.floor(Date.now() / 1000) - 18293,
    strategy: 'ATLAS',
    action: 'CLOSE',
    market: 'BTC/USD',
    confidence: 0.68,
    reasoning: 'Stop-loss triggered. Loss exceeds 9.8% threshold. Protecting capital.',
    priceAtDecision: 64021,
    positionId: 1,
    txHash: '0x9876543210abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
]

const ACTION_COLOR: Record<string, string> = {
  OPEN_LONG: 'text-gain',
  OPEN_SHORT: 'text-loss',
  CLOSE: 'text-hermes',
  CLOSE_ALL: 'text-hermes',
  HOLD: 'text-ink-3',
}

function exportCSV(decisions: Decision[]) {
  const headers = ['timestamp', 'action', 'market', 'confidence', 'leverage', 'price', 'reasoning', 'txHash']
  const rows = decisions.map((d) => [
    new Date(d.timestamp * 1000).toISOString(),
    d.action,
    d.market,
    d.confidence,
    d.leverage ?? '',
    d.priceAtDecision,
    `"${d.reasoning.replace(/"/g, '""')}"`,
    d.txHash ?? '',
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `arcana-log-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function LogPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [marketFilter, setMarketFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch('/api/decisions')
      if (res.ok) {
        const data = await res.json()
        setDecisions(data)
        setApiUnavailable(false)
      } else {
        setDecisions(MOCK_DECISIONS)
        setApiUnavailable(true)
      }
    } catch {
      setDecisions(MOCK_DECISIONS)
      setApiUnavailable(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDecisions()
    const iv = setInterval(fetchDecisions, 15000)
    return () => clearInterval(iv)
  }, [fetchDecisions])

  const markets = Array.from(new Set(decisions.map((d) => d.market)))
  const actions = ['OPEN_LONG', 'OPEN_SHORT', 'CLOSE', 'CLOSE_ALL', 'HOLD']

  const filtered = decisions.filter((d) => {
    if (actionFilter !== 'ALL' && d.action !== actionFilter) return false
    if (marketFilter !== 'ALL' && d.market !== marketFilter) return false
    if (searchQuery && !d.reasoning.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono text-lg font-light tracking-[0.15em] text-ink uppercase">
            Decision Log
          </h1>
          <p className="font-mono text-2xs text-ink-3 mt-0.5">
            Every ARCANA autonomous decision — recorded on-chain
          </p>
        </div>

        <div className="flex items-center gap-3">
          {apiUnavailable && (
            <span className="border border-[#2a2d10] bg-[#0f1008] px-2.5 py-1 font-mono text-2xs text-[#7a7a2a]">
              Agent offline — showing demo data
            </span>
          )}
          <button
            onClick={() => exportCSV(decisions)}
            className="border border-[#1c2540] px-3 py-1.5 font-mono text-xs text-ink-2 hover:border-[#253357] hover:text-ink transition-colors rounded-sm"
          >
            Export CSV
          </button>
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gain animate-pulse" />
            <span className="font-mono text-2xs text-ink-3">15s refresh</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Action filter */}
        <div className="flex border border-[#1c2540]">
          {['ALL', ...actions].map((a) => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`px-2.5 py-1.5 font-mono text-2xs transition-colors ${
                actionFilter === a
                  ? 'bg-arc text-white'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              {a === 'ALL' ? 'ALL' : a.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Market filter */}
        {markets.length > 0 && (
          <div className="flex border border-[#1c2540]">
            {['ALL', ...markets].map((m) => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className={`px-2.5 py-1.5 font-mono text-2xs transition-colors ${
                  marketFilter === m
                    ? 'bg-arc text-white'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search reasoning..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-[#1c2540] bg-bg px-3 py-1.5 font-mono text-xs text-ink placeholder-ink-3 outline-none focus:border-arc transition-colors rounded-sm"
        />
      </div>

      {/* Log entries — terminal style */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface animate-pulse border border-[#1c2540]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[#1c2540] bg-surface flex flex-col items-center justify-center py-16 text-center">
          <p className="font-mono text-xs text-ink-3">No decisions match filter</p>
        </div>
      ) : (
        <div className="border border-[#1c2540] bg-surface divide-y divide-[#1c2540] font-mono">
          {filtered.map((d) => {
            const date = new Date(d.timestamp * 1000)
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const actionColor = ACTION_COLOR[d.action] ?? 'text-ink-2'

            return (
              <div key={d.id} className="px-4 py-3 hover:bg-surface-2 transition-colors">
                {/* Line 1: [time]  ACTION  MARKET  conf=X */}
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="text-2xs text-ink-3 tabular-nums shrink-0">
                    [{formatTime(d.timestamp)}]
                  </span>
                  <span className={`text-xs font-medium ${actionColor}`}>
                    {d.action.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-ink">{d.market}</span>
                  {d.leverage && (
                    <span className="text-xs text-ink-2">{d.leverage}x</span>
                  )}
                  <span className="text-2xs text-ink-3">conf={d.confidence.toFixed(2)}</span>
                  <span className="text-2xs text-ink-3 ml-auto tabular-nums">{dateStr}</span>
                </div>

                {/* Line 2: reasoning */}
                <p className="text-2xs text-ink-3 leading-relaxed pl-[calc(1rem+1ch)] mb-1">
                  &ldquo;{d.reasoning}&rdquo;
                </p>

                {/* Line 3: tx hash + position */}
                <div className="pl-[calc(1rem+1ch)] flex items-center gap-4">
                  {d.txHash && (
                    <a
                      href={`https://testnet.arcscan.app/tx/${d.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xs text-arc hover:text-arc/80 transition-colors"
                    >
                      tx {d.txHash.slice(0, 10)}...{d.txHash.slice(-6)} &#8599;
                    </a>
                  )}
                  {d.positionId !== undefined && (
                    <span className="text-2xs text-ink-3">pos #{d.positionId}</span>
                  )}
                  {d.priceAtDecision && (
                    <span className="text-2xs text-ink-3">
                      @ ${d.priceAtDecision.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="font-mono text-2xs text-ink-3 text-center">
          {filtered.length} of {decisions.length} entries
        </p>
      )}
    </div>
  )
}
