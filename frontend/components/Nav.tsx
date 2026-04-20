'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Sun, Moon, Globe } from 'lucide-react'
import { useLang } from '@/lib/lang-context'

const APP_LINKS = [
  { href: '/vault',       label: 'Vault' },
  { href: '/trade',       label: 'Trade' },
  { href: '/app',         label: 'Agent' },
  { href: '/agent',       label: 'Strategy' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/log',         label: 'Log' },
]

const LANDING_LINKS = [
  { href: '/#about',        label: 'About' },
  { href: '/#strategies',   label: 'Strategies' },
  { href: '/#how-it-works', label: 'How It Works' },
]

export function Nav() {
  const path = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { lang, setLang } = useLang()

  const isLanding = path === '/'
  const links = isLanding ? LANDING_LINKS : APP_LINKS

  const isDark = resolvedTheme === 'dark'

  return (
    <header
      className="nav-border sticky top-0 z-50 backdrop-blur-md"
      style={{ background: 'var(--nav-bg)' }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div
            className="h-5 w-px"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--arc), transparent)' }}
          />
          <span
            className="font-mono text-sm font-semibold tracking-[0.28em]"
            style={{ color: 'var(--ink)', textShadow: isDark ? '0 0 20px rgba(110,95,240,0.4)' : 'none' }}
          >
            ARCANA
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-5 ml-2">
          {links.map((link) => {
            const active = !isLanding && path.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-mono text-xs tracking-wide transition-all ${
                  active
                    ? 'text-[var(--arc)]'
                    : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
                }`}
                style={active ? { textShadow: isDark ? '0 0 10px rgba(110,95,240,0.5)' : 'none' } : {}}
              >
                {active && (
                  <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-[var(--arc)] align-middle arc-alive" />
                )}
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm font-mono text-xs transition-all border"
            style={{
              color: 'var(--ink-2)',
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
            }}
            title="Toggle language"
          >
            <Globe size={12} />
            <span className="uppercase tracking-wider">{lang}</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex items-center justify-center h-8 w-8 rounded-sm border transition-all"
            style={{
              color: 'var(--ink-2)',
              borderColor: 'var(--border)',
              background: 'var(--surface-2)',
            }}
            title={isDark ? 'Switch to light' : 'Switch to dark'}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Launch App button (only on landing) */}
          {isLanding && (
            <Link
              href="/app"
              className="font-mono text-xs px-4 py-1.5 rounded-sm tracking-widest uppercase transition-all"
              style={{
                background: 'var(--arc)',
                color: '#fff',
              }}
            >
              Launch App
            </Link>
          )}

          {/* Wallet connect (only in app) */}
          {!isLanding && (
            <ConnectButton
              label="Connect"
              accountStatus="address"
              chainStatus="none"
              showBalance={false}
            />
          )}
        </div>
      </div>
    </header>
  )
}
