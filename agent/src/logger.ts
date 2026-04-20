// Uses Node.js 22.5+ built-in node:sqlite (stable in Node 25)
// No native compilation required
import { DatabaseSync } from 'node:sqlite'
import * as fs from 'fs'
import * as path from 'path'
import { HermesDecision, ActionType } from './types'

export class DecisionLogger {
  private db: DatabaseSync

  constructor(dbPath: string = './data/decisions.db') {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.db = new DatabaseSync(dbPath)
    this._initSchema()
  }

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        strategy TEXT NOT NULL,
        action TEXT NOT NULL,
        market TEXT NOT NULL,
        confidence REAL NOT NULL,
        reasoning TEXT NOT NULL,
        price_at_decision REAL NOT NULL,
        position_id INTEGER,
        tx_hash TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON decisions(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action);
      CREATE INDEX IF NOT EXISTS idx_decisions_strategy ON decisions(strategy);
    `)
  }

  async record(decision: HermesDecision): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO decisions
        (id, timestamp, strategy, action, market, confidence, reasoning, price_at_decision, position_id, tx_hash)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      decision.id,
      decision.timestamp,
      decision.strategy,
      decision.action,
      decision.market,
      decision.confidence,
      decision.reasoning,
      decision.priceAtDecision,
      decision.positionId ?? null,
      decision.txHash ?? null
    )
  }

  getRecent(limit: number): HermesDecision[] {
    const stmt = this.db.prepare(
      `SELECT * FROM decisions ORDER BY timestamp DESC LIMIT ?`
    )
    const rows = stmt.all(limit) as unknown as RawRow[]
    return rows.map(this._rowToDecision)
  }

  getByAction(action: ActionType): HermesDecision[] {
    const stmt = this.db.prepare(
      `SELECT * FROM decisions WHERE action = ? ORDER BY timestamp DESC`
    )
    const rows = stmt.all(action) as unknown as RawRow[]
    return rows.map(this._rowToDecision)
  }

  getStats(): { totalTrades: number; winRate: number; avgHoldTimeMs: number } {
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM decisions WHERE action != 'HOLD'`)
      .get() as unknown as { cnt: number }
    const totalTrades = totalRow.cnt

    const winRow = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM decisions WHERE action IN ('OPEN_LONG','OPEN_SHORT') AND confidence > 0.75`
      )
      .get() as unknown as { cnt: number }
    const winCount = winRow.cnt

    const winRate = totalTrades > 0 ? winCount / totalTrades : 0

    const opens = this.db
      .prepare(
        `SELECT timestamp FROM decisions WHERE action IN ('OPEN_LONG','OPEN_SHORT') ORDER BY timestamp ASC`
      )
      .all() as unknown as { timestamp: number }[]

    const closes = this.db
      .prepare(
        `SELECT timestamp FROM decisions WHERE action IN ('CLOSE','CLOSE_ALL') ORDER BY timestamp ASC`
      )
      .all() as unknown as { timestamp: number }[]

    let avgHoldTimeMs = 0
    if (opens.length > 0 && closes.length > 0) {
      const paired = Math.min(opens.length, closes.length)
      let totalHold = 0
      for (let i = 0; i < paired; i++) {
        const holdMs = closes[i].timestamp - opens[i].timestamp
        if (holdMs > 0) totalHold += holdMs
      }
      avgHoldTimeMs = paired > 0 ? totalHold / paired : 0
    }

    return { totalTrades, winRate, avgHoldTimeMs }
  }

  exportCSV(): string {
    const rows = this.db
      .prepare(`SELECT * FROM decisions ORDER BY timestamp DESC`)
      .all() as unknown as RawRow[]

    const header =
      'id,timestamp,strategy,action,market,confidence,reasoning,price_at_decision,position_id,tx_hash'
    const lines = rows.map((r) =>
      [
        r.id,
        r.timestamp,
        r.strategy,
        r.action,
        r.market,
        r.confidence,
        `"${r.reasoning.replace(/"/g, '""')}"`,
        r.price_at_decision,
        r.position_id ?? '',
        r.tx_hash ?? '',
      ].join(',')
    )
    return [header, ...lines].join('\n')
  }

  close(): void {
    this.db.close()
  }

  private _rowToDecision(row: RawRow): HermesDecision {
    return {
      id: row.id,
      timestamp: row.timestamp,
      strategy: row.strategy as HermesDecision['strategy'],
      action: row.action as HermesDecision['action'],
      market: row.market,
      confidence: row.confidence,
      reasoning: row.reasoning,
      priceAtDecision: row.price_at_decision,
      positionId: row.position_id ?? undefined,
      txHash: row.tx_hash ?? undefined,
    }
  }
}

interface RawRow {
  id: string
  timestamp: number
  strategy: string
  action: string
  market: string
  confidence: number
  reasoning: string
  price_at_decision: number
  position_id: number | null
  tx_hash: string | null
}
