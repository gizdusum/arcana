import { NextRequest, NextResponse } from 'next/server'
import {
  createWalletClient,
  createPublicClient,
  http,
  parseGwei,
  parseUnits,
  keccak256,
  stringToBytes,
  defineChain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public:  { http: ['https://rpc.testnet.arc.network'] },
  },
  testnet: true,
})

const VAULT_ABI = [
  {
    type: 'function',
    name: 'executeOpen',
    inputs: [
      { name: 'market',           type: 'bytes32', internalType: 'bytes32'  },
      { name: 'isLong',           type: 'bool',    internalType: 'bool'     },
      { name: 'collateralAmount', type: 'uint256', internalType: 'uint256'  },
      { name: 'leverage',         type: 'uint8',   internalType: 'uint8'    },
    ],
    outputs: [{ name: 'positionId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const

const ORACLE_ABI = [
  {
    type: 'function',
    name: 'updateMockPrice',
    inputs: [
      { name: 'market', type: 'bytes32', internalType: 'bytes32' },
      { name: 'price',  type: 'int256',  internalType: 'int256'  },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

const RPC = 'https://rpc.testnet.arc.network'

async function fetchPrice(asset: string): Promise<number | null> {
  try {
    const sym = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT'
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`, { cache: 'no-store' })
    const d = await r.json()
    return parseFloat(d.price)
  } catch {
    return null
  }
}

async function pollReceipt(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: `0x${string}`,
  timeoutMs = 120_000
): Promise<{ status: 'success' | 'reverted'; blockNumber: bigint }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null)
    if (receipt && receipt.blockNumber != null) {
      return { status: receipt.status, blockNumber: receipt.blockNumber }
    }
    await new Promise((r) => setTimeout(r, 4_000))
  }
  throw new Error('Timed out waiting for transaction receipt')
}

export async function POST(req: NextRequest) {
  const { asset, isLong, collateralUsdc, leverage } = await req.json() as {
    asset: string
    isLong: boolean
    collateralUsdc: number
    leverage: number
  }

  const privateKey = process.env.HERMES_PRIVATE_KEY
  const vaultAddress = process.env.HERMES_VAULT_ADDRESS || '0x5e1ac795fEF51F6F261890Bb4d0119aD1f097D21'
  const oracleAddress = process.env.HERMES_ORACLE_ADDRESS || '0x577dE275F2Bbe090E104422e931e5e74B680AB81'

  if (!privateKey) {
    return NextResponse.json({ error: 'HERMES_PRIVATE_KEY not configured' }, { status: 500 })
  }
  if (!asset || collateralUsdc <= 0 || leverage < 1 || leverage > 10) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC) })
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC) })

  const marketStr = asset === 'BTC' ? 'BTC/USD' : 'ETH/USD'
  const marketKey = keccak256(stringToBytes(marketStr))
  const collateral = parseUnits(String(collateralUsdc), 6)

  // 1. Update oracle with live price before opening
  const livePrice = await fetchPrice(asset)
  if (livePrice !== null) {
    try {
      const priceIn8Dec = BigInt(Math.round(livePrice * 1e8))
      const oracleHash = await walletClient.writeContract({
        address: oracleAddress as `0x${string}`,
        abi: ORACLE_ABI,
        functionName: 'updateMockPrice',
        args: [marketKey, priceIn8Dec as unknown as bigint],
        gasPrice: parseGwei('55'),
        gas: 100_000n,
      })
      await pollReceipt(publicClient, oracleHash, 60_000)
    } catch {
      // Non-fatal: continue with existing oracle price
    }
  }

  // 2. Open position via vault.executeOpen
  let hash: `0x${string}`
  try {
    hash = await walletClient.writeContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'executeOpen',
      args: [marketKey, isLong, collateral, leverage as unknown as number],
      gasPrice: parseGwei('55'),
      gas: 2_000_000n,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // 3. Poll for receipt
  try {
    const receipt = await pollReceipt(publicClient, hash)
    if (receipt.status === 'reverted') {
      return NextResponse.json({ error: 'Transaction reverted', hash }, { status: 500 })
    }
    return NextResponse.json({ success: true, hash })
  } catch (err) {
    // TX submitted but not yet confirmed — return hash so caller can track
    return NextResponse.json({ success: true, hash, pending: true })
  }
}
