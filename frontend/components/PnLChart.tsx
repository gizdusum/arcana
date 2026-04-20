'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useReadContract } from 'wagmi'
import { VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts'
import { generateMockNavHistory, NavPoint } from '@/lib/utils'

type Period = '24H' | '7D' | '30D'

interface TooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="border border-[#1c2540] bg-[#111928] px-3 py-2">
      <p className="label mb-1">{label}</p>
      <p className="font-mono text-sm text-ink">
        ${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export function PnLChart() {
  const [period, setPeriod] = useState<Period>('7D')
  const [data, setData] = useState<NavPoint[]>([])

  const { data: totalAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  })

  const baseValue = totalAssets ? Number(totalAssets) / 1e6 : 10000

  useEffect(() => {
    setData(generateMockNavHistory(baseValue, period))
  }, [period, baseValue])

  const firstValue = data[0]?.value ?? 0
  const lastValue = data[data.length - 1]?.value ?? 0
  const change = lastValue - firstValue
  const changePct = firstValue > 0 ? ((change / firstValue) * 100).toFixed(2) : '0.00'
  const isPositive = change >= 0

  const values = data.map((d) => d.value)
  const minVal = values.length ? Math.min(...values) * 0.995 : 0
  const maxVal = values.length ? Math.max(...values) * 1.005 : 1

  return (
    <div className="border border-[#1c2540] bg-surface p-6 scanline-parent">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <span className="label block mb-1">Vault NAV</span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-light text-ink">
              ${lastValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className={`font-mono text-xs ${isPositive ? 'text-gain' : 'text-loss'}`}>
              {isPositive ? '+' : ''}{changePct}%
            </span>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex border border-[#1c2540]">
          {(['24H', '7D', '30D'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 font-mono text-2xs transition-colors ${
                period === p
                  ? 'bg-arc text-white'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="0"
              stroke="#1c2540"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: '#5a6690', fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 5)}
            />
            <YAxis
              domain={[minVal, maxVal]}
              tick={{ fontSize: 9, fill: '#5a6690', fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6e5ff0"
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 3,
                fill: '#6e5ff0',
                stroke: '#080c14',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 font-mono text-2xs text-ink-3 text-center">
        Simulated NAV — on-chain events populate automatically
      </p>
    </div>
  )
}
