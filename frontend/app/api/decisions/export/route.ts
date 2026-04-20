import { NextResponse } from 'next/server'

const HERMES_API_URL = process.env.NEXT_PUBLIC_HERMES_API_URL || 'http://localhost:3001'

const MOCK_DECISIONS = [
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
]

export async function GET() {
  try {
    const res = await fetch(`${HERMES_API_URL}/api/decisions`, {
      signal: AbortSignal.timeout(3000),
    })

    let decisions = MOCK_DECISIONS

    if (res.ok) {
      decisions = await res.json()
    }

    const headers = [
      'id',
      'timestamp',
      'date',
      'strategy',
      'action',
      'market',
      'confidence',
      'leverage',
      'reasoning',
      'priceAtDecision',
      'positionId',
      'txHash',
    ]

    const rows = decisions.map((d: Record<string, unknown>) =>
      [
        d.id,
        d.timestamp,
        new Date(Number(d.timestamp) * 1000).toISOString(),
        d.strategy,
        d.action,
        d.market,
        d.confidence,
        d.leverage ?? '',
        `"${String(d.reasoning ?? '').replace(/"/g, '""')}"`,
        d.priceAtDecision,
        d.positionId ?? '',
        d.txHash ?? '',
      ].join(',')
    )

    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="hermes-decisions-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch {
    return new NextResponse('Error generating CSV', { status: 500 })
  }
}
