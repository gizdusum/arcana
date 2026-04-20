'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts'
import { StrategyIcon } from '@/components/StrategyIcon'

const STRATEGY_NAMES = ['APOLLO', 'ATLAS', 'ARES'] as const

interface StrategyDef {
  index: 0 | 1 | 2
  name: 'APOLLO' | 'ATLAS' | 'ARES'
  label: string
  tagline: string
  stats: { label: string; value: string; colorClass: string }[]
  riskFill: number
  accent: string
  isAggressive?: boolean
}

const STRATEGIES: StrategyDef[] = [
  {
    index: 0,
    name: 'APOLLO',
    label: 'Conservative',
    tagline: 'Steady and sure. APOLLO protects before it hunts.',
    stats: [
      { label: 'Max Leverage', value: '3x', colorClass: 'text-ink' },
      { label: 'Direction', value: 'Long only', colorClass: 'text-ink' },
      { label: 'Stop-Loss', value: '5%', colorClass: 'text-loss' },
      { label: 'Take-Profit', value: '10%', colorClass: 'text-gain' },
      { label: 'Cooldown', value: '15 min', colorClass: 'text-ink-2' },
      { label: 'Max Positions', value: '2', colorClass: 'text-ink-2' },
    ],
    riskFill: 1,
    accent: '#6e5ff0',
  },
  {
    index: 1,
    name: 'ATLAS',
    label: 'Balanced',
    tagline: 'ATLAS holds the weight of every market at once.',
    stats: [
      { label: 'Max Leverage', value: '5x', colorClass: 'text-ink' },
      { label: 'Direction', value: 'Long + Short', colorClass: 'text-ink' },
      { label: 'Stop-Loss', value: '10%', colorClass: 'text-loss' },
      { label: 'Take-Profit', value: '20%', colorClass: 'text-gain' },
      { label: 'Cooldown', value: '10 min', colorClass: 'text-ink-2' },
      { label: 'Max Positions', value: '3', colorClass: 'text-ink-2' },
    ],
    riskFill: 3,
    accent: '#3d9ac2',
  },
  {
    index: 2,
    name: 'ARES',
    label: 'Aggressive',
    tagline: 'ARES does not wait. ARES does not hesitate.',
    stats: [
      { label: 'Max Leverage', value: '10x', colorClass: 'text-ink' },
      { label: 'Direction', value: 'Long + Short', colorClass: 'text-ink' },
      { label: 'Stop-Loss', value: '20%', colorClass: 'text-loss' },
      { label: 'Take-Profit', value: '50%', colorClass: 'text-gain' },
      { label: 'Cooldown', value: '5 min', colorClass: 'text-ink-2' },
      { label: 'Max Positions', value: '5', colorClass: 'text-ink-2' },
    ],
    riskFill: 5,
    accent: '#c94e4e',
    isAggressive: true,
  },
]

function RiskBar({ fill, accent }: { fill: number; accent: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-0.5 w-5 transition-colors"
          style={{ background: i < fill ? accent : '#1c2540' }}
        />
      ))}
    </div>
  )
}

export default function AgentPage() {
  const [aresConfirmPending, setAresConfirmPending] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { data: activeStrategyIndex, refetch } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'activeStrategy',
  })

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  useEffect(() => {
    if (isSuccess) {
      refetch()
      const stratName = STRATEGY_NAMES[activeStrategyIndex ?? 0]
      setSuccessMsg(`Strategy changed to ${stratName}`)
      setTimeout(() => setSuccessMsg(null), 4000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  const activateStrategy = (strategy: StrategyDef) => {
    if (!VAULT_ADDRESS) return
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'setStrategy',
      args: [strategy.index],
    })
    setAresConfirmPending(false)
  }

  const handleActivate = (strategy: StrategyDef) => {
    if (strategy.isAggressive && !aresConfirmPending) {
      setAresConfirmPending(true)
      return
    }
    activateStrategy(strategy)
  }

  const isLoading = isPending || isConfirming

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-lg font-light tracking-[0.15em] text-ink uppercase">
            ARCANA Strategy
          </h1>
          <p className="font-mono text-2xs text-ink-3 mt-0.5">
            Choose the trading strategy ARCANA will execute autonomously
          </p>
        </div>

        {/* Success notification */}
        {successMsg && (
          <div className="border border-gain/30 bg-surface px-3 py-2">
            <span className="font-mono text-xs text-gain">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Strategy grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1c2540]">
        {STRATEGIES.map((strategy) => {
          const isActive = activeStrategyIndex === strategy.index
          const isAresAwaitingConfirm = strategy.isAggressive && aresConfirmPending

          return (
            <div
              key={strategy.name}
              className={`bg-surface p-6 transition-colors ${
                isActive ? 'border-l-2' : 'hover:bg-surface-2'
              }`}
              style={isActive ? { borderLeftColor: strategy.accent } : undefined}
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="font-mono text-xs tracking-widest text-ink-3 mb-1 uppercase">
                    {strategy.label}
                  </div>
                  <div className="font-mono text-lg font-medium text-ink">{strategy.name}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StrategyIcon strategy={strategy.name} size={36} />
                  {isActive && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: strategy.accent }}
                      />
                      <span className="font-mono text-2xs text-ink-2 uppercase tracking-wider">Active</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-[#1c2540] mb-5" />

              {/* Params */}
              <div className="space-y-2.5 mb-5">
                {strategy.stats.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="label">{s.label}</span>
                    <span className={`font-mono text-xs ${s.colorClass}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Risk bar */}
              <div className="flex items-center justify-between mb-5">
                <span className="label">Risk</span>
                <RiskBar fill={strategy.riskFill} accent={strategy.accent} />
              </div>

              {/* Tagline */}
              <p className="text-xs text-ink-3 italic leading-snug border-l-2 border-[#1c2540] pl-3 mb-5">
                {strategy.tagline}
              </p>

              {/* ARES warning (inline, not modal) */}
              {isAresAwaitingConfirm && (
                <div className="mb-4 border border-loss/30 bg-[#0d1421] p-3">
                  <p className="font-mono text-2xs text-loss uppercase tracking-wider mb-1">High Risk Warning</p>
                  <p className="font-mono text-2xs text-ink-3 leading-relaxed mb-3">
                    ARES uses up to 10x leverage. You may lose your entire deposit. This is test USDC only — proceed to confirm.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAresConfirmPending(false)}
                      className="flex-1 border border-[#1c2540] py-1.5 font-mono text-xs text-ink-2 hover:text-ink transition-colors rounded-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => activateStrategy(strategy)}
                      disabled={isLoading}
                      className="flex-1 border border-loss/50 py-1.5 font-mono text-xs text-loss hover:bg-loss/10 transition-colors rounded-sm disabled:opacity-40"
                    >
                      {isLoading ? 'Activating...' : 'Confirm ARES'}
                    </button>
                  </div>
                </div>
              )}

              {/* Activate / Active */}
              {!isAresAwaitingConfirm && (
                isActive ? (
                  <div
                    className="border py-2.5 font-mono text-xs text-center transition-colors"
                    style={{ borderColor: strategy.accent + '40', color: strategy.accent }}
                  >
                    Currently Active
                  </div>
                ) : (
                  <button
                    onClick={() => handleActivate(strategy)}
                    disabled={isLoading || !VAULT_ADDRESS}
                    className="w-full rounded-sm py-2.5 font-mono text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: strategy.accent }}
                  >
                    {isLoading ? 'Processing...' : `Activate ${strategy.name}`}
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>

      {/* Info strip */}
      <div className="border border-[#1c2540] bg-surface p-4 flex items-start gap-4">
        <div className="h-1 w-1 rounded-full bg-hermes mt-1.5 shrink-0" />
        <div>
          <p className="font-mono text-xs text-ink mb-1">How ARCANA uses your strategy</p>
          <p className="font-mono text-2xs text-ink-3 leading-relaxed">
            ARCANA reads the active strategy on-chain every cycle and uses it to determine
            position sizing, leverage caps, directional bias, and risk parameters. Changes take effect
            on the next cycle — you do not interact with ARCANA directly.
          </p>
        </div>
      </div>
    </div>
  )
}
