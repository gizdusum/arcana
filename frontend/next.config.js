/** @type {import('next').NextConfig} */
const nextConfig = {
  // Web3 dApps require dynamic rendering (wagmi/RainbowKit use localStorage)
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  webpack: (config) => {
    // Suppress @react-native-async-storage warning from MetaMask SDK
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    }
    return config
  },
}
module.exports = nextConfig
