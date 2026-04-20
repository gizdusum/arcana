import {
  createWalletClient,
  createPublicClient,
  http,
  TransactionReceipt,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from './chains'
import { VAULT_ABI, ORACLE_ABI } from './abis'

export interface TxResult {
  hash: string
  confirmedInMs: number
}

export class TransactionExecutor {
  private walletClient
  private publicClient
  private readonly vaultAddress: `0x${string}`
  private readonly oracleAddress: `0x${string}`
  private readonly maxRetries = 3

  constructor(privateKey: string, vaultAddress: string, oracleAddress: string) {
    const account = privateKeyToAccount(privateKey as `0x${string}`)
    this.walletClient = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(),
    })
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    })
    this.vaultAddress = vaultAddress as `0x${string}`
    this.oracleAddress = oracleAddress as `0x${string}`
  }

  /**
   * Execute a write against the ArcanaVault contract.
   * Retries up to maxRetries times on transient RPC errors.
   */
  async executeVaultTx(
    functionName: string,
    args: unknown[]
  ): Promise<TxResult> {
    let attempt = 0
    while (attempt < this.maxRetries) {
      try {
        const start = Date.now()
        const hash = await this.walletClient.writeContract({
          address: this.vaultAddress,
          abi: VAULT_ABI,
          functionName: functionName as
            | 'executeOpen'
            | 'executeClose'
            | 'logDecision'
            | 'setStrategy'
            | 'approveEngine',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          args: args as any,
        })
        const { confirmedInMs } = await this.waitForConfirmation(hash)
        const total = Date.now() - start

        console.log(
          `[Executor] ${functionName} confirmed in ${(total / 1000).toFixed(2)}s | tx=${hash}`
        )
        return { hash, confirmedInMs: total }
      } catch (err: unknown) {
        attempt++
        const msg = err instanceof Error ? err.message : String(err)
        if (attempt >= this.maxRetries) {
          throw new Error(
            `[Executor] ${functionName} failed after ${this.maxRetries} attempts: ${msg}`
          )
        }
        const waitMs = 2000 * attempt
        console.warn(
          `[Executor] ${functionName} attempt ${attempt} failed: ${msg}. Retrying in ${waitMs}ms…`
        )
        await this._sleep(waitMs)
      }
    }
    // Unreachable, but satisfies TypeScript
    throw new Error('[Executor] Unexpected retry loop exit')
  }

  /**
   * Push a single market price to the on-chain mock oracle.
   */
  async updateOraclePrice(
    marketKey: `0x${string}`,
    price: bigint
  ): Promise<string> {
    let attempt = 0
    while (attempt < this.maxRetries) {
      try {
        const hash = await this.walletClient.writeContract({
          address: this.oracleAddress,
          abi: ORACLE_ABI,
          functionName: 'updateMockPrice',
          args: [marketKey, price],
        })
        await this.waitForConfirmation(hash)
        return hash
      } catch (err: unknown) {
        attempt++
        const msg = err instanceof Error ? err.message : String(err)
        if (attempt >= this.maxRetries) {
          throw new Error(`[Executor] updateOraclePrice failed after ${this.maxRetries} attempts: ${msg}`)
        }
        await this._sleep(2000 * attempt)
      }
    }
    throw new Error('[Executor] Unexpected retry loop exit')
  }

  /**
   * Wait for a transaction receipt and return how long it took.
   * Arc testnet has sub-second finality so this usually resolves in ~400ms.
   */
  async waitForConfirmation(
    hash: string
  ): Promise<{ receipt: TransactionReceipt; confirmedInMs: number }> {
    const start = Date.now()
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      timeout: 30_000,
    })
    const confirmedInMs = Date.now() - start
    console.log(`[Executor] Confirmed in ${(confirmedInMs / 1000).toFixed(2)}s`)
    return { receipt, confirmedInMs }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Read vault total assets.
   */
  async getVaultTotalAssets(): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'totalAssets',
    })
    return result as bigint
  }
}
