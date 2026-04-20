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
    reasoning:
      'Bearish engulfing candle on 1H. EMA50 rejected at resistance. Short signal confirmed.',
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
    reasoning:
      'Strong breakout above 65,000 resistance. Volume surge +240%. RSI=58.1, healthy momentum.',
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

export async function GET() {
  try {
    const res = await fetch(`${HERMES_API_URL}/api/decisions`, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      return NextResponse.json(MOCK_DECISIONS)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // Agent not running — return mock data
    return NextResponse.json(MOCK_DECISIONS)
  }
}
