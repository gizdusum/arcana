# ARCANA — The Hidden Intelligence of Arc

> *Autonomous trading vault powered by HERMES agent on Arc Testnet*

ARCANA lets users deposit testnet USDC into a vault, select a strategy profile, and let **HERMES** — the autonomous agent — open and manage perpetual futures positions 24/7 on their behalf.

---

## Architecture

```
arcana/
├── contracts/          # Foundry — ERC-4626 vault + mock perp engine
├── agent/              # HERMES daemon — TypeScript, algorithmic trading
├── frontend/           # Next.js 14 — dashboard, leaderboard, decision log
└── deployments/        # Auto-generated contract addresses after deploy
```

## Arc Testnet

| Property | Value |
|----------|-------|
| Chain ID | `5042002` |
| RPC URL | `https://rpc.testnet.arc.network` |
| USDC | `0x3600000000000000000000000000000000000000` |
| Block Explorer | [testnet.arcscan.app](https://testnet.arcscan.app) |
| Faucet | [faucet.circle.com](https://faucet.circle.com) |

---

## HERMES Strategies

| Strategy | Leverage | Direction | Stop-Loss | Take-Profit |
|----------|----------|-----------|-----------|-------------|
| **APOLLO** | 3x max | Long only | 5% | 10% |
| **ATLAS** | 5x max | Long + Short | 10% | 20% |
| **ARES** | 10x max | Long + Short | 20% | 50% |

---

## Quick Start

### 1. Deploy Contracts

```bash
cd contracts
forge install
cp .env.example .env  # fill PRIVATE_KEY
forge test             # all tests must pass
forge script script/Deploy.s.sol --rpc-url $ARC_RPC_URL --broadcast
```

This writes `deployments/arc-testnet.json` with all addresses.

### 2. Start HERMES Agent

```bash
cd agent
npm install
cp .env.example .env  # fill PRIVATE_KEY + addresses from deployments/
npm run build
npm start
```

Or with Docker:
```bash
docker build -t arcana-hermes .
docker run --env-file .env arcana-hermes
```

### 3. Start Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # fill addresses from deployments/
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `ArcanaVault` | ERC-4626 USDC vault, issues aUSDC shares. HERMES is authorized agent. |
| `ArcanaPerpEngine` | Mock perpetual futures engine. No real counterparty — positions are simulated against oracle price. |
| `ArcanaOracle` | Chainlink feed wrapper with mock mode. Agent pushes CoinGecko prices every 15s. |
| `ArcanaStrategy` | Registry of APOLLO/ATLAS/ARES configurations. |
| `ArcanaPositionManager` | Tracks open position IDs per vault. |

---

## HERMES Decision Log

Every trading decision is stored in:
1. **Local SQLite** at `agent/data/decisions.db`
2. **On-chain** via `ArcanaVault.logDecision()` event emission

Example decision:
```
[14:23:07] OPEN_LONG  BTC/USD  2x  Confidence: 0.81
           "EMA20 (67,420) crossed above EMA50 (66,891), RSI=54.2 — momentum confirmed"
           Tx: 0xabcd...1234
```

---

## ⚠️ Disclaimer

**TESTNET ONLY** — All funds are test tokens with no real monetary value. This project is a demonstration of autonomous agent infrastructure on Arc Testnet. `ArcanaPerpEngine` is a mock perpetual engine — positions are simulated against oracle prices. There is no real counterparty.

HERMES is algorithmic — it uses technical analysis (EMA, RSI, momentum), not an LLM.

---

*Project by: gizdusum | Agent: HERMES | Arc Testnet | USDC Native | EVM Compatible*
