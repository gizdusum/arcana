'use client'

import Link from 'next/link'
import { useReadContract } from 'wagmi'
import { VAULT_ADDRESS, VAULT_ABI } from '@/lib/contracts'
import { useLang } from '@/lib/lang-context'
import { useTheme } from 'next-themes'

// ─── Live TVL from contract ───────────────────────────

function useTVL() {
  const { data } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  })
  return data ? `$${(Number(data) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$—'
}

function useTotalTrades() {
  const { data } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalTradesExecuted',
  })
  return data !== undefined ? data.toString() : '—'
}

// ─── Hero Section ─────────────────────────────────────

function Hero() {
  const { t } = useLang()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const tvl = useTVL()

  return (
    <section
      id="about"
      className="relative min-h-[92vh] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Grid overlay */}
      <div className="arc-grid-overlay" />

      {/* Ambient glow orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '20%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '300px',
          background: isDark
            ? 'radial-gradient(ellipse, rgba(110,95,240,0.12) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(91,78,224,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '15%', right: '20%',
          width: '400px', height: '200px',
          background: isDark
            ? 'radial-gradient(ellipse, rgba(61,154,194,0.08) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(45,125,168,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-10 font-mono text-xs tracking-widest"
          style={{
            border: '1px solid var(--border-2)',
            color: 'var(--ink-2)',
            background: 'var(--surface)',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full hermes-alive"
            style={{ background: 'var(--gain)' }}
          />
          {t.hero.badge}
        </div>

        {/* Main title */}
        <h1
          className="font-mono font-light tracking-[0.06em] mb-6"
          style={{
            fontSize: 'clamp(2.2rem, 5vw, 4rem)',
            lineHeight: 1.15,
            color: 'var(--ink)',
          }}
        >
          {t.hero.title.split(' ').map((word, i, arr) =>
            i === arr.length - 1 ? (
              <span key={i} className="text-shimmer"> {word}</span>
            ) : (
              <span key={i}>{word} </span>
            )
          )}
        </h1>

        {/* Subtitle */}
        <p
          className="font-mono text-base leading-relaxed mb-12 max-w-2xl"
          style={{ color: 'var(--ink-2)' }}
        >
          {t.hero.subtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-sm font-mono text-sm tracking-widest uppercase transition-all"
            style={{
              background: 'var(--arc)',
              color: '#fff',
              boxShadow: isDark ? '0 4px 24px rgba(110,95,240,0.35)' : '0 4px 16px rgba(91,78,224,0.25)',
            }}
          >
            {t.hero.cta}
            <span style={{ opacity: 0.7 }}>→</span>
          </Link>
          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-sm font-mono text-sm tracking-widest uppercase transition-all border"
            style={{
              border: '1px solid var(--border-2)',
              color: 'var(--ink-2)',
              background: 'var(--surface)',
            }}
          >
            {t.hero.ctaSub} ↗
          </a>
        </div>

        {/* Stats bar */}
        <div
          className="flex flex-wrap justify-center gap-px rounded-sm overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {[
            { label: t.stats.strategies,  value: '3' },
            { label: 'TVL',               value: tvl },
            { label: t.stats.network,     value: 'Arc Testnet' },
            { label: t.stats.poweredBy,   value: 'Hermes 3' },
            { label: t.stats.vault,       value: 'ERC-4626' },
          ].map((s, i) => (
            <div
              key={i}
              className="px-6 py-3 text-center"
              style={{ background: 'var(--surface)', minWidth: '120px' }}
            >
              <div className="font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.value}</div>
              <div className="font-mono text-2xs uppercase tracking-widest mt-0.5" style={{ color: 'var(--ink-3)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
        <span className="font-mono text-2xs tracking-widest" style={{ color: 'var(--ink-3)' }}>scroll</span>
        <div className="h-6 w-px" style={{ background: 'linear-gradient(to bottom, var(--ink-3), transparent)' }} />
      </div>
    </section>
  )
}

// ─── Strategies Section ───────────────────────────────

function StrategiesSection() {
  const { t } = useLang()
  const totalTrades = useTotalTrades()

  const strategies = [
    {
      name: 'APOLLO',
      label: t.features.apollo.label,
      desc: t.features.apollo.desc,
      accent: '#6e5ff0',
      risk: '3x · Long',
      riskLevel: 1,
      maxLev: '3×',
      direction: 'Long only',
      stopLoss: '5%',
      takeProfit: '10%',
    },
    {
      name: 'ATLAS',
      label: t.features.atlas.label,
      desc: t.features.atlas.desc,
      accent: '#3d9ac2',
      risk: '5x · L+S',
      riskLevel: 3,
      maxLev: '5×',
      direction: 'Long + Short',
      stopLoss: '10%',
      takeProfit: '20%',
    },
    {
      name: 'ARES',
      label: t.features.ares.label,
      desc: t.features.ares.desc,
      accent: '#c94e4e',
      risk: '10x · L+S',
      riskLevel: 5,
      maxLev: '10×',
      direction: 'Long + Short',
      stopLoss: '20%',
      takeProfit: '50%',
    },
  ]

  return (
    <section
      id="strategies"
      className="py-28 px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--ink-3)' }}>
            Strategies
          </div>
          <h2
            className="font-mono font-light tracking-tight mb-4"
            style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: 'var(--ink)' }}
          >
            {t.features.title}
          </h2>
          <p className="font-mono text-sm max-w-xl mx-auto" style={{ color: 'var(--ink-2)' }}>
            {t.features.subtitle}
          </p>
        </div>

        {/* Strategy cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {strategies.map((s) => (
            <div
              key={s.name}
              className="strategy-card rounded-sm overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${s.accent}25`,
                boxShadow: `0 0 0 0 ${s.accent}00`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${s.accent}15, 0 0 0 1px ${s.accent}30`
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-6px)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${s.accent}00`
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              }}
            >
              {/* Top accent bar */}
              <div className="h-0.5 w-full" style={{ background: s.accent }} />

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <span className="font-mono text-2xs uppercase tracking-widest mb-1 block" style={{ color: s.accent, opacity: 0.7 }}>
                      {s.label}
                    </span>
                    <span className="font-mono text-2xl font-light tracking-[0.15em]" style={{ color: 'var(--ink)' }}>
                      {s.name}
                    </span>
                  </div>
                  {/* Risk dots */}
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-1.5 w-4 rounded-full"
                        style={{ background: i < s.riskLevel ? s.accent : 'var(--border-2)' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px mb-5" style={{ background: `${s.accent}20` }} />

                {/* Stats */}
                <div className="space-y-2.5 mb-6">
                  {[
                    { label: 'Max Leverage', value: s.maxLev },
                    { label: 'Direction', value: s.direction },
                    { label: 'Stop-Loss', value: s.stopLoss },
                    { label: 'Take-Profit', value: s.takeProfit },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between">
                      <span className="font-mono text-2xs uppercase tracking-widest" style={{ color: 'var(--ink-3)' }}>
                        {stat.label}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--ink)' }}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Description */}
                <p className="font-mono text-xs leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
                  {s.desc}
                </p>

                {/* CTA */}
                <Link
                  href="/app"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-sm font-mono text-xs tracking-widest uppercase transition-all"
                  style={{
                    color: s.accent,
                    border: `1px solid ${s.accent}35`,
                    background: `${s.accent}08`,
                  }}
                >
                  Select {s.name}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────

function HowItWorksSection() {
  const { t } = useLang()

  const steps = [
    { n: '01', ...t.howItWorks.step1, accent: '#6e5ff0' },
    { n: '02', ...t.howItWorks.step2, accent: '#3d9ac2' },
    { n: '03', ...t.howItWorks.step3, accent: '#1db87a' },
    { n: '04', ...t.howItWorks.step4, accent: '#b8913a' },
  ]

  return (
    <section
      id="how-it-works"
      className="py-28 px-6"
      style={{ background: 'var(--surface)' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="font-mono text-xs tracking-widest uppercase mb-4" style={{ color: 'var(--ink-3)' }}>
            Process
          </div>
          <h2
            className="font-mono font-light tracking-tight mb-4"
            style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', color: 'var(--ink)' }}
          >
            {t.howItWorks.title}
          </h2>
          <p className="font-mono text-sm" style={{ color: 'var(--ink-2)' }}>
            {t.howItWorks.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => (
            <div
              key={step.n}
              className="relative p-6 rounded-sm"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
              }}
            >
              {/* Step number */}
              <div
                className="font-mono text-4xl font-light mb-5 leading-none"
                style={{ color: step.accent, opacity: 0.5 }}
              >
                {step.n}
              </div>
              <h3 className="font-mono text-sm font-medium mb-2" style={{ color: 'var(--ink)' }}>
                {step.title}
              </h3>
              <p className="font-mono text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                {step.desc}
              </p>
              {/* Bottom accent */}
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-sm"
                style={{ background: `linear-gradient(to right, ${step.accent}40, transparent)` }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Vision Section ───────────────────────────────────

function VisionSection() {
  const { t } = useLang()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <section
      className="relative py-28 px-6 overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Ambient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(110,95,240,0.06) 0%, transparent 70%)'
            : 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(91,78,224,0.04) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <div className="font-mono text-xs tracking-widest uppercase mb-6" style={{ color: 'var(--ink-3)' }}>
          Vision
        </div>
        <h2
          className="font-mono font-light tracking-tight mb-8"
          style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: 'var(--ink)' }}
        >
          {t.vision.title}
        </h2>
        <blockquote
          className="font-mono text-sm leading-loose mb-10"
          style={{ color: 'var(--ink-2)' }}
        >
          {t.vision.body}
        </blockquote>

        {/* Tech badges */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'Hermes 3 · 70B', color: '#b8913a' },
            { label: 'Arc Testnet', color: '#3d9ac2' },
            { label: 'ERC-4626 Vault', color: '#6e5ff0' },
            { label: 'Perpetual Futures', color: '#1db87a' },
          ].map((b) => (
            <span
              key={b.label}
              className="font-mono text-xs px-3 py-1 rounded-full"
              style={{
                color: b.color,
                border: `1px solid ${b.color}30`,
                background: `${b.color}08`,
              }}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Section ─────────────────────────────────────

function CTASection() {
  const { t } = useLang()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <section
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: 'var(--surface)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(110,95,240,0.08) 0%, transparent 70%)'
            : 'none',
        }}
      />
      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <h2
          className="font-mono font-light tracking-tight mb-4"
          style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', color: 'var(--ink)' }}
        >
          Ready to let ARCANA trade for you?
        </h2>
        <p className="font-mono text-sm mb-10" style={{ color: 'var(--ink-2)' }}>
          Arc Testnet · No real funds at risk · Start in seconds
        </p>
        <Link
          href="/app"
          className="inline-flex items-center gap-3 px-10 py-4 rounded-sm font-mono text-sm tracking-widest uppercase transition-all"
          style={{
            background: 'var(--arc)',
            color: '#fff',
            boxShadow: isDark ? '0 4px 28px rgba(110,95,240,0.4)' : '0 4px 16px rgba(91,78,224,0.3)',
          }}
        >
          {t.hero.cta}
          <span className="arc-alive inline-block h-1.5 w-1.5 rounded-full bg-white/60" />
        </Link>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────

function Footer() {
  const { t } = useLang()
  const { lang, setLang } = useLang()

  return (
    <footer
      className="border-t px-6 py-12"
      style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 w-px" style={{ background: 'linear-gradient(to bottom, transparent, var(--arc), transparent)' }} />
              <span className="font-mono text-sm font-semibold tracking-[0.25em]" style={{ color: 'var(--ink)' }}>
                ARCANA
              </span>
            </div>
            <p className="font-mono text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {t.footer.tagline}
            </p>
            <div className="flex items-center gap-1.5 mt-3">
              <span className="h-1.5 w-1.5 rounded-full hermes-alive" style={{ background: 'var(--gain)' }} />
              <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>{t.footer.network}</span>
            </div>
          </div>

          {/* Links */}
          <div>
            <span className="font-mono text-2xs uppercase tracking-widest block mb-4" style={{ color: 'var(--ink-3)' }}>
              App
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/app',         label: t.footer.links.app },
                { href: '/vault',       label: t.footer.links.vault },
                { href: '/trade',       label: t.footer.links.trade },
                { href: '/agent',       label: t.footer.links.strategy },
                { href: '/leaderboard', label: t.footer.links.leaderboard },
                { href: '/log',         label: t.footer.links.log },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-mono text-xs transition-colors"
                  style={{ color: 'var(--ink-2)' }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--ink)' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--ink-2)' }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <span className="font-mono text-2xs uppercase tracking-widest block mb-4" style={{ color: 'var(--ink-3)' }}>
              Resources
            </span>
            <div className="space-y-2">
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="block font-mono text-xs transition-colors"
                style={{ color: 'var(--ink-2)' }}
              >
                {t.footer.faucet} ↗
              </a>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="block font-mono text-xs transition-colors"
                style={{ color: 'var(--ink-2)' }}
              >
                ArcScan Explorer ↗
              </a>
              <a
                href="https://rpc.testnet.arc.network"
                target="_blank"
                rel="noopener noreferrer"
                className="block font-mono text-xs transition-colors"
                style={{ color: 'var(--ink-2)' }}
              >
                RPC Endpoint ↗
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>
            {t.footer.rights}
          </span>

          {/* Builder credits */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-2xs" style={{ color: 'var(--ink-3)' }}>Built by</span>
            <a
              href="https://x.com/gizdusumandnode"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-2xs transition-colors"
              style={{ color: 'var(--ink-2)' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--ink)' }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--ink-2)' }}
            >
              {/* X / Twitter icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              @gizdusumandnode
            </a>
            <a
              href="https://github.com/gizdusum"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-mono text-2xs transition-colors"
              style={{ color: 'var(--ink-2)' }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--ink)' }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--ink-2)' }}
            >
              {/* GitHub icon */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              gizdusum
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
              className="font-mono text-2xs uppercase px-2 py-1 rounded-sm border transition-all"
              style={{ color: 'var(--ink-2)', borderColor: 'var(--border)' }}
            >
              {lang === 'en' ? 'TR' : 'EN'}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Hero />
      <StrategiesSection />
      <HowItWorksSection />
      <VisionSection />
      <CTASection />
      <Footer />
    </>
  )
}
