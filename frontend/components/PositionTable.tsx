'use client'

import { useReadContract } from 'wagmi'
import { VAULT_ADDRESS, PERP_ENGINE_ABI, PERP_ENGINE_ADDRESS } from '@/lib/contracts'
import { formatMarket, formatPrice, timeAgo } from '@/lib/utils'

interface PositionRowProps {
  positionId: bigint
}

function PositionRow({ positionId }: PositionRowProps) {
  const { data: pos, isLoading } = useReadContract({
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

  if (isLoading || !pos) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-3">
          <div className="h-4 bg-surface-2 animate-pulse rounded-sm" />
        </td>
      </tr>
    )
  }

  const [id, , market, isLong, size, entryPrice, leverage, collateral, openedAt, isOpen] = pos

  if (!isOpen) return null

  const pnlNum = pnl !== undefined ? Number(pnl) / 1e6 : 0
  const pnlPct =
    collateral > 0n
      ? ((pnlNum / (Number(collateral) / 1e6)) * 100).toFixed(2)
      : '0.00'
  const pnlSign = pnlNum >= 0 ? '+' : ''

  const sizeFormatted = (Number(size) / 1e6).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })

  return (
    <tr className="border-t border-[#1c2540] hover:bg-surface-2 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-ink">
        {formatMarket(market as `0x${string}`)}
      </td>
      <td className="px-4 py-3">
        <span className={`font-mono text-xs font-medium ${isLong ? 'text-gain' : 'text-loss'}`}>
          {isLong ? 'LONG' : 'SHORT'}
        </span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink">{sizeFormatted}</td>
      <td className="px-4 py-3 font-mono text-xs text-ink-2">{formatPrice(entryPrice)}</td>
      <td className="px-4 py-3 font-mono text-xs text-ink-3">—</td>
      <td className={`px-4 py-3 font-mono text-xs font-medium ${pnlNum >= 0 ? 'text-gain' : 'text-loss'}`}>
        {pnlSign}${Math.abs(pnlNum).toFixed(2)}
        <span className="ml-1 text-ink-3">({pnlSign}{pnlPct}%)</span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-ink-2">{Number(leverage)}x</td>
      <td className="px-4 py-3 font-mono text-2xs text-ink-3">
        #{id.toString()} · {timeAgo(Number(openedAt))}
      </td>
    </tr>
  )
}

export function PositionTable() {
  const { data: positionIds, isLoading } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'getVaultOpenPositions',
    args: VAULT_ADDRESS ? [VAULT_ADDRESS] : undefined,
    query: { enabled: !!VAULT_ADDRESS },
  })

  const ids = positionIds ?? []

  return (
    <div className="border border-[#1c2540] bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1c2540]">
        <div className="flex items-center gap-2">
          <span className="label">Open Positions</span>
          {ids.length > 0 && (
            <span className="font-mono text-2xs text-arc">({ids.length})</span>
          )}
        </div>
        <span className="font-mono text-2xs text-ink-3">ARCANA managed</span>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 bg-surface-2 animate-pulse rounded-sm" />
          ))}
        </div>
      ) : ids.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="font-mono text-xs text-ink-3">No open positions</p>
          <p className="font-mono text-2xs text-ink-3 mt-1 opacity-60">
            Positions appear here when ARCANA trades
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#1c2540]">
                {['Market', 'Dir', 'Size', 'Entry', 'Current', 'P&L', 'Lev', 'Info'].map((h) => (
                  <th key={h} className="px-4 py-2.5 label">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => (
                <PositionRow key={id.toString()} positionId={id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
