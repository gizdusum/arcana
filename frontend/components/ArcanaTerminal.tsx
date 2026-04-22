'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useReadContract, useSwitchChain } from 'wagmi'
import { getWalletClient } from 'wagmi/actions'
import { parseUnits, encodeFunctionData } from 'viem'
import Link from 'next/link'
import { VAULT_ADDRESS, USDC_ADDRESS, VAULT_ABI, USDC_ABI } from '@/lib/contracts'
import { wagmiConfig, arcTestnet } from '@/lib/wagmi'
import { timeAgo } from '@/lib/utils'
import { useLang } from '@/lib/lang-context'

// ─── Types ────────────────────────────────────────────────────────────────────

type Strategy = 'APOLLO' | 'ATLAS' | 'ARES'

type Proposal = {
  action: 'deposit' | 'withdraw' | 'change_strategy' | 'open_position' | 'close_position'
  amount_usdc?: number
  strategy?: Strategy
  asset?: string
  direction?: 'long' | 'short'
  size_usdc?: number
  leverage?: number
  reasoning: string
}

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: string[]
  proposal?: Proposal
  pending?: boolean
}

const STRATS: {
  id: Strategy
  label: string
  risk: string
  accent: string
  tagline: string
  maxLev: string
  direction: string
  riskLevel: number
}[] = [
  {
    id: 'APOLLO',
    label: 'Conservative',
    risk: '3× · Long',
    accent: '#6e5ff0',
    tagline: 'Steady and sure. APOLLO protects before it hunts.',
    maxLev: '3×',
    direction: 'Long only',
    riskLevel: 1,
  },
  {
    id: 'ATLAS',
    label: 'Balanced',
    risk: '5× · L+S',
    accent: '#3d9ac2',
    tagline: 'ATLAS holds the weight of every market at once.',
    maxLev: '5×',
    direction: 'Long + Short',
    riskLevel: 3,
  },
  {
    id: 'ARES',
    label: 'Aggressive',
    risk: '10× · L+S',
    accent: '#c94e4e',
    tagline: 'ARES does not wait. ARES does not hesitate.',
    maxLev: '10×',
    direction: 'Long + Short',
    riskLevel: 5,
  },
]

// ─── Prices ───────────────────────────────────────────────────────────────────

type Prices = { btc: number; eth: number; btcChg: number; ethChg: number }

function usePrices() {
  const [p, setP] = useState<Prices | null>(null)
  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
      )
      const d = await r.json()
      setP({
        btc: d.bitcoin.usd,
        eth: d.ethereum.usd,
        btcChg: d.bitcoin.usd_24h_change ?? 0,
        ethChg: d.ethereum.usd_24h_change ?? 0,
      })
    } catch {}
  }, [])
  useEffect(() => {
    fetch_()
    const iv = setInterval(fetch_, 20_000)
    return () => clearInterval(iv)
  }, [fetch_])
  return p
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({
  prices,
  selectedStrategy,
}: {
  prices: Prices | null
  selectedStrategy: Strategy | null
}) {
  const { address, isConnected } = useAccount()
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const sign = (n: number) => (n >= 0 ? '+' : '')
  const chgColor = (n: number) => (n >= 0 ? 'var(--gain)' : 'var(--loss)')

  const { data: totalAssets } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalAssets' })
  const { data: lastCycle } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'lastHermesCycle' })
  const { data: totalTrades } = useReadContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: 'totalTradesExecuted' })

  const tvl = totalAssets ? `$${(Number(totalAssets) / 1e6).toFixed(2)}` : '—'
  const stratAccent = selectedStrategy ? STRATS.find((s) => s.id === selectedStrategy)?.accent : 'var(--hermes)'

  return (
    <aside
      className="hidden lg:flex flex-col gap-0 shrink-0"
      style={{ width: '200px', borderRight: '1px solid var(--border)', background: 'var(--surface)' }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-4 w-px" style={{ background: 'linear-gradient(to bottom, transparent, var(--arc), transparent)' }} />
          <span className="font-mono text-xs font-semibold tracking-[0.25em]" style={{ color: 'var(--ink)' }}>
            ARCANA
          </span>
        </div>
        <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Arc Testnet · 5042002</span>
      </div>

      {/* Markets */}
      <div className="px-4 py-4 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
        <span className="label block">Markets</span>
        {prices ? (
          <>
            {[
              { sym: 'BTC', price: prices.btc, chg: prices.btcChg },
              { sym: 'ETH', price: prices.eth, chg: prices.ethChg },
            ].map((m) => (
              <div key={m.sym} className="flex items-center justify-between">
                <span className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>{m.sym}</span>
                <div className="text-right">
                  <div className="font-mono text-xs" style={{ color: 'var(--ink)' }}>${fmt(m.price)}</div>
                  <div className="font-mono text-2xs" style={{ color: chgColor(m.chg) }}>
                    {sign(m.chg)}{m.chg.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 rounded-sm" style={{ background: 'var(--surface-2)' }} />
            <div className="h-3 rounded-sm" style={{ background: 'var(--surface-2)' }} />
          </div>
        )}
      </div>

      {/* Vault */}
      <div className="px-4 py-4 border-b space-y-2.5" style={{ borderColor: 'var(--border)' }}>
        <span className="label block">Vault</span>
        {[
          { label: 'TVL', value: tvl },
          { label: 'Strategy', value: selectedStrategy ?? '—', color: stratAccent },
          { label: 'Trades', value: totalTrades !== undefined ? totalTrades.toString() : '—' },
        ].map((row) => (
          <div key={row.label} className="flex justify-between items-center">
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>{row.label}</span>
            <span className="font-mono text-2xs" style={{ color: row.color ?? 'var(--ink)' }}>{row.value}</span>
          </div>
        ))}
        {lastCycle && Number(lastCycle) > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>Cycle</span>
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>{timeAgo(Number(lastCycle))}</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="px-4 py-4 border-b space-y-1" style={{ borderColor: 'var(--border)' }}>
        {[
          { href: '/vault',  label: 'Vault',     icon: '◈' },
          { href: '/trade',  label: 'Trade',      icon: '◉' },
          { href: '/agent',  label: 'Strategy',   icon: '◎' },
          { href: '/log',    label: 'Agent Log',  icon: '◌' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2 px-2 py-1.5 rounded-sm font-mono text-2xs transition-all"
            style={{ color: 'var(--ink-2)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--ink)'
              ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--ink-2)'
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            <span style={{ color: 'var(--ink-3)' }}>{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </div>

      {/* Wallet */}
      <div className="px-4 py-4 mt-auto">
        {isConnected && address ? (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full hermes-alive" style={{ background: 'var(--gain)' }} />
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-2)' }}>
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ink-3)' }} />
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>not connected</span>
          </div>
        )}
        <div className="mt-2 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full" style={{ background: 'var(--arc)', opacity: 0.4 }} />
          <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)', opacity: 0.4 }}>Hermes 3 · 70B</span>
        </div>
      </div>
    </aside>
  )
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onApprove,
  onDecline,
  executing,
}: {
  proposal: Proposal
  onApprove: () => void
  onDecline: () => void
  executing: boolean
}) {
  const dirColor = proposal.direction === 'long' ? 'var(--gain)' : 'var(--loss)'
  const accentMap: Record<string, string> = {
    APOLLO: '#6e5ff0',
    ATLAS: '#3d9ac2',
    ARES: '#c94e4e',
  }
  const accent =
    proposal.action === 'open_position' ? dirColor :
    proposal.action === 'close_position' ? 'var(--loss)' :
    proposal.strategy ? accentMap[proposal.strategy] :
    proposal.action === 'deposit' ? 'var(--gain)' :
    proposal.action === 'withdraw' ? 'var(--loss)' : 'var(--arc)'

  const label =
    proposal.action === 'deposit'         ? `Deposit $${proposal.amount_usdc}` :
    proposal.action === 'withdraw'        ? `Withdraw $${proposal.amount_usdc}` :
    proposal.action === 'change_strategy' ? `Switch → ${proposal.strategy}` :
    proposal.action === 'open_position'   ? `${proposal.direction?.toUpperCase()} ${proposal.asset} · $${proposal.size_usdc} · ${proposal.leverage}×` :
    proposal.action === 'close_position'  ? `Close ${proposal.asset}` : 'Action'

  return (
    <div
      className="mt-2 rounded-sm text-xs overflow-hidden"
      style={{ border: `1px solid ${accent}20`, background: `${accent}05` }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${accent}12`, background: `${accent}08` }}
      >
        <span className="font-mono text-2xs tracking-widest uppercase font-medium" style={{ color: accent }}>
          proposal
        </span>
        <span className="flex-1" />
        <span className="font-mono text-xs font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="font-mono text-2xs leading-relaxed mb-2.5" style={{ color: 'var(--ink-2)' }}>
          {proposal.reasoning}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={executing}
            className="font-mono text-2xs px-3 py-1.5 rounded-sm transition-all disabled:opacity-40"
            style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}25` }}
          >
            {executing ? 'signing...' : 'approve'}
          </button>
          <button
            onClick={onDecline}
            disabled={executing}
            className="font-mono text-2xs px-3 py-1.5 rounded-sm transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--ink-3)' }}
          >
            decline
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Strategy Selection Screen ────────────────────────────────────────────────

function StrategySelector({ onSelect }: { onSelect: (s: Strategy) => void }) {
  const { t } = useLang()

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-10">
      {/* Title */}
      <div className="text-center mb-12">
        <div
          className="font-mono font-light tracking-[0.4em] mb-3"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            color: 'var(--ink)',
            textShadow: '0 0 40px rgba(110,95,240,0.25)',
          }}
        >
          ARCANA
        </div>
        <p className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
          Autonomous DeFi Trading Agent
        </p>
        <p className="font-mono text-2xs mt-1.5 tracking-widest uppercase" style={{ color: 'var(--ink-3)' }}>
          {t.terminal.selectStrategy}
        </p>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
        {STRATS.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className="strategy-card rounded-sm p-5 text-left flex flex-col gap-3 group"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${s.accent}25`,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.boxShadow = `0 0 24px ${s.accent}20, 0 0 0 1px ${s.accent}35`
              el.style.borderColor = `${s.accent}40`
              el.style.transform = 'translateY(-4px)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.boxShadow = ''
              el.style.borderColor = `${s.accent}25`
              el.style.transform = 'translateY(0)'
            }}
          >
            {/* Top bar */}
            <div className="h-0.5 w-full rounded-full -mt-5 -mx-5 mb-1" style={{ background: s.accent, width: 'calc(100% + 2.5rem)' }} />

            {/* Name */}
            <div>
              <span className="font-mono text-2xs uppercase tracking-widest block mb-1" style={{ color: s.accent, opacity: 0.8 }}>
                {s.label}
              </span>
              <span className="font-mono text-xl font-light tracking-[0.15em]" style={{ color: 'var(--ink)' }}>
                {s.id}
              </span>
            </div>

            {/* Risk dots */}
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-full rounded-full"
                  style={{ background: i < s.riskLevel ? s.accent : 'var(--border-2)' }}
                />
              ))}
            </div>

            {/* Stats */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Leverage</span>
                <span className="font-mono text-2xs" style={{ color: 'var(--ink)' }}>{s.maxLev}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Direction</span>
                <span className="font-mono text-2xs" style={{ color: 'var(--ink)' }}>{s.direction}</span>
              </div>
            </div>

            {/* Tagline */}
            <p className="font-mono text-2xs leading-snug" style={{ color: 'var(--ink-2)', opacity: 0.7 }}>
              {s.tagline}
            </p>

            {/* Select CTA */}
            <div
              className="mt-1 text-center font-mono text-2xs tracking-widest uppercase py-1.5 rounded-sm transition-all"
              style={{ color: s.accent, background: `${s.accent}10`, border: `1px solid ${s.accent}20` }}
            >
              Select
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main terminal ────────────────────────────────────────────────────────────

export function ArcanaTerminal() {
  const router = useRouter()
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { t } = useLang()
  const prices = usePrices()

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [executingId, setExecutingId] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const addMsg = useCallback((msg: Omit<Message, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${Math.random()}` }])
  }, [])

  const selectStrategy = (s: Strategy) => {
    setSelectedStrategy(s)
    setStarted(true)
    setMessages([{
      id: 'init',
      role: 'system',
      content: `${s} strategy active. Ask me to open positions, check your balance, or manage the vault.`,
    }])
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const executeProposal = async (msgId: string, proposal: Proposal) => {
    if (!address) { addMsg({ role: 'system', content: 'Connect wallet to execute.' }); return }

    if (chainId !== arcTestnet.id) {
      try {
        addMsg({ role: 'system', content: 'Switching to Arc Testnet...' })
        await switchChainAsync({ chainId: arcTestnet.id })
      } catch {
        addMsg({ role: 'system', content: 'Please switch your wallet to Arc Testnet (5042002) manually.' })
        return
      }
    }

    let wc
    try {
      wc = await getWalletClient(wagmiConfig, { chainId: arcTestnet.id })
    } catch {
      addMsg({ role: 'system', content: 'Could not get wallet client. Is your wallet unlocked?' })
      return
    }

    setExecutingId(msgId)
    try {
      if (proposal.action === 'deposit' && proposal.amount_usdc) {
        const amount = parseUnits(String(proposal.amount_usdc), 6)
        addMsg({ role: 'system', content: 'Approving USDC...' })
        const ah = await wc.sendTransaction({
          to: USDC_ADDRESS,
          data: encodeFunctionData({ abi: USDC_ABI, functionName: 'approve', args: [VAULT_ADDRESS, amount] }),
        })
        addMsg({ role: 'system', content: `Approved (${ah.slice(0, 10)}...) — depositing...` })
        const dh = await wc.sendTransaction({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'deposit', args: [amount, address] }),
        })
        addMsg({ role: 'system', content: `Deposited (${dh.slice(0, 10)}...) → Vault` })
        setTimeout(() => router.push('/vault'), 1500)
      } else if (proposal.action === 'withdraw' && proposal.amount_usdc) {
        const shares = parseUnits(String(proposal.amount_usdc), 6)
        const h = await wc.sendTransaction({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'requestWithdraw', args: [shares] }),
        })
        addMsg({ role: 'system', content: `Withdrawal requested (${h.slice(0, 10)}...)` })
      } else if (proposal.action === 'change_strategy' && proposal.strategy) {
        const idx: Record<Strategy, number> = { APOLLO: 0, ATLAS: 1, ARES: 2 }
        const h = await wc.sendTransaction({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'setStrategy', args: [idx[proposal.strategy]] }),
        })
        setSelectedStrategy(proposal.strategy)
        addMsg({ role: 'system', content: `Strategy → ${proposal.strategy} (${h.slice(0, 10)}...)` })
        setTimeout(() => router.push('/trade'), 1500)
      } else if (proposal.action === 'open_position') {
        const stratMap: Record<string, Strategy> = { long: 'APOLLO', short: 'ATLAS' }
        const newStrat = stratMap[proposal.direction ?? 'long'] as Strategy
        if (selectedStrategy !== newStrat) {
          const idx: Record<Strategy, number> = { APOLLO: 0, ATLAS: 1, ARES: 2 }
          await wc.sendTransaction({
            to: VAULT_ADDRESS,
            data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'setStrategy', args: [idx[newStrat]] }),
          })
          setSelectedStrategy(newStrat)
        }
        addMsg({ role: 'system', content: `${proposal.direction?.toUpperCase()} ${proposal.asset} queued → Trade` })
        setTimeout(() => router.push('/trade'), 1500)
      } else if (proposal.action === 'close_position') {
        addMsg({ role: 'system', content: `Close signal queued for ${proposal.asset} → Trade` })
        setTimeout(() => router.push('/trade'), 1500)
      }
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, proposal: undefined } : m))
    } catch (err) {
      addMsg({ role: 'system', content: `Error: ${err instanceof Error ? err.message.slice(0, 80) : 'failed'}` })
    } finally {
      setExecutingId(null)
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    const assistantId = `a-${Date.now()}`
    const history = messages
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    history.push({ role: 'user', content: text })

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', pending: true },
    ])
    setInput('')
    setLoading(true)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userAddress: address, strategy: selectedStrategy }),
      })
      if (!res.ok || !res.body) throw new Error(`API ${res.status}`)

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = '', text2 = '', tools: string[] = [], proposal: Proposal | undefined

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') break
          try {
            const ev = JSON.parse(raw)
            if (ev.type === 'text') {
              text2 += ev.content
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: text2, toolCalls: tools, pending: false } : m))
            } else if (ev.type === 'tool_call') {
              tools = [...tools, ev.name]
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, toolCalls: tools, pending: true } : m))
            } else if (ev.type === 'proposal') {
              proposal = ev as Proposal
            } else if (ev.type === 'error') {
              text2 = `⚠ ${ev.message}`
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: text2, pending: false } : m))
            }
          } catch {}
        }
      }
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: text2 || '—', toolCalls: tools, proposal, pending: false } : m
      ))
    } catch (err) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: `Connection error: ${err instanceof Error ? err.message : 'unknown'}`, pending: false }
          : m
      ))
    } finally {
      setLoading(false)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex"
      style={{ height: 'calc(100vh - 56px)', minHeight: '520px', overflow: 'hidden' }}
    >
      <Sidebar prices={prices} selectedStrategy={selectedStrategy} />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Strategy tabs */}
        <div
          className="flex items-center gap-0 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center">
            {STRATS.map((s) => {
              const active = selectedStrategy === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => selectStrategy(s.id)}
                  className="relative px-5 py-3 font-mono text-xs transition-all border-r"
                  style={{
                    borderColor: 'var(--border)',
                    color: active ? s.accent : 'var(--ink-3)',
                    background: active ? `${s.accent}08` : 'transparent',
                  }}
                >
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-px" style={{ background: s.accent }} />
                  )}
                  <span className="font-medium">{s.id}</span>
                  <span className="ml-2 text-2xs opacity-60 hidden sm:inline">{s.risk}</span>
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 px-4">
            <span
              className="h-1.5 w-1.5 rounded-full hermes-alive"
              style={{ background: selectedStrategy ? STRATS.find((s) => s.id === selectedStrategy)?.accent : 'var(--hermes)' }}
            />
            <span className="font-mono text-2xs hidden sm:inline" style={{ color: 'var(--ink-3)' }}>Hermes 3</span>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesRef}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-3"
          style={{ background: 'var(--bg)' }}
        >
          {!started && <StrategySelector onSelect={selectStrategy} />}

          {messages.map((msg) => (
            <div key={msg.id} className="slide-up">
              {msg.role === 'system' && (
                <div className="flex gap-2 font-mono text-xs" style={{ color: 'var(--ink-3)' }}>
                  <span style={{ opacity: 0.4 }}>—</span>
                  <span>{msg.content}</span>
                </div>
              )}
              {msg.role === 'user' && (
                <div className="flex gap-2 font-mono text-xs">
                  <span className="shrink-0" style={{ color: 'var(--arc)' }}>›</span>
                  <span style={{ color: 'var(--ink)' }}>{msg.content}</span>
                </div>
              )}
              {msg.role === 'assistant' && (
                <div className="flex gap-2 font-mono text-xs">
                  <span className="shrink-0 font-bold" style={{ color: 'var(--arc)' }}>A</span>
                  <div className="flex-1 min-w-0">
                    {(msg.toolCalls?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {msg.toolCalls!.map((tc, i) => (
                          <span
                            key={i}
                            className="font-mono text-2xs px-1.5 py-0.5 rounded-sm"
                            style={{
                              color: 'rgba(110,95,240,0.6)',
                              border: '1px solid rgba(110,95,240,0.15)',
                              background: 'rgba(110,95,240,0.06)',
                            }}
                          >
                            <span className="inline-block h-1 w-1 rounded-full mr-1 animate-pulse align-middle" style={{ background: 'rgba(110,95,240,0.5)' }} />
                            {tc === 'read_vault_state' ? 'reading vault' : tc === 'get_market_prices' ? 'fetching prices' : tc}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.pending && !msg.content ? (
                      <span className="inline-block w-1.5 h-3.5 align-middle cursor-blink" style={{ background: 'var(--arc)' }} />
                    ) : (
                      <span className="whitespace-pre-wrap leading-relaxed break-words" style={{ color: 'var(--ink-2)' }}>
                        {msg.content}
                        {msg.pending && (
                          <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle cursor-blink" style={{ background: 'var(--arc)' }} />
                        )}
                      </span>
                    )}
                    {msg.proposal && (
                      <ProposalCard
                        proposal={msg.proposal}
                        executing={executingId === msg.id}
                        onApprove={() => executeProposal(msg.id, msg.proposal!)}
                        onDecline={() => setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, proposal: undefined } : m))}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input area */}
        <div
          className="shrink-0 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {/* Hint bar */}
          {started && (
            <div
              className="px-5 py-1.5 flex flex-wrap items-center gap-3 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              {[t.terminal.hint1, t.terminal.hint2, t.terminal.hint3].map((h, i) => (
                <span key={i} className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
                  {i > 0 && <span className="mr-3">·</span>}{h}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-end gap-3 px-5 py-3">
            <span
              className="font-mono text-sm pb-0.5 shrink-0"
              style={{
                color: started ? 'var(--arc)' : 'var(--ink-3)',
                textShadow: started ? '0 0 8px rgba(110,95,240,0.5)' : 'none',
              }}
            >›</span>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              disabled={loading || !started}
              placeholder={started ? t.terminal.placeholder : t.terminal.placeholderInactive}
              rows={1}
              className="flex-1 min-w-0 bg-transparent font-mono text-sm placeholder:text-[var(--ink-3)]/30 outline-none disabled:opacity-30 leading-relaxed overflow-hidden"
              style={{
                height: '1.75rem',
                maxHeight: '96px',
                resize: 'none',
                caretColor: 'var(--arc)',
                color: 'var(--ink)',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || !started}
              className="font-mono text-xs rounded-sm px-3 py-1.5 transition-all disabled:opacity-20 shrink-0"
              style={{
                color: 'var(--arc)',
                border: '1px solid rgba(110,95,240,0.2)',
                background: 'rgba(110,95,240,0.06)',
              }}
            >
              {loading ? '···' : t.terminal.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
