'use client'

import { useState } from 'react'
import { shortAddress } from '@/lib/utils'

type StrategyFilter = 'ALL' | 'APOLLO' | 'ATLAS' | 'ARES'

interface VaultEntry {
  rank: number
  address: string
  strategy: 'APOLLO' | 'ATLAS' | 'ARES'
  return7d: number
  totalPnl: number
  positions: number
  since: string
}

const MOCK_ENTRIES: VaultEntry[] = [
  {
    rank: 1,
    address: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    strategy: 'ARES',
    return7d: 38.2,
    totalPnl: 4821.5,
    positions: 3,
    since: '12 days ago',
  },
  {
    rank: 2,
    address: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
    strategy: 'ATLAS',
    return7d: 22.7,
    totalPnl: 2315.0,
    positions: 2,
    since: '8 days ago',
  },
  {
    rank: 3,
    address: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    strategy: 'ARES',
    return7d: 19.1,
    totalPnl: 1904.2,
    positions: 4,
    since: '15 days ago',
  },
  {
    rank: 4,
    address: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
    strategy: 'ATLAS',
    return7d: 14.3,
    totalPnl: 1432.8,
    positions: 1,
    since: '6 days ago',
  },
  {
    rank: 5,
    address: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
    strategy: 'APOLLO',
    return7d: 8.6,
    totalPnl: 862.1,
    positions: 2,
    since: '20 days ago',
  },
  {
    rank: 6,
    address: '0x6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
    strategy: 'APOLLO',
    return7d: 6.2,
    totalPnl: 620.4,
    positions: 1,
    since: '18 days ago',
  },
  {
    rank: 7,
    address: '0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
    strategy: 'ATLAS',
    return7d: 4.8,
    totalPnl: 481.3,
    positions: 2,
    since: '4 days ago',
  },
  {
    rank: 8,
    address: '0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
    strategy: 'ARES',
    return7d: -3.4,
    totalPnl: -341.2,
    positions: 0,
    since: '11 days ago',
  },
]

const RANK_COLOR: Record<number, string> = {
  1: 'text-hermes',
  2: 'text-data',
  3: 'text-arc',
}

const STRATEGY_DOT: Record<string, string> = {
  APOLLO: '#6e5ff0',
  ATLAS: '#3d9ac2',
  ARES: '#c94e4e',
}

export function LeaderboardTable() {
  const [filter, setFilter] = useState<StrategyFilter>('ALL')

  const filtered =
    filter === 'ALL' ? MOCK_ENTRIES : MOCK_ENTRIES.filter((e) => e.strategy === filter)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {(['ALL', 'APOLLO', 'ATLAS', 'ARES'] as StrategyFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 font-mono text-2xs transition-colors rounded-sm ${
              filter === f
                ? 'bg-arc text-white'
                : 'border border-[#1c2540] text-ink-2 hover:text-ink hover:border-[#253357]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[#1c2540] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1c2540] bg-[#080c14]">
                {['Rank', 'Address', 'Strategy', '7D Return', 'Total PnL', 'Positions', 'Since'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 label">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const isPos = entry.return7d >= 0
                const rankColor = RANK_COLOR[entry.rank] ?? 'text-ink-3'
                const isAltRow = i % 2 === 1

                return (
                  <tr
                    key={entry.address}
                    className={`border-t border-[#1c2540] hover:bg-surface-2 transition-colors ${
                      isAltRow ? 'bg-surface-2/40' : ''
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span className={`font-mono text-xs font-medium ${rankColor}`}>
                        {entry.rank}
                      </span>
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3">
                      <a
                        href={`https://testnet.arcscan.app/address/${entry.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-ink hover:text-arc transition-colors"
                      >
                        {shortAddress(entry.address)}
                      </a>
                    </td>

                    {/* Strategy */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ background: STRATEGY_DOT[entry.strategy] }}
                        />
                        <span className="font-mono text-xs text-ink">{entry.strategy}</span>
                      </div>
                    </td>

                    {/* 7D Return */}
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-xs font-medium ${
                          isPos ? 'text-gain' : 'text-loss'
                        }`}
                      >
                        {isPos ? '+' : ''}
                        {entry.return7d}%
                      </span>
                    </td>

                    {/* Total PnL */}
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-xs ${
                          entry.totalPnl >= 0 ? 'text-gain' : 'text-loss'
                        }`}
                      >
                        {entry.totalPnl >= 0 ? '+' : ''}$
                        {Math.abs(entry.totalPnl).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </td>

                    {/* Positions */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-ink">{entry.positions}</span>
                    </td>

                    {/* Since */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-2xs text-ink-3">{entry.since}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="font-mono text-xs text-ink-3">No vaults for {filter}</p>
          </div>
        )}
      </div>

      <p className="mt-3 font-mono text-2xs text-ink-3 text-center">
        Data from vault contract events · updates every 30s
      </p>
    </div>
  )
}
