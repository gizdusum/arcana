'use client'

import { ReactNode } from 'react'
import { RainbowKitProvider, ConnectButton, darkTheme } from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from '@/lib/wagmi'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

const NAV_LINKS = [
  { href: '/vault', label: 'Vault' },
  { href: '/agent', label: 'Agent' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/log', label: 'Log' },
]

function ActiveNav() {
  const path = usePathname()
  return (
    <>
      {NAV_LINKS.map((link) => {
        const active = path.startsWith(link.href)
        if (!active) return null
        // Overlay the active link with the arc dot indicator
        return (
          <Link
            key={link.href}
            href={link.href}
            className="font-mono text-xs tracking-wide text-arc transition-colors"
            style={{ display: 'none' }} // handled via nav replacement below
          >
            {link.label}
          </Link>
        )
      })}
    </>
  )
}

function NavOverlay() {
  const path = usePathname()
  return (
    <header
      className="border-b border-[#1c2540] bg-[#080c14]/95 sticky top-[29px] z-40 backdrop-blur-sm"
      style={{ marginTop: '-49px' }} // overlap the NavShell (h-12 = 48px + 1px border)
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-8 px-4">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs text-[#2e3860]">&#8859;</span>
          <span className="font-mono text-sm font-medium tracking-[0.2em] text-ink">ARCANA</span>
        </Link>

        {/* Nav links with active state */}
        <nav className="flex items-center gap-6">
          {NAV_LINKS.map((link) => {
            const active = path.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-mono text-xs tracking-wide transition-colors ${
                  active ? 'text-arc' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {active && (
                  <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-arc align-middle" />
                )}
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ConnectButton */}
        <ConnectButton
          label="Connect Wallet"
          accountStatus="address"
          chainStatus="none"
          showBalance={false}
        />
      </div>
    </header>
  )
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#7c6af7',
            accentColorForeground: '#f0f0ff',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
        >
          {/* Replace the static NavShell with the active-aware full nav */}
          <NavOverlay />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
