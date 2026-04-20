'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface OHLCBar {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface Props {
  asset: 'BTC' | 'ETH'
  entryPrice?: number
  liqPrice?: number
  isLong?: boolean
  accent?: string
}

export function TradingChart({ asset, entryPrice, liqPrice, isLong, accent = '#6e5ff0' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<unknown>(null)
  const seriesRef = useRef<unknown>(null)
  const [chartReady, setChartReady] = useState(false)
  const [error, setError] = useState(false)

  const loadData = useCallback(async (coinId: string) => {
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=1`
      )
      const raw: [number, number, number, number, number][] = await r.json()
      return raw.map(([t, o, h, l, c]) => ({
        time: Math.floor(t / 1000) as unknown as number,
        open: o,
        high: h,
        low: l,
        close: c,
      }))
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let chart: unknown
    let mounted = true

    const init = async () => {
      try {
        const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts')
        if (!mounted || !containerRef.current) return

        const isDark = document.documentElement.classList.contains('dark') ||
          !document.documentElement.classList.contains('light')

        const bg = isDark ? '#060910' : '#f2f4fb'
        const grid = isDark ? '#161e35' : '#d4d9ef'
        const text = isDark ? '#4a5878' : '#5a6482'
        const border = isDark ? '#161e35' : '#d4d9ef'

        chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: bg },
            textColor: text,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: grid, style: 1 },
            horzLines: { color: grid, style: 1 },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: 'rgba(110,95,240,0.4)', labelBackgroundColor: '#6e5ff0' },
            horzLine: { color: 'rgba(110,95,240,0.4)', labelBackgroundColor: '#6e5ff0' },
          },
          rightPriceScale: {
            borderColor: border,
            textColor: text,
          },
          timeScale: {
            borderColor: border,
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: true,
          handleScale: true,
        })

        chartRef.current = chart

        const candleSeries = (chart as { addCandlestickSeries: Function }).addCandlestickSeries({
          upColor: '#1db87a',
          downColor: '#c94e4e',
          borderVisible: false,
          wickUpColor: '#1db87a',
          wickDownColor: '#c94e4e',
        })

        seriesRef.current = candleSeries

        const coinId = asset === 'BTC' ? 'bitcoin' : 'ethereum'
        const data = await loadData(coinId)

        if (data && mounted && seriesRef.current) {
          (seriesRef.current as { setData: Function }).setData(data)

          // Entry price line
          if (entryPrice) {
            (candleSeries as { createPriceLine: Function }).createPriceLine({
              price: entryPrice,
              color: accent,
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: 'Entry',
            })
          }

          // Liquidation price line
          if (liqPrice) {
            (candleSeries as { createPriceLine: Function }).createPriceLine({
              price: liqPrice,
              color: '#c94e4e',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: true,
              title: 'Liq.',
            })
          }

          ;(chart as { timeScale: Function }).timeScale().fitContent()
        }

        setChartReady(true)

        // Resize observer
        const ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            (chart as { resize: Function }).resize(
              containerRef.current.clientWidth,
              containerRef.current.clientHeight
            )
          }
        })
        if (containerRef.current) ro.observe(containerRef.current)

        return () => ro.disconnect()
      } catch {
        if (mounted) setError(true)
      }
    }

    init()

    return () => {
      mounted = false
      if (chart) {
        try { (chart as { remove: Function }).remove() } catch {}
      }
    }
  }, [asset, entryPrice, liqPrice, accent, loadData])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="font-mono text-xs" style={{ color: 'var(--ink-3)' }}>Chart unavailable</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {!chartReady && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="font-mono text-xs animate-pulse" style={{ color: 'var(--ink-3)' }}>
            Loading chart...
          </span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
