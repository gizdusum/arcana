import express from "express"
import cors from "cors"
import crypto from "crypto"

const app = express()
const PORT = 3001
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = "nousresearch/hermes-3-llama-3.1-70b"
const VAULT_ADDRESS = "0x5e1ac795fEF51F6F261890Bb4d0119aD1f097D21"

// --- Circle Contract Monitoring webhook state ---
const vaultActivityCache = [] // en fazla MAX_CACHE event, en yeni en başta
const MAX_CACHE = 50

app.use(cors())

// Circle webhook route: HMAC imzası ham body üzerinden doğrulandığı için
// GLOBAL express.json()'DAN ÖNCE, kendi express.raw() middleware'i ile mount edilir.
app.post("/webhooks/circle", express.raw({ type: "application/json" }), (req, res) => {
  const secret = process.env.CIRCLE_WEBHOOK_SECRET
  if (!secret) return res.status(503).json({ error: "Webhook not configured" })

  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "")
  // Circle standart imza header'ı; docs netleşince tek yerden değiştirilir.
  const signature = req.get("X-Circle-Signature") || ""
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(401).json({ error: "Invalid signature" })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return res.status(400).json({ error: "Invalid JSON" })
  }

  // Circle payload şeması kesin değil; olası alan yollarını savunmacı biçimde tara.
  const n = payload.notification || payload.event || payload
  const eventName = n.eventName || n.event || n.name || payload.eventName || "UnknownEvent"
  const contractAddress = n.contractAddress || n.address || payload.contractAddress || VAULT_ADDRESS
  const block = n.blockHeight ?? n.blockNumber ?? n.block ?? payload.blockHeight ?? null
  const txHash = n.txHash || n.transactionHash || payload.txHash || null
  const rawArgs = n.args || n.eventParameters || n.params || {}

  // Deposit/Withdraw için from/to/amount normalize et.
  const from = rawArgs.from ?? rawArgs.sender ?? rawArgs.owner ?? null
  const to = rawArgs.to ?? rawArgs.receiver ?? null
  const amount = rawArgs.amount ?? rawArgs.assets ?? rawArgs.value ?? null

  const activity = {
    eventName,
    contractAddress,
    block,
    txHash,
    from,
    to,
    amount,
    args: rawArgs,
    receivedAt: new Date().toISOString(),
  }

  vaultActivityCache.unshift(activity)
  if (vaultActivityCache.length > MAX_CACHE) vaultActivityCache.length = MAX_CACHE

  console.log(`Circle webhook: ${eventName} @ ${block ?? "?"}`)
  return res.status(200).json({ received: true })
})

app.get("/api/vault-activity", (_, res) => res.json({ events: vaultActivityCache }))

app.use(express.json())

const hexToNum = (hex, dec) => {
  if (!hex || hex === "0x" || hex === "0x0") return 0
  try { return Number(BigInt(hex)) / Math.pow(10, dec) } catch { return 0 }
}

async function rpcCall(data) {
  const r = await fetch("https://rpc.testnet.arc.network", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "eth_call", params: [{ to: VAULT_ADDRESS, data }, "latest"], id: 1 }),
  })
  return (await r.json()).result ?? "0x"
}

async function fetchVaultState(userAddress) {
  try {
    const [assetsHex, supplyHex, stratHex] = await Promise.all([
      rpcCall("0x01e1d114"),
      rpcCall("0x18160ddd"),
      rpcCall("0xd1d5a99f"),
    ])
    const assets = hexToNum(assetsHex, 6)
    const supply = hexToNum(supplyHex, 6)
    const stratIdx = hexToNum(stratHex, 0)
    const strat = ["APOLLO", "ATLAS", "ARES"][stratIdx] ?? "APOLLO"
    const price = supply > 0 ? assets / supply : 1
    let userBalance = 0
    let userInfo = "User vault balance: $0.00 (no deposit yet)"
    if (userAddress?.startsWith("0x") && userAddress.length === 42) {
      const sharesHex = await rpcCall("0x70a08231" + userAddress.slice(2).padStart(64, "0"))
      const shares = hexToNum(sharesHex, 6)
      userBalance = shares * price
      userInfo = `User vault share: $${userBalance.toFixed(2)} (${shares.toFixed(4)} aUSDC)`
    }
    return {
      text: `Vault TVL: $${assets.toFixed(2)} | Supply: ${supply.toFixed(4)} aUSDC | Strategy: ${strat} | Share price: $${price.toFixed(4)} | ${userInfo}`,
      userBalance,
      strat,
    }
  } catch (e) {
    return { text: `Vault data unavailable (${e.message})`, userBalance: 0, strat: "APOLLO" }
  }
}

async function fetchPrices() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true")
    const d = await r.json()
    const b = d.bitcoin, e = d.ethereum
    return `BTC: $${b.usd.toLocaleString()} (${b.usd_24h_change > 0 ? "+" : ""}${b.usd_24h_change?.toFixed(2)}% 24h) | ETH: $${e.usd.toLocaleString()} (${e.usd_24h_change > 0 ? "+" : ""}${e.usd_24h_change?.toFixed(2)}% 24h)`
  } catch { return "Prices unavailable" }
}

function buildSystemPrompt(vault, prices, strategy, userBalance) {
  const strategyVoices = {
    APOLLO: {
      title: 'APOLLO — Conservative',
      leverage: '3x max',
      direction: 'Long only',
      voice: `You are APOLLO, the conservative trading advisor on Arcana.
Your mandate: grow the vault steadily while protecting the downside at all costs.
You trade longs only, maximum 3x leverage. You don't chase momentum — you look for
setups where probability tilts in your favor before risking a single dollar.
Risk parameters: Stop-loss 5%, take-profit 10%.
Personality: Measured. Methodical. Capital-first. You walk away from marginal setups.`,
      sizeGuidance: '$5 to $50 fits my mandate'
    },
    ATLAS: {
      title: 'ATLAS — Balanced',
      leverage: '5x max',
      direction: 'Long + Short',
      voice: `You are ATLAS, the balanced trading advisor on Arcana.
You operate across both sides of the market — long when structure supports it, short
when it breaks down. 5x maximum leverage, balanced exposure across positions.
You synthesize on-chain signals, price structure, and macro context before positioning.
No single factor decides a trade.
Risk parameters: Stop-loss 10%, take-profit 20%.
Personality: Analytical. Adaptive. Bi-directional. Neither direction intimidates you.`,
      sizeGuidance: '$10 to $500 depending on conviction'
    },
    ARES: {
      title: 'ARES — Aggressive',
      leverage: '10x max',
      direction: 'Long + Short',
      voice: `You are ARES, the aggressive trading advisor on Arcana.
You don't hesitate when structure breaks. 10x maximum leverage, both directions,
max alpha. You hunt momentum and opportunity. Defensive positions are not your style.
Risk parameters: Stop-loss 15%, take-profit 30%.
Personality: Decisive. Opportunistic. Momentum-driven. You move when others wait.`,
      sizeGuidance: 'Tell me the size — the bigger your conviction, the better'
    }
  }

  const char = strategyVoices[strategy] || strategyVoices.ATLAS
  const balance = typeof userBalance === 'number' ? userBalance : 0

  return `${char.voice}

=== LIVE DATA ===
${vault}
${prices}
Active strategy: ${char.title} (${char.leverage}, ${char.direction})
USER_VAULT_BALANCE_USD: ${balance.toFixed(2)}

=== LANGUAGE ===
Detect the language of the user's most recent message and respond ENTIRELY
in that same language. If the user writes in Turkish, respond fully in
Turkish. If in English, respond fully in English. Never mix languages in a
single response. Keep all [PROPOSAL] JSON keys and values in English
regardless of response language.

=== INTENT DETECTION ===
Identify the user's intent from their message. Respond accordingly:

1. GREETING or CASUAL CHAT
   Triggers: "hi", "hello", "hey", "good morning", "merhaba", "what's up", small talk
   Response: Short greeting in your character voice + brief mention of your mandate
   + one open question like "What would you like to do?"
   DO NOT propose a trade. DO NOT suggest a deposit. Just engage conversationally.

2. ANALYSIS or MARKET OPINION REQUEST
   Triggers: "what do you think about ETH", "should I long BTC", "market view",
   "ETH analizi", "ne öneriyorsun", "is now a good time"
   Response: Brief analysis in your character voice using LIVE DATA prices and
   24h change. Give your opinion based on your character's risk profile.
   End with "but the call is yours" or similar — never pressure the user.
   DO NOT generate a PROPOSAL. This is opinion only.

3. TRADE REQUEST WITH SIZE SPECIFIED
   Triggers: "open $5 ETH long", "long 100 USDC BTC", "short ETH $50", clear size
   Logic:
   - If USER_VAULT_BALANCE_USD >= requested_size: generate PROPOSAL with the
     EXACT size the user asked for. Never adjust the size.
   - If USER_VAULT_BALANCE_USD > 0 but < requested_size: explain the situation
     clearly. "You have $X in the vault, but you're asking for $Y. Either deposit
     more or reduce the size." DO NOT auto-shrink. DO NOT propose a partial trade.
     Let the user decide.
   - If USER_VAULT_BALANCE_USD < 0.01 (effectively zero): tell the user they need
     to deposit first. "You haven't deposited to the vault yet. Head to the Vault
     page to fund your position."

4. TRADE REQUEST WITHOUT SIZE
   Triggers: "open ETH long", "long BTC", "go short", no number mentioned
   Response: Ask for size in your character voice.
   - APOLLO: "What size would you like? Suggest something conservative — ${char.sizeGuidance}."
   - ATLAS: "Size? ${char.sizeGuidance}."
   - ARES: "${char.sizeGuidance}."

5. CLOSE / EXIT POSITION
   Triggers: "close my position", "exit ETH", "close all", "kapat"
   Response: Generate appropriate close instruction.

=== STRATEGY CONSTRAINTS ===
If the user requests something against your strategy's constraints, explain and
ask for an adjusted request — do not silently change it.

- APOLLO: rejects short requests, rejects leverage > 3x. Say "I trade longs only
  with max 3x leverage. Would you like to long instead, or switch to ATLAS/ARES?"
- ATLAS: rejects leverage > 5x. Say "5x is my maximum. Would you like to reduce
  the leverage, or switch to ARES for higher?"
- ARES: rejects leverage > 10x. Say "10x is the system maximum."

=== PROPOSAL FORMAT ===
When you generate a PROPOSAL (intent #3 with sufficient balance), append exactly
ONE of these at the end of your response:
[PROPOSAL: {"action":"deposit","amount_usdc":100,"reasoning":"brief reason"}]
[PROPOSAL: {"action":"withdraw","amount_usdc":50,"reasoning":"brief reason"}]
[PROPOSAL: {"action":"change_strategy","strategy":"ARES","reasoning":"brief reason"}]
[PROPOSAL: {"action":"open_position","asset":"ETH","direction":"long","size_usdc":200,"leverage":3,"reasoning":"brief reason"}]
[PROPOSAL: {"action":"open_position","asset":"BTC","direction":"short","size_usdc":150,"leverage":5,"reasoning":"brief reason"}]
[PROPOSAL: {"action":"close_position","asset":"ETH","reasoning":"brief reason"}]

=== CRITICAL RULES ===
- USER SIZE IS NON-NEGOTIABLE: if the user specifies a size in intent #3 and
  the vault balance is sufficient, propose EXACTLY that size. Never round up,
  round down, or suggest a different size based on your own preferences.
- NEVER silently change trade parameters. Always be explicit if you're rejecting
  or asking for adjustment.
- Length by intent: greetings and trade requests → 1-2 short sentences.
  Analysis/market opinion → 3-5 sentences max. Never write long paragraphs.
  Proposals use the structured format.
`
}

async function callOpenRouter(messages, onDelta, attempt = 1) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://arcana-hermes.vercel.app",
        "X-Title": "ARCANA",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        temperature: 0.15,
        top_p: 0.85,
        repetition_penalty: 1.15,
        stream: true,
        messages,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    if ((res.status === 429 || res.status >= 500) && attempt === 1) {
      await new Promise(r => setTimeout(r, 1000))
      return callOpenRouter(messages, onDelta, 2)
    }
    if (!res.ok) {
      const errText = await res.text()
      return { error: `Model error ${res.status}: ${errText.slice(0, 200)}` }
    }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    let fullContent = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue
        try {
          const chunk = JSON.parse(raw)
          const delta = chunk.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            fullContent += delta
            onDelta(delta)
          }
        } catch {}
      }
    }
    return { fullContent }
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === "AbortError" && attempt === 1) {
      await new Promise(r => setTimeout(r, 1000))
      return callOpenRouter(messages, onDelta, 2)
    }
    return { error: "Service temporarily unavailable. Please try again." }
  }
}

app.post("/api/advisor", async (req, res) => {
  const { messages, userAddress, strategy } = req.body
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  try {
    send({ type: "tool_call", name: "read_vault_state" })

    const [vaultData, prices] = await Promise.all([fetchVaultState(userAddress), fetchPrices()])

    const history = [
      { role: "system", content: buildSystemPrompt(vaultData.text, prices, strategy, vaultData.userBalance) },
      ...(messages || []).map((m) => ({ role: m.role, content: m.content })),
    ]

    const data = await callOpenRouter(history, (delta) => {
      send({ type: "delta", content: delta })
    })

    if (data.error) {
      send({ type: "error", message: data.error })
      res.write("data: [DONE]\n\n")
      res.end()
      return
    }

    const fullContent = data.fullContent ?? ''
    const proposalMatch = fullContent.match(/\[PROPOSAL:\s*(\{[\s\S]*?\})\]/)
    const cleanText = fullContent.replace(/\[PROPOSAL:[\s\S]*?\]/g, "").trim()

    if (cleanText) send({ type: "text", content: cleanText })
    if (proposalMatch) {
      try { send({ type: "proposal", ...JSON.parse(proposalMatch[1]) }) } catch {}
    }

  } catch (err) {
    send({ type: "error", message: err.message ?? "Unknown error" })
  }

  res.write("data: [DONE]\n\n")
  res.end()
})

app.get("/health", (_, res) => res.json({ status: "ok", model: MODEL, vault: VAULT_ADDRESS }))
app.listen(PORT, () => console.log(`ARCANA API — Hermes 3 70B — port ${PORT}`))
