import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import './globals.css'

const Providers = dynamic(
  () => import('./providers').then((m) => m.Providers),
  { ssr: false }
)

const Nav = dynamic(
  () => import('@/components/Nav').then((m) => m.Nav),
  {
    ssr: false,
    loading: () => (
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 sticky top-0 z-50 h-14 flex items-center px-4">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-6 w-full">
          <span className="font-mono text-sm font-medium tracking-[0.25em]" style={{ color: 'var(--ink)' }}>ARCANA</span>
          <div className="flex-1" />
          <div className="h-8 w-32 rounded-sm border border-[var(--border)] bg-[var(--surface-2)]/50" />
        </div>
      </header>
    ),
  }
)

export const metadata: Metadata = {
  title: 'ARCANA — The Hidden Intelligence of Arc',
  description: 'Autonomous AI trading agent for perpetual futures on Arc Testnet. Powered by Hermes 3.',
  openGraph: {
    title: 'ARCANA',
    description: 'Autonomous AI trading agent for perpetual futures on Arc Testnet.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <Nav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
