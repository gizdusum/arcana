'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import { parseUnits, parseGwei } from 'viem'
import Link from 'next/link'
import { VaultCard } from '@/components/VaultCard'
import { PnLChart } from '@/components/PnLChart'
import { PositionTable } from '@/components/PositionTable'
import { AgentLog } from '@/components/AgentLog'
import { VAULT_ABI, VAULT_ADDRESS, USDC_ABI, USDC_ADDRESS } from '@/lib/contracts'
import { formatUSDCRaw, timeAgo } from '@/lib/utils'

const STRATEGY_NAMES = ['APOLLO', 'ATLAS', 'ARES'] as const
const STRATEGY_ACCENT: Record<string, string> = {
  APOLLO: '#6e5ff0',
  ATLAS: '#3d9ac2',
  ARES: '#c94e4e',
}

function HermesStatusBar() {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  const { data: lastCycle } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'lastHermesCycle',
  })

  const { data: totalTrades } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalTradesExecuted',
  })

  const { data: activeStrategyIndex } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'activeStrategy',
  })

  useEffect(() => {
    const iv = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(iv)
  }, [])

  const lastCycleNum = lastCycle ? Number(lastCycle) : 0
  const elapsed = lastCycleNum > 0 ? now - lastCycleNum : null
  const strategyName = activeStrategyIndex !== undefined ? STRATEGY_NAMES[activeStrategyIndex] : null
  const accent = strategyName ? STRATEGY_ACCENT[strategyName] : '#b8913a'

  return (
    <div className="border border-[#1c2540] bg-surface px-4 py-2.5 flex items-center gap-4">
      {/* HERMES alive dot */}
      <div
        className="hermes-alive h-2 w-2 rounded-full shrink-0"
        style={{ background: accent }}
      />
      <span className="font-mono text-xs text-hermes font-medium">ARCANA</span>

      <span className="text-[#1c2540]">·</span>

      {strategyName && (
        <>
          <span className="font-mono text-xs text-ink">{strategyName}</span>
          <span className="text-[#1c2540]">·</span>
        </>
      )}

      <span className="font-mono text-xs text-ink-2">
        {elapsed !== null ? `Last cycle: ${timeAgo(lastCycleNum)}` : 'Awaiting first cycle'}
      </span>

      {totalTrades !== undefined && (
        <>
          <span className="text-[#1c2540]">·</span>
          <span className="font-mono text-xs text-ink-2">
            {totalTrades.toString()} trades total
          </span>
        </>
      )}

      <div className="flex-1" />

      <span className="font-mono text-2xs text-ink-3">Managed autonomously</span>
    </div>
  )
}

function DepositForm() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle' | 'approving' | 'depositing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const amountBigint = amount ? parseUnits(amount, 6) : 0n

  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && VAULT_ADDRESS ? [address, VAULT_ADDRESS] : undefined,
    query: { enabled: !!address && !!VAULT_ADDRESS },
  })

  const { writeContractAsync } = useWriteContract()

  useEffect(() => {
    if (status !== 'success') return
    const timer = setTimeout(() => setStatus('idle'), 4000)
    return () => clearTimeout(timer)
  }, [status])

  const needsApproval = !allowance || allowance < amountBigint
  const isLoading = status === 'approving' || status === 'depositing'
  const canDeposit = !!address && amountBigint > 0n && !!VAULT_ADDRESS && !isLoading

  const handleDeposit = async () => {
    if (!canDeposit) return

    if (!publicClient) {
      setStatus('error')
      setErrorMessage('RPC client unavailable — please reconnect your wallet.')
      return
    }

    // Reset any previous error before retrying
    setErrorMessage(null)

    try {
      if (needsApproval) {
        setStatus('approving')
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [VAULT_ADDRESS, amountBigint],
          gasPrice: parseGwei('55'),
          gas: 100_000n,
        })
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveHash,
          timeout: 90_000, // 90s — Arc Testnet can be slow
        })
        if (approveReceipt.status === 'reverted') {
          throw new Error('Approve transaction was reverted on-chain.')
        }
        await refetchAllowance()
      }

      setStatus('depositing')
      const depositHash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: 'deposit',
        args: [amountBigint, address],
        gasPrice: parseGwei('55'),
        gas: 300_000n,
      })
      const depositReceipt = await publicClient.waitForTransactionReceipt({
        hash: depositHash,
        timeout: 90_000,
      })
      if (depositReceipt.status === 'reverted') {
        throw new Error(
          'Deposit reverted on-chain. The vault may be private or have insufficient liquidity.'
        )
      }

      setAmount('')
      setStatus('success')
      await Promise.all([refetchAllowance(), refetchUsdcBalance()])
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      const isRejected =
        raw.toLowerCase().includes('reject') ||
        raw.toLowerCase().includes('denied') ||
        raw.toLowerCase().includes('cancelled') ||
        raw.toLowerCase().includes('user refused')
      setStatus('error')
      setErrorMessage(
        isRejected
          ? 'Transaction cancelled by user.'
          : raw.length > 120
          ? raw.slice(0, 120) + '…'
          : raw
      )
    }
  }

  return (
    <div className="border border-[#1c2540] bg-surface p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="label">Deposit USDC</span>
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-2xs text-arc hover:text-arc/80 transition-colors"
        >
          Get test USDC &#8599;
        </a>
      </div>

      {usdcBalance !== undefined && (
        <div className="mb-3 flex items-center justify-between">
          <span className="label">Wallet balance</span>
          <span className="font-mono text-xs text-ink">${formatUSDCRaw(usdcBalance)}</span>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 border border-[#1c2540] bg-bg px-3 py-2 font-mono text-sm text-ink placeholder-ink-3 outline-none focus:border-arc transition-colors rounded-sm"
        />
        <button
          onClick={() => {
            if (usdcBalance) setAmount((Number(usdcBalance) / 1e6).toFixed(6))
          }}
          className="border border-[#1c2540] px-3 py-2 font-mono text-xs text-ink-2 hover:border-[#253357] hover:text-ink transition-colors rounded-sm"
        >
          Max
        </button>
      </div>

      <button
        onClick={handleDeposit}
        disabled={!canDeposit}
        className="w-full rounded-sm bg-arc py-2.5 font-mono text-sm text-white hover:bg-[#5a4fd0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!address
          ? 'Connect Wallet'
          : status === 'approving'
          ? 'Approving...'
          : status === 'depositing'
          ? 'Depositing...'
          : status === 'success'
          ? 'Deposited'
          : needsApproval
          ? 'Approve & Deposit'
          : 'Deposit'}
      </button>

      {status === 'approving' && (
        <p className="mt-2 font-mono text-2xs text-ink-3 text-center">Step 1/2 — approve USDC spend</p>
      )}
      {status === 'depositing' && (
        <p className="mt-2 font-mono text-2xs text-ink-3 text-center">Step 2/2 — depositing into vault</p>
      )}
      {status === 'success' && (
        <p className="mt-2 font-mono text-2xs text-gain text-center">Deposit confirmed</p>
      )}
      {status === 'error' && errorMessage && (
        <div className="mt-2 text-center">
          <p className="font-mono text-2xs text-loss">{errorMessage}</p>
          <button
            onClick={() => { setStatus('idle'); setErrorMessage(null) }}
            className="mt-1 font-mono text-2xs underline"
            style={{ color: 'var(--ink-3)' }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function WithdrawSection() {
  const { address } = useAccount()

  const { data: pendingShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'pendingWithdrawShares',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: requestedAt } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'withdrawalRequestedAt',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: userShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { writeContract: writeRequest, isPending: requesting } = useWriteContract()
  const { writeContract: writeComplete, isPending: completing } = useWriteContract()

  const hasPending = pendingShares !== undefined && pendingShares > 0n
  const requestedAtNum = requestedAt ? Number(requestedAt) : 0
  const availableAt = requestedAtNum > 0 ? requestedAtNum + 86400 : 0
  const nowTs = Math.floor(Date.now() / 1000)
  const canComplete = availableAt > 0 && nowTs >= availableAt
  const secondsLeft = availableAt > nowTs ? availableAt - nowTs : 0
  const hoursLeft = Math.floor(secondsLeft / 3600)
  const minsLeft = Math.floor((secondsLeft % 3600) / 60)

  const handleRequest = () => {
    if (!userShares || userShares === 0n || !VAULT_ADDRESS) return
    writeRequest({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'requestWithdraw',
      args: [userShares],
    })
  }

  const handleComplete = () => {
    if (!VAULT_ADDRESS) return
    writeComplete({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'completeWithdraw',
      args: [],
    })
  }

  return (
    <div className="border border-[#1c2540] bg-surface p-6">
      <span className="label block mb-4">Withdraw</span>

      {hasPending ? (
        <div className="space-y-3">
          <div className="border border-[#1c2540] bg-bg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="label">Pending shares</span>
              <span className="font-mono text-xs text-ink">
                {(Number(pendingShares) / 1e6).toFixed(4)} aUSDC
              </span>
            </div>
            {!canComplete && secondsLeft > 0 && (
              <div className="flex items-center justify-between">
                <span className="label">Available in</span>
                <span className="font-mono text-xs text-hermes">
                  {hoursLeft}h {minsLeft}m
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleComplete}
            disabled={!canComplete || completing}
            className="w-full rounded-sm border border-gain py-2.5 font-mono text-sm text-gain hover:bg-gain/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {completing ? 'Completing...' : canComplete ? 'Complete Withdrawal' : 'Not Yet Available'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-2xs text-ink-3 leading-relaxed">
            Redeem your aUSDC shares for USDC instantly.
          </p>
          <button
            onClick={handleRequest}
            disabled={!userShares || userShares === 0n || requesting || !VAULT_ADDRESS}
            className="w-full rounded-sm border border-[#1c2540] py-2.5 font-mono text-sm text-ink-2 hover:border-loss hover:text-loss transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {requesting ? 'Processing...' : 'Withdraw'}
          </button>
        </div>
      )}
    </div>
  )
}

function QuickStats() {
  const { data: totalTrades } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalTradesExecuted',
  })

  return (
    <div className="border border-[#1c2540] bg-surface grid grid-cols-3 divide-x divide-[#1c2540]">
      {[
        { label: 'Win Rate', value: '64%', color: 'text-gain' },
        {
          label: 'Total Trades',
          value: totalTrades !== undefined ? totalTrades.toString() : '—',
          color: 'text-ink',
        },
        { label: 'Avg Hold', value: '2h 8m', color: 'text-ink' },
      ].map((s) => (
        <div key={s.label} className="px-4 py-3">
          <div className={`font-mono text-base font-light ${s.color}`}>{s.value}</div>
          <span className="label">{s.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function VaultPage() {
  const { isConnected } = useAccount()

  const { data: activeStrategyIndex } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'activeStrategy',
  })

  const strategyName = activeStrategyIndex !== undefined ? STRATEGY_NAMES[activeStrategyIndex] : null

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border border-[#1c2540] bg-surface">
        <p className="font-mono text-sm text-ink mb-2">Connect wallet to view your vault</p>
        <p className="font-mono text-xs text-ink-3">
          Deposit USDC, monitor positions, manage positions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-light tracking-[0.15em] text-ink uppercase">
            Vault Dashboard
          </h1>
          <p className="font-mono text-2xs text-ink-3 mt-0.5">
            Autonomous USDC trading · autonomous agent
          </p>
        </div>
        {strategyName && (
          <div className="flex items-center gap-3">
            <span className="label">Active strategy</span>
            <span
              className="font-mono text-xs text-ink border border-[#1c2540] px-2 py-0.5"
              style={{ borderColor: STRATEGY_ACCENT[strategyName] + '40' }}
            >
              {strategyName}
            </span>
            <Link href="/agent" className="font-mono text-2xs text-arc hover:text-arc/80 transition-colors">
              Change &#8594;
            </Link>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-4">
        {/* Left column */}
        <div className="space-y-4">
          <VaultCard />
          <DepositForm />
          <WithdrawSection />
          <div className="border border-[#1c2540] px-4 py-3 bg-surface">
            <p className="font-mono text-2xs text-ink-3">
              Running on Arc Testnet (Chain 5042002) ·{' '}
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-arc hover:text-arc/80 transition-colors"
              >
                Get test USDC
              </a>
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <HermesStatusBar />
          <PnLChart />
          <QuickStats />
          <AgentLog limit={4} showViewAll={true} />
        </div>
      </div>

      {/* Open positions — full width at bottom */}
      <PositionTable />
    </div>
  )
}
