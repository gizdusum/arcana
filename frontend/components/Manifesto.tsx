'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

const STEPS = [
  {
    num: '01',
    title: 'Connect & Deposit',
    body: 'Deposit USDC. No ETH needed, no bridging. Your funds are tokenized as aUSDC shares — redeemable anytime after a 24-hour unlock.',
    accent: '#6e5ff0',
  },
  {
    num: '02',
    title: 'Choose a Strategy',
    body: 'APOLLO for steady growth. ATLAS for balanced exposure. ARES for maximum aggression. One selection sets your entire risk profile.',
    accent: '#3d9ac2',
  },
  {
    num: '03',
    title: 'ARCANA Trades',
    body: 'The autonomous agent monitors markets 24/7, opens perpetual positions, and manages risk — all on-chain, fully auditable.',
    accent: '#b8913a',
  },
  {
    num: '04',
    title: 'Track & Control',
    body: 'Chat with ARCANA for real-time advice. Approve or decline any proposed transaction with a single signature.',
    accent: '#1db87a',
  },
]

const PILLARS = [
  {
    title: 'On-Chain AI',
    body: 'Every ARCANA decision is a real transaction on Arc — verifiable, immutable, never hidden.',
  },
  {
    title: 'Non-Custodial',
    body: 'ARCANA can trade but cannot withdraw. Your USDC stays in the smart contract at all times.',
  },
  {
    title: 'Built for Arc',
    body: "Sub-second finality and USDC-native gas make ARCANA possible. It couldn't exist anywhere else.",
  },
]

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translateY(24px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export function Manifesto() {
  return (
    <section className="py-20 px-4 border-t border-[#1c2540]">
      <div className="max-w-4xl mx-auto space-y-16">

        {/* Section label */}
        <FadeIn>
          <div className="flex items-center gap-4">
            <span className="label">How it works</span>
            <span className="flex-1 h-px bg-[#1c2540]" />
          </div>
        </FadeIn>

        {/* 4 steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#1c2540]">
          {STEPS.map((s, i) => (
            <FadeIn key={s.num} delay={i * 80}>
              <div className="bg-[#080c14] p-8 h-full">
                <span
                  className="font-mono text-4xl font-light block mb-4 select-none"
                  style={{ color: s.accent + '25' }}
                >
                  {s.num}
                </span>
                <h3 className="font-mono text-sm font-medium mb-3" style={{ color: s.accent }}>
                  {s.title}
                </h3>
                <p className="text-sm text-ink-3 leading-relaxed">{s.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Why ARCANA */}
        <div>
          <FadeIn>
            <div className="flex items-center gap-4 mb-8">
              <span className="label text-arc">What makes it different</span>
              <span className="flex-1 h-px bg-[#1c2540]" />
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#1c2540]">
            {PILLARS.map((p, i) => (
              <FadeIn key={p.title} delay={i * 80}>
                <div className="bg-[#080c14] p-6 h-full">
                  <h4 className="font-mono text-xs text-ink font-medium mb-2">{p.title}</h4>
                  <p className="text-sm text-ink-3 leading-relaxed">{p.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        {/* CTA */}
        <FadeIn delay={100}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-[#1c2540] pt-8">
            <div>
              <p className="font-mono text-sm text-ink mb-1">Ready to deploy?</p>
              <p className="font-mono text-xs text-ink-3">ARCANA is live on Arc Testnet.</p>
            </div>
            <div className="flex gap-3">
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-ink-2 border border-[#1c2540] px-4 py-2 rounded-sm hover:border-ink-2 transition-colors"
              >
                ArcScan ↗
              </a>
              <Link
                href="/vault"
                className="font-mono text-xs text-white bg-arc px-6 py-2 rounded-sm hover:bg-[#5a4fd0] transition-colors"
              >
                Launch ARCANA →
              </Link>
            </div>
          </div>
        </FadeIn>

        {/* Footer — Arc + Hermes attribution */}
        <FadeIn delay={150}>
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-3 border border-[#3d9ac2]/20 px-5 py-2.5 rounded-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3d9ac2]/50" />
                <span className="font-mono text-xs text-[#3d9ac2]/70 tracking-wider">Built on Arc Testnet · Chain 5042002</span>
                <a
                  href="https://testnet.arcscan.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[#3d9ac2]/40 hover:text-[#3d9ac2] transition-colors"
                >
                  ArcScan ↗
                </a>
              </div>
            </div>
            <p className="font-mono text-2xs text-ink-3/40 text-center tracking-wide">
              Powered by Nous Research Hermes agent infrastructure
            </p>
          </div>
        </FadeIn>

      </div>
    </section>
  )
}
