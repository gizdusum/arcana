// Server-rendered nav shell: wordmark + links only.
// The ConnectButton is injected by ClientLayout after hydration.
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/vault', label: 'Vault' },
  { href: '/agent', label: 'Agent' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/log', label: 'Log' },
]

export function NavShell() {
  return (
    <header
      id="nav-shell"
      className="border-b border-[#1c2540] bg-[#080c14]/95 sticky top-[29px] z-30 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-8 px-4">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs text-[#2e3860]">&#8859;</span>
          <span className="font-mono text-sm font-medium tracking-[0.2em] text-ink">ARCANA</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-mono text-xs tracking-wide text-ink-2 hover:text-ink transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Placeholder slot — replaced by ConnectButton once ClientLayout loads */}
        <div id="wallet-slot" className="h-8 w-32 rounded-sm border border-[#1c2540] bg-surface/50" />
      </div>
    </header>
  )
}
