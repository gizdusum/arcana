'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatTime } from '@/lib/utils'

interface Decision {
  id: string
  timestamp: number
  action: 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE' | 'CLOSE_ALL' | 'HOLD'
  market: string
  confidence: number
  reasoning: string
  leverage?: number
  txHash?: string
}

const MOCK_DECISIONS: Decision[] = [
  {
    id: '1',
    timestamp: Math.floor(Date.now() / 1000) - 23,
    action: 'OPEN_LONG',
    market: 'BTC/USD',
    confidence: 0.81,
    leverage: 3,
    reasoning: 'EMA20 crossed EMA50, RSI=54.2 — momentum confirmed',
    txHash: '0xabcd1234ef567890abcd1234ef567890abcd1234ef567890abcd1234ef567890',
  },
  {
    id: '2',
    timestamp: Math.floor(Date.now() / 1000) - 1847,
    action: 'CLOSE',
    market: 'ETH/USD',
    confidence: 0.73,
    reasoning: 'Take-profit at +18.4%. Closing to realize gains.',
    txHash: '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
  },
  {
    id: '3',
    timestamp: Math.floor(Date.now() / 1000) - 4302,
    action: 'HOLD',
    market: 'BTC/USD',
    confidence: 0.55,
    reasoning: 'RSI=68.4 approaching overbought. Waiting for confirmation.',
  },
]

const ACTION_COLOR: Record<string, string> = {
  OPEN_LONG: 'text-gain',
  OPEN_SHORT: 'text-loss',
  CLOSE: 'text-hermes',
  CLOSE_ALL: 'text-hermes',
  HOLD: 'text-ink-3',
}

interface AgentLogProps {
  limit?: number
  showViewAll?: boolean
}

export function AgentLog({ limit = 3, showViewAll = true }: AgentLogProps) {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDecisions() {
      try {
        const res = await fetch('/api/decisions')
        if (res.ok) {
          const data = await res.json()
          setDecisions(data.slice(0, limit))
        } else {
          setDecisions(MOCK_DECISIONS.slice(0, limit))
        }
      } catch {
        setDecisions(MOCK_DECISIONS.slice(0, limit))
      } finally {
        setLoading(false)
      }
    }
    fetchDecisions()
  }, [limit])

  return (
    <div className="border border-[#1c2540] bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2540]">
        <span className="label">ARCANA Decisions</span>
        {showViewAll && (
          <Link href="/log" className="font-mono text-2xs text-arc hover:text-arc/80 transition-colors">
            Full log &#8594;
          </Link>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-10 bg-surface-2 animate-pulse rounded-sm" />
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="font-mono text-xs text-ink-3">No decisions recorded</p>
        </div>
      ) : (
        <div className="divide-y divide-[#1c2540]">
          {decisions.map((d) => (
            <div key={d.id} className="px-4 py-3 hover:bg-surface-2 transition-colors">
              <div className="flex items-start gap-3">
                <span className="font-mono text-2xs text-ink-3 pt-0.5 shrink-0 tabular-nums">
                  [{formatTime(d.timestamp)}]
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`font-mono text-xs font-medium ${ACTION_COLOR[d.action] ?? 'text-ink-2'}`}>
                      {d.action.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-xs text-ink">{d.market}</span>
                    {d.leverage && (
                      <span className="font-mono text-2xs text-ink-3">{d.leverage}x</span>
                    )}
                    <span className="font-mono text-2xs text-ink-3 ml-auto">
                      conf={d.confidence.toFixed(2)}
                    </span>
                  </div>
                  <p className="font-mono text-2xs text-ink-3 leading-snug truncate">
                    &ldquo;{d.reasoning}&rdquo;
                  </p>
                  {d.txHash && (
                    <a
                      href={`https://testnet.arcscan.app/tx/${d.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-2xs text-arc hover:text-arc/80 transition-colors mt-0.5 inline-block"
                    >
                      tx {d.txHash.slice(0, 6)}...{d.txHash.slice(-4)} &#8599;
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
