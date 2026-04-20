# ARCANA Changelog

## [2.0.0] — 2026-04-21

### Complete UI Redesign

#### New
- Marketing landing page at `/` with hero, strategy showcase, how-it-works, vision, footer
- Chat terminal moved to `/app` with centered, large strategy card selector
- Exchange-style trade page at `/trade` using TradingView `lightweight-charts`
- Dark/Light theme toggle via `next-themes`
- EN/TR language toggle with full translations (`lib/i18n.ts`)
- New Nav: Globe (lang), Sun/Moon (theme), "Launch App" on landing
- CSS variable-based theming across all components

#### Fixed
- Input textarea overflow in ArcanaTerminal
- Strategy selection screen now shows large centered cards instead of small tab text

#### Packages Added
- `next-themes` — dark/light mode
- `lucide-react` — icon set
- `lightweight-charts` — TradingView candlestick charts
