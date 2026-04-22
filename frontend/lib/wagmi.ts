import { defineChain } from 'viem'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  rabbyWallet,
  walletConnectWallet,
  coinbaseWallet,
  injectedWallet,
  rainbowWallet,
  trustWallet,
  phantomWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http, createStorage, cookieStorage } from 'wagmi'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public:  { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

// Only include WalletConnect-dependent wallets when a project ID is configured.
// Without a project ID, WalletConnect v2 throws on initialization.
const popularWallets = PROJECT_ID
  ? [metaMaskWallet, rabbyWallet, walletConnectWallet, coinbaseWallet]
  : [metaMaskWallet, rabbyWallet, coinbaseWallet]

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: popularWallets,
    },
    {
      groupName: 'More',
      wallets: [
        injectedWallet,
        rainbowWallet,
        trustWallet,
        phantomWallet,
      ],
    },
  ],
  {
    appName: 'ARCANA',
    projectId: PROJECT_ID || 'arcana-placeholder',
  }
)

export const wagmiConfig = createConfig({
  connectors,
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
})
