'use client'

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts'

interface StrategyCardProps {
  name: 'APOLLO' | 'ATLAS' | 'ARES'
  strategyIndex: 0 | 1 | 2
  label: string
  motto: string
  maxLeverage: string
  direction: string
  stopLoss: string
  takeProfit: string
  cooldown: string
  maxPositions: number
  riskLevel: number
  isActive: boolean
}

const ACCENT: Record<string, string> = {
  APOLLO: '#6e5ff0',
  ATLAS: '#3d9ac2',
  ARES: '#c94e4e',
}

function RiskBar({ fill, accent }: { fill: number; accent: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-0.5 w-5"
          style={{ background: i < fill ? accent : '#1c2540' }}
        />
      ))}
    </div>
  )
}

export function StrategyCard({
  name,
  strategyIndex,
  label,
  motto,
  maxLeverage,
  direction,
  stopLoss,
  takeProfit,
  cooldown,
  maxPositions,
  riskLevel,
  isActive,
}: StrategyCardProps) {
  const accent = ACCENT[name]

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleActivate = () => {
    if (!VAULT_ADDRESS) return
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'setStrategy',
      args: [strategyIndex],
    })
  }

  return (
    <div
      className="bg-surface p-6 border border-[#1c2540] transition-colors hover:bg-surface-2"
      style={isActive ? { borderLeftWidth: '2px', borderLeftColor: accent } : undefined}
    >
      {/* Top */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="font-mono text-xs tracking-widest text-ink-3 mb-1 uppercase">{label}</div>
          <div className="font-mono text-lg font-medium text-ink">{name}</div>
        </div>
        {isActive && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            <span className="font-mono text-2xs text-ink-2 uppercase tracking-wider">Active</span>
          </div>
        )}
      </div>

      <div className="h-px bg-[#1c2540] mb-5" />

      {/* Params */}
      <div className="space-y-2.5 mb-5">
        {[
          { label: 'Max Leverage', value: maxLeverage, colorClass: 'text-ink' },
          { label: 'Direction', value: direction, colorClass: 'text-ink' },
          { label: 'Stop-Loss', value: stopLoss, colorClass: 'text-loss' },
          { label: 'Take-Profit', value: takeProfit, colorClass: 'text-gain' },
          { label: 'Cooldown', value: cooldown, colorClass: 'text-ink-2' },
          { label: 'Max Positions', value: String(maxPositions), colorClass: 'text-ink-2' },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="label">{row.label}</span>
            <span className={`font-mono text-xs ${row.colorClass}`}>{row.value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-5">
        <span className="label">Risk</span>
        <RiskBar fill={riskLevel} accent={accent} />
      </div>

      <p className="text-xs text-ink-3 italic leading-snug border-l-2 border-[#1c2540] pl-3 mb-5">
        {motto}
      </p>

      {isActive ? (
        <div
          className="border py-2.5 font-mono text-xs text-center"
          style={{ borderColor: accent + '40', color: accent }}
        >
          Currently Active
        </div>
      ) : (
        <button
          onClick={handleActivate}
          disabled={isPending || isConfirming || !VAULT_ADDRESS}
          className="w-full rounded-sm py-2.5 font-mono text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: accent }}
        >
          {isPending
            ? 'Confirm in wallet...'
            : isConfirming
            ? 'Activating...'
            : isSuccess
            ? 'Activated'
            : `Activate ${name}`}
        </button>
      )}
    </div>
  )
}
