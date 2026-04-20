import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg:           'var(--bg)',
        surface:      'var(--surface)',
        'surface-2':  'var(--surface-2)',
        'surface-3':  'var(--surface-3)',
        border:       'var(--border)',
        'border-2':   'var(--border-2)',
        arc:          'var(--arc)',
        gain:         'var(--gain)',
        loss:         'var(--loss)',
        hermes:       'var(--hermes)',
        data:         'var(--data)',
        ink:          'var(--ink)',
        'ink-2':      'var(--ink-2)',
        'ink-3':      'var(--ink-3)',
      },
      fontFamily: {
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      maxWidth: {
        '7xl': '80rem',
      },
    },
  },
  plugins: [],
}

export default config
