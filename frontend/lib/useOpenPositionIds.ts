'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useReadContract, useReadContracts, useWatchContractEvent } from 'wagmi'
import { PERP_ENGINE_ABI, PERP_ENGINE_ADDRESS, VAULT_ABI } from '@/lib/contracts'

export function useOpenPositionIds(vaultAddress?: `0x${string}`) {
  // ── Primary: getVaultOpenPositions (contract's own index, always accurate) ──
  const { data: primaryIds, refetch: refetchPrimary } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'getVaultOpenPositions',
    args: vaultAddress ? [vaultAddress] : undefined,
    query: {
      enabled: !!vaultAddress,
      refetchInterval: 3_000,
    },
  })

  // ── Fallback: scan every position by nextPositionId ─────────────────────────
  const { data: nextPosIdData, refetch: refetchNextPosId } = useReadContract({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    functionName: 'nextPositionId',
    query: { refetchInterval: 3_000 },
  })

  const scanCount = Math.min(Number(nextPosIdData ?? 0), 50)

  const positionContracts = useMemo(
    () =>
      Array.from({ length: scanCount }, (_, i) => ({
        address: PERP_ENGINE_ADDRESS as `0x${string}`,
        abi: PERP_ENGINE_ABI,
        functionName: 'positions' as const,
        args: [BigInt(i)] as const,
      })),
    [scanCount]
  )

  const { data: scannedData, refetch: refetchScanned } = useReadContracts({
    contracts: positionContracts,
    query: { enabled: !!vaultAddress && scanCount > 0 },
  })

  // ── Merge both sources (dedup) ───────────────────────────────────────────────
  const ids = useMemo(() => {
    const seen = new Set<string>()

    // Primary: getVaultOpenPositions already filters isOpen on-chain
    if (primaryIds) {
      for (const id of primaryIds) seen.add(id.toString())
    }

    // Fallback scan: filter client-side
    if (vaultAddress && scannedData) {
      for (const r of scannedData) {
        if (r.status !== 'success' || !r.result) continue
        const pos = r.result as readonly [
          bigint, `0x${string}`, `0x${string}`, boolean,
          bigint, bigint, number, bigint, bigint, boolean, bigint,
        ]
        if (
          pos[1].toLowerCase() === vaultAddress.toLowerCase() &&
          pos[9] === true
        ) {
          seen.add(pos[0].toString())
        }
      }
    }

    return [...seen].map(BigInt)
  }, [primaryIds, scannedData, vaultAddress])

  const refetch = useCallback(() => {
    refetchPrimary()
    refetchNextPosId()
    if (scanCount > 0) refetchScanned()
  }, [refetchPrimary, refetchNextPosId, refetchScanned, scanCount])

  // Watch on-chain events for instant update
  useWatchContractEvent({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    eventName: 'PositionOpened',
    onLogs: refetch,
  })
  useWatchContractEvent({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    eventName: 'PositionClosed',
    onLogs: refetch,
  })
  useWatchContractEvent({
    address: PERP_ENGINE_ADDRESS,
    abi: PERP_ENGINE_ABI,
    eventName: 'PositionLiquidated',
    onLogs: refetch,
  })
  // Also watch vault's PositionExecuted (Hermes fires this when opening)
  useWatchContractEvent({
    address: vaultAddress,
    abi: VAULT_ABI,
    eventName: 'PositionExecuted',
    onLogs: refetch,
  })

  // Fallback poll every 5s
  useEffect(() => {
    const iv = setInterval(refetch, 5_000)
    return () => clearInterval(iv)
  }, [refetch])

  return { ids, isLoading: false, refetch }
}
