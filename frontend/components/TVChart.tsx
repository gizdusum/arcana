'use client'

import { useEffect, useRef, useId } from 'react'
import { useTheme } from 'next-themes'

interface Props {
  symbol: string
  interval?: string
  height?: number | string
}

declare global {
  interface Window {
    TradingView: {
      widget: new (config: Record<string, unknown>) => void
    }
  }
}

export function TVChart({ symbol, interval = '15' }: Props) {
  const { resolvedTheme } = useTheme()
  const uid = useId().replace(/:/g, '')
  const containerId = `tv_${uid}`
  const scriptLoaded = useRef(false)
  const widgetCreated = useRef(false)

  const theme = resolvedTheme === 'light' ? 'light' : 'dark'
  const bg = theme === 'dark' ? '#060910' : '#f2f4fb'
  const gridColor = theme === 'dark' ? '#161e35' : '#e0e4f4'
  const textColor = theme === 'dark' ? '#4a5878' : '#5a6482'
  const upColor = '#1db87a'
  const downColor = '#c94e4e'

  useEffect(() => {
    widgetCreated.current = false

    const createWidget = () => {
      if (!window.TradingView || widgetCreated.current) return
      widgetCreated.current = true

      new window.TradingView.widget({
        autosize: true,
        symbol,
        interval,
        container_id: containerId,
        locale: 'en',
        timezone: 'Etc/UTC',
        theme,
        style: '1',
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
        overrides: {
          'paneProperties.background': bg,
          'paneProperties.backgroundType': 'solid',
          'paneProperties.vertGridProperties.color': gridColor,
          'paneProperties.horzGridProperties.color': gridColor,
          'scalesProperties.textColor': textColor,
          'mainSeriesProperties.candleStyle.upColor': upColor,
          'mainSeriesProperties.candleStyle.downColor': downColor,
          'mainSeriesProperties.candleStyle.borderUpColor': upColor,
          'mainSeriesProperties.candleStyle.borderDownColor': downColor,
          'mainSeriesProperties.candleStyle.wickUpColor': upColor,
          'mainSeriesProperties.candleStyle.wickDownColor': downColor,
        },
        loading_screen: { backgroundColor: bg, foregroundColor: '#6e5ff0' },
      })
    }

    if (window.TradingView) {
      createWidget()
      return
    }

    if (scriptLoaded.current) {
      const iv = setInterval(() => {
        if (window.TradingView) { clearInterval(iv); createWidget() }
      }, 100)
      return () => clearInterval(iv)
    }

    scriptLoaded.current = true
    const script = document.createElement('script')
    script.id = 'tv-script'
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = createWidget
    document.head.appendChild(script)

    return () => {
      widgetCreated.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, theme, containerId])

  return (
    <div className="w-full h-full" id={containerId} style={{ minHeight: '300px' }} />
  )
}
