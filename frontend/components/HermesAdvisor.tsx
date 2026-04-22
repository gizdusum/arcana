'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useWalletClient } from 'wagmi'
import { parseUnits, encodeFunctionData } from 'viem'
import { VAULT_ADDRESS, USDC_ADDRESS, VAULT_ABI, USDC_ABI } from '@/lib/contracts'

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

const STRATEGIES: { id: Strategy; label: string; desc: string; accent: string }[] = [
  { id: 'APOLLO', label: 'Apollo', desc: 'Conservative · 3x · Long only', accent: '#6e5ff0' },
  { id: 'ATLAS',  label: 'Atlas',  desc: 'Balanced · 5x · Long + Short', accent: '#3d9ac2' },
  { id: 'ARES',   label: 'Ares',   desc: 'Aggressive · 10x · Long + Short', accent: '#c94e4e' },
]

function ToolPill({ name }: { name: string }) {
  const label: Record<string, string> = {
    read_vault_state: 'reading vault',
    get_market_prices: 'fetching prices',
    propose_transaction: 'composing proposal',
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-2xs border rounded-sm px-1.5 py-0.5"
      style={{ color: 'rgba(110,95,240,0.6)', borderColor: 'rgba(110,95,240,0.15)', background: 'rgba(110,95,240,0.05)' }}>
      <span className="h-1 w-1 rounded-full animate-pulse" style={{ background: 'rgba(110,95,240,0.5)' }} />
      {label[name] ?? name}
    </span>
  )
}

function ProposalCard({
  proposal, onApprove, onDecline, executing,
}: {
  proposal: Proposal
  onApprove: () => void
  onDecline: () => void
  executing: boolean
}) {
  const accentMap: Record<string, string> = { APOLLO: '#6e5ff0', ATLAS: '#3d9ac2', ARES: '#c94e4e' }
  const directionColor = proposal.direction === 'long' ? '#1db87a' : '#c94e4e'

  const accent =
    proposal.action === 'open_position' ? directionColor :
    proposal.action === 'close_position' ? '#c94e4e' :
    proposal.strategy ? accentMap[proposal.strategy] :
    proposal.action === 'deposit' ? '#1db87a' :
    proposal.action === 'withdraw' ? '#c94e4e' : '#6e5ff0'

  const label =
    proposal.action === 'deposit'        ? `Deposit $${proposal.amount_usdc} USDC` :
    proposal.action === 'withdraw'       ? `Withdraw $${proposal.amount_usdc} USDC` :
    proposal.action === 'change_strategy' ? `Switch to ${proposal.strategy}` :
    proposal.action === 'open_position'  ? `Open ${proposal.direction?.toUpperCase()} ${proposal.asset} · $${proposal.size_usdc} · ${proposal.leverage}x` :
    proposal.action === 'close_position' ? `Close ${proposal.asset} position` :
    'Action'

  const icon =
    proposal.action === 'open_position' && proposal.direction === 'long'  ? '↑' :
    proposal.action === 'open_position' && proposal.direction === 'short' ? '↓' :
    proposal.action === 'close_position' ? '×' :
    proposal.action === 'deposit' ? '+' : '→'

  return (
    <div className="mt-3 rounded-sm overflow-hidden" style={{ border: `1px solid ${accent}25`, background: `${accent}06` }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${accent}15`, background: `${accent}08` }}>
        <span className="font-mono text-base font-light" style={{ color: accent }}>{icon}</span>
        <span className="font-mono text-2xs tracking-widest uppercase font-medium" style={{ color: accent }}>
          Proposal
        </span>
        <span className="flex-1" />
        <span className="font-mono text-xs text-ink font-medium">{label}</span>
      </div>
      {/* Reasoning */}
      <div className="px-3 py-2.5">
        <p className="font-mono text-xs text-ink-2 leading-relaxed mb-3">{proposal.reasoning}</p>
        <div className="flex gap-2">
          <button
            onClick={onApprove}
            disabled={executing}
            className="flex-1 font-mono text-xs py-1.5 rounded-sm transition-all disabled:opacity-40"
            style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}
          >
            {executing ? 'signing...' : 'approve & sign'}
          </button>
          <button
            onClick={onDecline}
            disabled={executing}
            className="font-mono text-xs px-4 py-1.5 rounded-sm text-ink-2 transition-colors disabled:opacity-40"
            style={{ border: '1px solid #161e35' }}
          >
            decline
          </button>
        </div>
      </div>
    </div>
  )
}

export function HermesAdvisor() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [executingId, setExecutingId] = useState<string | null>(null)

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
    setMessages([{
      id: 'init',
      role: 'system',
      content: `Strategy: ${s} · ARCANA advisor online.`,
    }])
  }

  const executeProposal = async (msgId: string, proposal: Proposal) => {
    if (!walletClient || !address) {
      addMsg({ role: 'system', content: 'Connect wallet to execute.' })
      return
    }
    setExecutingId(msgId)
    try {
      if (proposal.action === 'deposit' && proposal.amount_usdc) {
        const amount = parseUnits(String(proposal.amount_usdc), 6)
        addMsg({ role: 'system', content: 'Step 1/2 — approving USDC...' })
        const approveHash = await walletClient.sendTransaction({
          to: USDC_ADDRESS,
          data: encodeFunctionData({ abi: USDC_ABI, functionName: 'approve', args: [VAULT_ADDRESS, amount] }),
        })
        addMsg({ role: 'system', content: `Approved (${approveHash.slice(0, 10)}...) — depositing...` })
        const depositHash = await walletClient.sendTransaction({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'deposit', args: [amount, address] }),
        })
        addMsg({ role: 'system', content: `Deposit confirmed (${depositHash.slice(0, 10)}...) → Vault` })
        setTimeout(() => router.push('/vault'), 2000)
      } else if (proposal.action === 'withdraw' && proposal.amount_usdc) {
        const shares = parseUnits(String(proposal.amount_usdc), 6)
        const hash = await walletClient.sendTransaction({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'requestWithdraw', args: [shares] }),
        })
        addMsg({ role: 'system', content: `Withdrawal requested (${hash.slice(0, 10)}...)` })
      } else if (proposal.action === 'change_strategy' && proposal.strategy) {
        const idx: Record<Strategy, number> = { APOLLO: 0, ATLAS: 1, ARES: 2 }
        const hash = await walletClient.sendTransaction({
          to: VAULT_ADDRESS,
          data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'setStrategy', args: [idx[proposal.strategy]] }),
        })
        addMsg({ role: 'system', content: `Strategy → ${proposal.strategy} (${hash.slice(0, 10)}...) → Trade` })
        setSelectedStrategy(proposal.strategy)
        setTimeout(() => router.push('/trade'), 1500)
      } else if (proposal.action === 'open_position' && proposal.asset && proposal.direction) {
        const strategyForDirection = proposal.direction === 'long' ? 'APOLLO' : 'ATLAS'
        const currentStrategy = selectedStrategy
        if (currentStrategy !== strategyForDirection) {
          const idx: Record<Strategy, number> = { APOLLO: 0, ATLAS: 1, ARES: 2 }
          const hash = await walletClient.sendTransaction({
            to: VAULT_ADDRESS,
            data: encodeFunctionData({ abi: VAULT_ABI, functionName: 'setStrategy', args: [idx[strategyForDirection]] }),
          })
          setSelectedStrategy(strategyForDirection)
          addMsg({ role: 'system', content: `Strategy → ${strategyForDirection}. ARCANA will open ${proposal.direction?.toUpperCase()} ${proposal.asset} on next cycle. (${hash.slice(0, 10)}...) Redirecting to Trade...` })
        } else {
          addMsg({ role: 'system', content: `${proposal.direction?.toUpperCase()} ${proposal.asset} queued. Redirecting to Trade...` })
        }
        setTimeout(() => router.push('/trade'), 1500)
      } else if (proposal.action === 'close_position' && proposal.asset) {
        addMsg({ role: 'system', content: `Close signal queued for ${proposal.asset}. Redirecting to Trade...` })
        setTimeout(() => router.push('/trade'), 1500)
      }
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, proposal: undefined } : m))
    } catch (err) {
      addMsg({ role: 'system', content: `Error: ${err instanceof Error ? err.message.slice(0, 80) : 'transaction failed'}` })
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

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch('/api/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userAddress: address, strategy: selectedStrategy }),
      })

      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`)

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      let text2 = ''
      let tools: string[] = []
      let proposal: Proposal | undefined

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
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId ? { ...m, content: text2, toolCalls: tools, pending: false } : m
              ))
            } else if (ev.type === 'tool_call') {
              tools = [...tools, ev.name]
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId ? { ...m, toolCalls: tools, pending: true } : m
              ))
            } else if (ev.type === 'proposal') {
              proposal = ev as Proposal
            } else if (ev.type === 'error') {
              text2 = `⚠ ${ev.message}`
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId ? { ...m, content: text2, pending: false } : m
              ))
            }
          } catch { /* ignore SSE parse errors */ }
        }
      }

      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: text2 || '—', toolCalls: tools, proposal, pending: false }
          : m
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="py-20 px-4 border-t border-[#161e35]">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="font-mono text-xs font-medium tracking-[0.2em] uppercase"
                style={{ color: '#c4d0ea', textShadow: '0 0 12px rgba(110,95,240,0.4)' }}
              >
                ARCANA
              </span>
              <span className="font-mono text-2xs tracking-widest" style={{ color: 'rgba(110,95,240,0.5)' }}>· ADVISOR</span>
            </div>
            <p className="font-mono text-2xs text-ink-2">Hermes 3 · Arc Testnet · propose · sign · execute</p>
          </div>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, #161e35, transparent)' }} />
          {isConnected && (
            <span className="flex items-center gap-1.5 font-mono text-2xs text-gain">
              <span className="h-1.5 w-1.5 rounded-full bg-gain animate-pulse" />
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          )}
        </div>

        {/* Strategy selector */}
        {!selectedStrategy ? (
          <div
            className="border rounded-sm overflow-hidden"
            style={{ borderColor: '#161e35', background: 'linear-gradient(135deg, #0b0f1c 0%, #0d1220 100%)' }}
          >
            <div className="px-8 pt-8 pb-6 text-center">
              <p className="font-mono text-xs text-ink-2 tracking-widest uppercase mb-1">Initialize Session</p>
              <p className="font-mono text-2xs text-ink-3">Select a trading strategy to begin</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: '#161e35' }}>
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectStrategy(s.id)}
                  className="group relative text-left transition-all overflow-hidden"
                  style={{ background: '#0b0f1c', padding: '1.75rem' }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `radial-gradient(ellipse at top left, ${s.accent}08, transparent 70%)` }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="h-px w-4" style={{ background: s.accent + '60' }} />
                      <span className="font-mono text-2xs tracking-widest text-ink-2 uppercase">{s.id}</span>
                    </div>
                    <div
                      className="font-mono text-xl font-light mb-1 transition-all group-hover:text-shadow"
                      style={{ color: s.accent }}
                    >
                      {s.label}
                    </div>
                    <div className="font-mono text-2xs text-ink-2">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-6 py-3 text-center border-t border-[#161e35]">
              <p className="font-mono text-2xs text-ink-3/50">
                ARCANA will advise and execute within your chosen parameters
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Strategy switcher */}
            <div className="flex items-center gap-2 mb-4">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectStrategy(s.id)}
                  className="font-mono text-2xs px-3 py-1 rounded-sm border transition-all"
                  style={
                    s.id === selectedStrategy
                      ? { borderColor: s.accent + '50', color: s.accent, background: s.accent + '10', textShadow: `0 0 8px ${s.accent}40` }
                      : { borderColor: '#161e35', color: '#4a5878' }
                  }
                >
                  {s.id}
                </button>
              ))}
              <span className="font-mono text-2xs text-ink-3 ml-1">active</span>
            </div>

            {/* Terminal */}
            <div
              className="rounded-sm overflow-hidden"
              style={{
                border: '1px solid #161e35',
                background: '#060910',
                boxShadow: '0 0 0 1px rgba(110,95,240,0.05), 0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {/* Title bar */}
              <div
                className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{ borderColor: '#161e35', background: '#0b0f1c' }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#c94e4e', opacity: 0.6 }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#b8913a', opacity: 0.6 }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#1db87a', opacity: 0.6 }} />
                <div className="flex-1" />
                <span className="font-mono text-2xs text-ink-3">
                  arcana://advisor · {selectedStrategy} · Hermes 3
                </span>
              </div>

              {/* Messages */}
              <div ref={messagesRef} className="h-96 overflow-y-auto p-5 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="slide-up">
                    {msg.role === 'system' && (
                      <div className="flex gap-2 font-mono text-xs text-ink-3">
                        <span style={{ color: 'rgba(110,95,240,0.3)' }} className="shrink-0">—</span>
                        <span>{msg.content}</span>
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div className="flex gap-2 font-mono text-xs">
                        <span className="shrink-0" style={{ color: '#6e5ff0' }}>›</span>
                        <span className="text-ink">{msg.content}</span>
                      </div>
                    )}
                    {msg.role === 'assistant' && (
                      <div className="flex gap-2 font-mono text-xs">
                        <span className="shrink-0 font-semibold" style={{ color: '#6e5ff0' }}>A</span>
                        <div className="flex-1">
                          {(msg.toolCalls?.length ?? 0) > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {msg.toolCalls!.map((tc, i) => <ToolPill key={i} name={tc} />)}
                            </div>
                          )}
                          {msg.pending && !msg.content ? (
                            <span
                              className="inline-block w-1.5 h-3.5 align-middle cursor-blink"
                              style={{ background: '#6e5ff0' }}
                            />
                          ) : (
                            <span className="text-ink-2/90 whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                              {msg.pending && (
                                <span
                                  className="inline-block w-1.5 h-3.5 ml-0.5 align-middle cursor-blink"
                                  style={{ background: '#6e5ff0' }}
                                />
                              )}
                            </span>
                          )}
                          {msg.proposal && (
                            <ProposalCard
                              proposal={msg.proposal}
                              executing={executingId === msg.id}
                              onApprove={() => executeProposal(msg.id, msg.proposal!)}
                              onDecline={() =>
                                setMessages((prev) =>
                                  prev.map((m) => m.id === msg.id ? { ...m, proposal: undefined } : m)
                                )
                              }
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, #161e35 20%, #161e35 80%, transparent)' }} />

              {/* Input row */}
              <div className="p-3 flex items-end gap-3" style={{ background: '#060910' }}>
                <span
                  className="font-mono text-sm pb-0.5 shrink-0"
                  style={{ color: '#6e5ff0', textShadow: '0 0 8px rgba(110,95,240,0.5)' }}
                >›</span>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={loading}
                  placeholder="Ask about your portfolio, or say 'long ETH 200 USDC'..."
                  rows={1}
                  style={{ height: '1.75rem', maxHeight: '8rem', resize: 'none', caretColor: '#6e5ff0' }}
                  className="flex-1 bg-transparent font-mono text-sm text-ink placeholder:text-ink-3/40 outline-none disabled:opacity-40 leading-relaxed overflow-hidden"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="font-mono text-xs rounded-sm px-3 py-1.5 transition-all disabled:opacity-20 shrink-0"
                  style={{
                    color: '#6e5ff0',
                    border: '1px solid rgba(110,95,240,0.25)',
                    background: 'rgba(110,95,240,0.05)',
                  }}
                >
                  {loading ? '···' : 'send'}
                </button>
              </div>
            </div>

            {/* Hint */}
            <p className="mt-2 font-mono text-2xs text-ink-3/40 text-center">
              Try: "go long ETH 100 USDC" · "switch to ARES" · "what's my vault balance?"
            </p>
          </>
        )}
      </div>
    </section>
  )
}
