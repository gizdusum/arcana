import dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { HermesAgent } from './hermes'
import { DecisionLogger } from './logger'
import { startApiServer } from './api'
import { HermesConfig, StrategyType } from './types'

dotenv.config()

// ─────────────────────────────────────────────────────────────────────────────
// Startup Banner
// ─────────────────────────────────────────────────────────────────────────────

function printBanner(config: HermesConfig): void {
  const strategy = config.strategy.padEnd(16)
  const vault = (config.vaultAddress.slice(0, 20) + '...').padEnd(35)
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║  ⚡ ARCANA — HERMES AGENT DAEMON                     ║')
  console.log(`║  Strategy : ${strategy}                  ║`)
  console.log(`║  Vault    : ${vault}║`)
  console.log(`║  Network  : Arc Testnet (Chain ID 5042002)           ║`)
  console.log(`║  Oracle   : ${config.oracleMode.padEnd(43)}║`)
  console.log('╚══════════════════════════════════════════════════════╝')
}

// ─────────────────────────────────────────────────────────────────────────────
// Load Deployments from JSON if addresses not in env
// ─────────────────────────────────────────────────────────────────────────────

interface DeploymentJSON {
  // Keys written by Deploy.s.sol
  ArcanaVault?: string
  ArcanaPerpEngine?: string
  ArcanaOracle?: string
  // Legacy / alternate keys
  vault?: string
  perpEngine?: string
  oracle?: string
  VaultAddress?: string
  PerpEngineAddress?: string
  OracleAddress?: string
}

function loadDeployments(): DeploymentJSON {
  const candidates = [
    path.resolve(__dirname, '../../deployments/arc-testnet.json'),
    path.resolve(process.cwd(), '../deployments/arc-testnet.json'),
    path.resolve(process.cwd(), 'deployments/arc-testnet.json'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = fs.readFileSync(candidate, 'utf-8')
        const parsed = JSON.parse(raw) as DeploymentJSON
        console.log(`[HERMES] Loaded deployments from ${candidate}`)
        return parsed
      } catch {
        // continue
      }
    }
  }

  console.warn('[HERMES] No arc-testnet.json deployment file found. Using env vars only.')
  return {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate Required Env Vars
// ─────────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val || val.trim() === '' || val.trim() === '0x...') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return val.trim()
}

function getEnvOrDeployment(
  envKey: string,
  deployment: DeploymentJSON,
  ...deploymentKeys: (keyof DeploymentJSON)[]
): string {
  const fromEnv = process.env[envKey]
  if (fromEnv && fromEnv.trim() !== '' && fromEnv.trim() !== '0x...') {
    return fromEnv.trim()
  }
  for (const key of deploymentKeys) {
    const fromDeploy = deployment[key]
    if (fromDeploy) return fromDeploy
  }
  throw new Error(
    `Address not found in env var ${envKey} or deployment JSON (keys: ${deploymentKeys.join(', ')})`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const deployments = loadDeployments()

  const privateKey = requireEnv('PRIVATE_KEY')
  const rpcUrl = process.env['ARC_RPC_URL'] ?? 'https://rpc.testnet.arc.network'

  const vaultAddress = getEnvOrDeployment('VAULT_ADDRESS', deployments, 'ArcanaVault', 'vault', 'VaultAddress')
  const perpEngineAddress = getEnvOrDeployment(
    'PERP_ENGINE_ADDRESS',
    deployments,
    'ArcanaPerpEngine',
    'perpEngine',
    'PerpEngineAddress'
  )
  const oracleAddress = getEnvOrDeployment('ORACLE_ADDRESS', deployments, 'ArcanaOracle', 'oracle', 'OracleAddress')

  const strategyRaw = (process.env['HERMES_STRATEGY'] ?? 'ATLAS').toUpperCase()
  const validStrategies: StrategyType[] = ['APOLLO', 'ATLAS', 'ARES']
  if (!validStrategies.includes(strategyRaw as StrategyType)) {
    throw new Error(`Invalid strategy: ${strategyRaw}. Must be one of: ${validStrategies.join(', ')}`)
  }

  const config: HermesConfig = {
    rpcUrl,
    privateKey,
    vaultAddress,
    perpEngineAddress,
    oracleAddress,
    strategy: strategyRaw as StrategyType,
    cycleInterval: parseInt(process.env['CYCLE_INTERVAL'] ?? '15', 10),
    oracleMode: (process.env['ORACLE_MODE'] ?? 'mock') as 'chainlink' | 'mock',
  }

  printBanner(config)

  // Start the API server
  const dbPath = process.env['DB_PATH'] ?? './data/decisions.db'
  const logger = new DecisionLogger(dbPath)
  startApiServer(logger)

  // Instantiate and start HERMES
  const hermes = new HermesAgent(config)

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[HERMES] Received ${signal}. Shutting down gracefully…`)
    await hermes.stop()
    logger.close()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('uncaughtException', (err) => {
    console.error('[HERMES] Uncaught exception:', err)
    // Don't exit — HERMES must stay alive
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[HERMES] Unhandled rejection:', reason)
  })

  await hermes.start()
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[HERMES] Fatal startup error:', msg)
  process.exit(1)
})
