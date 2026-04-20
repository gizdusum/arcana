'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { LeaderboardTable } from '@/components/LeaderboardTable'

export default function LeaderboardPage() {
  const [countdown, setCountdown] = useState(30)
  const [lastRefreshTime, setLastRefreshTime] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLastRefreshTime(
      new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    )
    const iv = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setLastRefreshTime(
            new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
          )
          setRefreshKey((k) => k + 1)
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg font-light tracking-[0.15em] text-ink uppercase">
            Leaderboard
          </h1>
          <p className="font-mono text-2xs text-ink-3 mt-0.5">
            Top-performing autonomous vaults on Arc Testnet
          </p>
        </div>

        {/* Refresh indicator */}
        <div className="border border-[#1c2540] bg-surface px-4 py-2 flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-arc animate-pulse" />
          <span className="font-mono text-2xs text-ink-3">
            Refreshes in{' '}
            <span className="text-ink tabular-nums">{countdown}s</span>
          </span>
          {lastRefreshTime && (
            <span className="font-mono text-2xs text-ink-3">
              · Updated {lastRefreshTime}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#1c2540]">
        {[
          { label: 'Active Vaults', value: '8', color: 'text-ink' },
          { label: 'Total TVL', value: '$48,240', color: 'text-gain' },
          { label: 'Best 7D Return', value: '+38.2%', color: 'text-gain' },
          { label: 'Total Trades', value: '284', color: 'text-ink' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-4">
            <div className={`font-mono text-xl font-light ${stat.color}`}>{stat.value}</div>
            <span className="label">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div key={refreshKey}>
        <LeaderboardTable />
      </div>
    </div>
  )
}
