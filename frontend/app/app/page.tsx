export const dynamic = 'force-dynamic'
import nextDynamic from 'next/dynamic'

const ArcanaTerminal = nextDynamic(
  () => import('@/components/ArcanaTerminal').then((m) => m.ArcanaTerminal),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <span className="font-mono text-xs tracking-widest animate-pulse" style={{ color: 'var(--ink-3)' }}>
          INITIALIZING ARCANA...
        </span>
      </div>
    ),
  }
)

export default function AppPage() {
  return <ArcanaTerminal />
}
