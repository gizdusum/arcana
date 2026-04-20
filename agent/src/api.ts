import express, { Request, Response, NextFunction } from 'express'
import { DecisionLogger } from './logger'
import { ActionType } from './types'

const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10)

export function startApiServer(logger: DecisionLogger): void {
  const app = express()
  app.use(express.json())

  // ─── Middleware: request logger ──────────────────────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[API] ${req.method} ${req.path}`)
    next()
  })

  // ─── GET /api/health ─────────────────────────────────────────────────────
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'HERMES',
      timestamp: Date.now(),
    })
  })

  // ─── GET /api/decisions ──────────────────────────────────────────────────
  // Query params: limit (default 50), action (optional filter)
  app.get('/api/decisions', (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10), 500)
      const action = req.query['action'] as ActionType | undefined

      let decisions
      if (action) {
        decisions = logger.getByAction(action)
        if (limit) decisions = decisions.slice(0, limit)
      } else {
        decisions = logger.getRecent(limit)
      }

      res.json({ count: decisions.length, decisions })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ error: msg })
    }
  })

  // ─── GET /api/decisions/stats ────────────────────────────────────────────
  app.get('/api/decisions/stats', (_req: Request, res: Response) => {
    try {
      const stats = logger.getStats()
      res.json(stats)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ error: msg })
    }
  })

  // ─── GET /api/decisions/export.csv ──────────────────────────────────────
  app.get('/api/decisions/export.csv', (_req: Request, res: Response) => {
    try {
      const csv = logger.exportCSV()
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="hermes-decisions.csv"')
      res.send(csv)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json({ error: msg })
    }
  })

  // ─── 404 catch-all ───────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.listen(PORT, () => {
    console.log(`[API] HERMES API server running on http://localhost:${PORT}`)
  })
}
