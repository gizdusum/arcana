// Mythological SVG symbols for each ARCANA strategy
// Apollo: the Lyre — god of music, light, reason
// Atlas: the Celestial Sphere — titan who holds the heavens
// Ares: the Spear & Shield — god of war

type StrategyId = 'APOLLO' | 'ATLAS' | 'ARES'

interface Props {
  strategy: StrategyId
  size?: number
  className?: string
}

function ApolloIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sun rays */}
      <line x1="32" y1="4"  x2="32" y2="12" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <line x1="32" y1="52" x2="32" y2="60" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <line x1="4"  y1="32" x2="12" y2="32" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <line x1="52" y1="32" x2="60" y2="32" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <line x1="10.7" y1="10.7" x2="16.4" y2="16.4" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <line x1="47.6" y1="47.6" x2="53.3" y2="53.3" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <line x1="53.3" y1="10.7" x2="47.6" y2="16.4" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <line x1="16.4" y1="47.6" x2="10.7" y2="53.3" stroke="#6e5ff0" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      {/* Sun circle */}
      <circle cx="32" cy="32" r="11" stroke="#6e5ff0" strokeWidth="1.5" fill="none"/>
      <circle cx="32" cy="32" r="5"  fill="#6e5ff0" opacity="0.2"/>
      <circle cx="32" cy="32" r="2"  fill="#6e5ff0" opacity="0.7"/>
      {/* Lyre frame — two curved arms */}
      <path d="M24 38 C20 34 20 30 24 26" stroke="#6e5ff0" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round"/>
      <path d="M40 38 C44 34 44 30 40 26" stroke="#6e5ff0" strokeWidth="1" fill="none" opacity="0.5" strokeLinecap="round"/>
    </svg>
  )
}

function AtlasIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Globe outline */}
      <circle cx="32" cy="28" r="16" stroke="#3d9ac2" strokeWidth="1.5" fill="none"/>
      {/* Meridians */}
      <ellipse cx="32" cy="28" rx="8" ry="16" stroke="#3d9ac2" strokeWidth="1" fill="none" opacity="0.4"/>
      <ellipse cx="32" cy="28" rx="14" ry="16" stroke="#3d9ac2" strokeWidth="0.75" fill="none" opacity="0.25"/>
      {/* Parallels */}
      <line x1="16" y1="28" x2="48" y2="28" stroke="#3d9ac2" strokeWidth="1" opacity="0.4"/>
      <path d="M18 20 Q32 22 46 20" stroke="#3d9ac2" strokeWidth="0.75" fill="none" opacity="0.3"/>
      <path d="M18 36 Q32 34 46 36" stroke="#3d9ac2" strokeWidth="0.75" fill="none" opacity="0.3"/>
      {/* Atlas figure — simplified shoulders & arms holding sphere */}
      <line x1="32" y1="44" x2="32" y2="56" stroke="#3d9ac2" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <line x1="22" y1="48" x2="42" y2="48" stroke="#3d9ac2" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <line x1="22" y1="48" x2="20" y2="44" stroke="#3d9ac2" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <line x1="42" y1="48" x2="44" y2="44" stroke="#3d9ac2" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

function AresIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield — slightly offset left */}
      <path
        d="M18 16 C18 16 12 22 12 32 C12 42 18 50 26 54 C26 54 30 48 30 32 C30 22 26 14 18 16 Z"
        stroke="#c94e4e" strokeWidth="1.5" fill="none" opacity="0.7"
      />
      {/* Shield boss (center knob) */}
      <circle cx="21" cy="32" r="3" stroke="#c94e4e" strokeWidth="1" fill="none" opacity="0.5"/>
      {/* Spear shaft — diagonal, upper right */}
      <line x1="34" y1="8" x2="56" y2="52" stroke="#c94e4e" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
      {/* Spear tip */}
      <path d="M34 8 L30 14 L38 12 Z" fill="#c94e4e" opacity="0.7"/>
      {/* Spear butt */}
      <line x1="56" y1="52" x2="58" y2="56" stroke="#c94e4e" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
      {/* Decorative shield stripe */}
      <path d="M16 28 Q21 24 26 28" stroke="#c94e4e" strokeWidth="0.75" fill="none" opacity="0.4"/>
    </svg>
  )
}

export function StrategyIcon({ strategy, size = 64, className = '' }: Props) {
  return (
    <div className={`flex items-center justify-center opacity-60 group-hover:opacity-90 transition-opacity ${className}`}>
      {strategy === 'APOLLO' && <ApolloIcon size={size} />}
      {strategy === 'ATLAS'  && <AtlasIcon  size={size} />}
      {strategy === 'ARES'   && <AresIcon   size={size} />}
    </div>
  )
}
