'use client'

import { useEffect, useRef, useId } from 'react'
import { useTheme } from 'next-themes'

interface Props {
  symbol: string
  interval?: string
}

declare global {
  interface Window {
    TradingView: { widget: new (config: Record<string, unknown>) => void }
  }
}

export function TVChart({ symbol, interval = '60' }: Props) {
  const { resolvedTheme } = useTheme()
  const uid = useId().replace(/:/g, '')
  const containerId = `tv_${uid}`
  const containerRef = useRef<HTMLDivElement>(null)

  const theme = resolvedTheme === 'light' ? 'light' : 'dark'
  const bg        = theme === 'dark' ? '#060910' : '#f2f4fb'
  const bg2       = theme === 'dark' ? '#0b0f1c' : '#ffffff'
  const gridColor = theme === 'dark' ? '#161e35' : '#e0e4f4'
  const textColor = theme === 'dark' ? '#4a5878' : '#5a6482'

  useEffect(() => {
    let destroyed = false

    const createWidget = () => {
      if (destroyed || !containerRef.current) return
      // Clear any previous widget content
      containerRef.current.innerHTML = ''

      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        container_id: containerId,
        locale: 'en',
        timezone: 'Etc/UTC',
        theme,
        style: '1',
        toolbar_bg: bg2,
        hide_top_toolbar: false,
        hide_legend: false,
        allow_symbol_change: false,
        save_image: false,
        enable_publishing: false,
        withdateranges: true,
        hide_side_toolbar: false,
        details: false,
        hotlist: false,
        calendar: false,
        studies: ['Volume@tv-basicstudies'],
        overrides: {
          'paneProperties.background':                          bg,
          'paneProperties.backgroundType':                     'solid',
          'paneProperties.vertGridProperties.color':           gridColor,
          'paneProperties.horzGridProperties.color':           gridColor,
          'scalesProperties.textColor':                        textColor,
          'scalesProperties.backgroundColor':                  bg,
          'mainSeriesProperties.candleStyle.upColor':          '#1db87a',
          'mainSeriesProperties.candleStyle.downColor':        '#c94e4e',
          'mainSeriesProperties.candleStyle.borderUpColor':    '#1db87a',
          'mainSeriesProperties.candleStyle.borderDownColor':  '#c94e4e',
          'mainSeriesProperties.candleStyle.wickUpColor':      '#1db87a',
          'mainSeriesProperties.candleStyle.wickDownColor':    '#c94e4e',
        },
        studies_overrides: {
          'volume.volume.color.0': 'rgba(201,78,78,0.35)',
          'volume.volume.color.1': 'rgba(29,184,122,0.35)',
        },
        loading_screen: { backgroundColor: bg, foregroundColor: '#6e5ff0' },
      })
    }

    // TradingView script is already loaded
    if (window.TradingView) {
      createWidget()
      return () => { destroyed = true }
    }

    // Script already injected but not yet ready
    const existing = document.getElementById('tv-script')
    if (existing) {
      const iv = setInterval(() => {
        if (window.TradingView) { clearInterval(iv); createWidget() }
      }, 100)
      return () => { destroyed = true; clearInterval(iv) }
    }

    // Inject script fresh
    const script = document.createElement('script')
    script.id = 'tv-script'
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = createWidget
    document.head.appendChild(script)

    return () => {
      destroyed = true
      // Clear container to avoid ghost widgets on remount
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, theme, containerId])

  return (
    <div
      ref={containerRef}
      id={containerId}
      className="w-full h-full"
      style={{ minHeight: '300px', background: bg }}
    />
  )
}
