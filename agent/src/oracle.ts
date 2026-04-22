import axios from 'axios'
import { createWalletClient, createPublicClient, http, keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from './chains'
import { ORACLE_ABI } from './abis'
import { PriceMap } from './types'

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'

export class OracleService {
  private cachedPrices: PriceMap = { 'BTC/USD': 0, 'ETH/USD': 0 }
  private lastFetchAt = 0
  private backoffMs = 1000
  private readonly oracleAddress: `0x${string}`
  private walletClient
  private publicClient

  // Market keys: keccak256(toBytes("BTC/USD")) etc.
  static readonly MARKET_KEYS: Record<string, `0x${string}`> = {
    'BTC/USD': keccak256(toBytes('BTC/USD')),
    'ETH/USD': keccak256(toBytes('ETH/USD')),
  }

  constructor(oracleAddress: string, privateKey: string) {
    this.oracleAddress = oracleAddress as `0x${string}`
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
  }

  /**
   * Fetch BTC and ETH prices from CoinGecko (free, no API key required).
   * Falls back to cached prices on error or rate-limit.
   */
  async fetchAll(): Promise<PriceMap> {
    const now = Date.now()
    // Debounce: don't hammer CoinGecko faster than 10 seconds
    if (now - this.lastFetchAt < 10_000 && this.cachedPrices['BTC/USD'] > 0) {
      return { ...this.cachedPrices }
    }

    try {
      const response = await axios.get(COINGECKO_URL, {
        timeout: 8000,
        headers: { Accept: 'application/json' },
      })

      const data = response.data as {
        bitcoin?: { usd?: number }
        ethereum?: { usd?: number }
      }

      const btc = data?.bitcoin?.usd
      const eth = data?.ethereum?.usd

      if (!btc || !eth) {
        throw new Error('Incomplete price data from CoinGecko')
      }

      this.cachedPrices = { 'BTC/USD': btc, 'ETH/USD': eth }
      this.lastFetchAt = now
      this.backoffMs = 1000 // reset backoff on success

      console.log(`[Oracle] BTC=$${btc.toLocaleString()} | ETH=$${eth.toLocaleString()}`)
      return { ...this.cachedPrices }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        // Rate limited — apply exponential backoff
        console.warn(`[Oracle] Rate limited (429). Backing off ${this.backoffMs}ms, using cached prices.`)
        this.backoffMs = Math.min(this.backoffMs * 2, 60_000)
      } else {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[Oracle] Fetch error: ${msg}. Using cached prices.`)
      }

      if (this.cachedPrices['BTC/USD'] === 0) {
        throw new Error('No cached prices available and fetch failed')
      }
      return { ...this.cachedPrices }
    }
  }

  /**
   * Push both BTC and ETH prices to the on-chain mock oracle.
   * Returns the last tx hash (ETH/USD update).
   */
  async pushToChain(prices: PriceMap): Promise<string> {
    let lastHash = ''
    for (const [market, usdPrice] of Object.entries(prices) as [keyof PriceMap, number][]) {
      const marketKey = OracleService.MARKET_KEYS[market]
      if (!marketKey) continue
      const chainlinkPrice = this.toChainlinkPrice(usdPrice)

      const hash = await this.walletClient.writeContract({
        address: this.oracleAddress,
        abi: ORACLE_ABI,
        functionName: 'updateMockPrice',
        args: [marketKey, chainlinkPrice],
      })

      await this.publicClient.waitForTransactionReceipt({ hash })
      console.log(`[Oracle] Pushed ${market}=$${usdPrice} on-chain. tx=${hash}`)
      lastHash = hash
    }
    return lastHash
  }

  /**
   * Convert a USD price to Chainlink 8-decimal int256.
   */
  toChainlinkPrice(usdPrice: number): bigint {
    return BigInt(Math.round(usdPrice * 1e8))
  }
}
