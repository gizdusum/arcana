'use client'

import { useAccount, useReadContract } from 'wagmi'
import { VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts'
import { formatUSDCRaw, shortAddress } from '@/lib/utils'

export function VaultCard() {
  const { address, isConnected } = useAccount()

  const { data: totalAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalAssets',
  })

  const { data: totalSupply } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'totalSupply',
  })

  const { data: userShares, isLoading: loadingShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const { data: userAssets, isLoading: loadingAssets } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'convertToAssets',
    args: userShares ? [userShares] : undefined,
    query: { enabled: !!userShares && userShares > 0n },
  })

  const sharePercent =
    userShares && totalSupply && totalSupply > 0n
      ? ((Number(userShares) / Number(totalSupply)) * 100).toFixed(2)
      : '0.00'

  const loading = loadingShares || loadingAssets

  const usdcValue = userAssets !== undefined ? formatUSDCRaw(userAssets) : '0.00'
  const sharesValue =
    userShares !== undefined
      ? (Number(userShares) / 1e6).toLocaleString('en-US', {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        })
      : '—'

  if (!isConnected) {
    return (
      <div className="border border-[#1c2540] bg-surface p-6">
        <p className="label mb-4">Your Vault</p>
        <p className="font-mono text-sm text-ink-2">Connect wallet to view balance</p>
      </div>
    )
  }

  return (
    <div className="border border-[#1c2540] bg-surface p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <span className="label">Your Vault</span>
        {address && (
          <span className="font-mono text-2xs text-ink-3">{shortAddress(address)}</span>
        )}
      </div>

      {/* Main balance */}
      {loading ? (
        <div className="space-y-2 animate-pulse mt-3">
          <div className="h-9 w-40 bg-surface-2 rounded-sm" />
          <div className="h-4 w-28 bg-surface-2 rounded-sm" />
        </div>
      ) : (
        <>
          <div className="mt-1 font-mono text-4xl font-light text-ink tracking-tight">
            ${usdcValue}
          </div>
          <div className="mt-1 font-mono text-xs text-ink-3">USDC value</div>
        </>
      )}

      {/* Separator */}
      <div className="my-5 h-px bg-[#1c2540]" />

      {/* Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label">aUSDC Shares</span>
          <span className="font-mono text-xs text-ink">{sharesValue}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="label">Your Share</span>
          <span className="font-mono text-xs text-ink">{sharePercent}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="label">Vault TVL</span>
          <span className="font-mono text-xs text-ink">
            {totalAssets !== undefined ? `$${formatUSDCRaw(totalAssets)}` : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
