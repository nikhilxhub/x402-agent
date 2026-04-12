# What We Built — x402-umbra

---

## The Two Business Models — What's Actually Built

x402 can work in two different ways for monetization. Both are implemented in this codebase.

---

### Model 1 — Platform Owns the API Keys (Operator Model)

**How it works:** You (the platform owner) put your own AI provider API keys directly in the backend `.env` file. Every user request uses your keys. You keep 100% of the SOL payment minus Solana transaction fees.

**What's built for this:**

- `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TOGETHER_API_KEY` — these go in your `.env` and are loaded directly by `aiProviders.ts` at server startup
- `aiService.ts` picks the cheapest/next available model from your pool and calls it using the Vercel AI SDK
- If one of your keys fails (rate limit, quota), the router silently tries the next provider
- You receive 100% of the SOL payment into `PLATFORM_WALLET`

**This is the default mode.** If you just fill in the `.env` keys and deploy, you're running Model 1. No key registration needed.

---

### Model 2 — Users Register Their Own API Keys and Get Paid (Marketplace Model)

**How it works:** Third-party developers (not you) can submit their own AI provider API keys to your platform via an API endpoint. They link those keys to their Solana wallet. Whenever any paying user's request is routed through their key, they earn **80% of that payment in SOL**. You (the platform) keep the other **20%**.

**What's built for this:**

- `POST /api/keys/register` — anyone calls this with their `apiKey` + `ownerWallet`. The backend hashes the key (SHA-256), stores it in the in-memory pool, and links it to their wallet. The raw key is never stored, only used at request time.
- `keyManagementService.ts` — manages the pool of registered keys. Tracks per-key daily request limits (default 1000/day, resets UTC midnight), total earnings in lamports (BigInt to avoid float issues), and active/inactive status.
- `selectApiKey(model?)` — when a paid `/api/chat` request comes in, the backend checks the registered key pool first. It picks the first active key that matches the requested model and is under its daily limit.
- `recordEarnings(keyHash, lamports)` — after each successful AI call, updates the key's `totalEarnings` and request counters.
- `magicBlockPayments.ts` — after a successful response, settles the payment split: 80% → key holder wallet, 20% → platform wallet. Done via MagicBlock's private USDC transfer (or simulated if `PLATFORM_WALLET_PRIVATE_KEY` is not set).
- `GET /api/keys/:keyHash/earnings` — key holders can check their earnings, request count, and daily usage anytime.

**The actual flow for Model 2:**

```
1. Developer registers their OpenAI key → links it to their Solana wallet
2. A user pays 0.01 SOL and sends a prompt to /api/chat
3. Backend verifies the Solana payment (x402PaymentVerifier.ts)
4. Backend picks the registered key from the pool (selectApiKey)
5. Calls OpenAI with the developer's key
6. Returns AI response to the user
7. Settles: 0.008 SOL → developer's wallet, 0.002 SOL → platform wallet (via MagicBlock)
8. Developer checks /api/keys/:keyHash/earnings to see their earnings
```

---

### What's NOT Done Yet (honest gaps)

- **Key pool is in-memory** — registered keys vanish on server restart. No database yet. `keyManagementService.ts` has a comment: "Replace with PostgreSQL for persistence."
- **Settlement is USDC, payment is SOL** — users pay in native SOL (simple), but internal settlement to key holders goes through MagicBlock as USDC at a 1:1 rate (not a real oracle). In production, you'd need a SOL/USDC price feed.
- **No key holder authentication** — anyone who knows your key can register it. There's no signature-based proof that you own the wallet you're linking to.
- **Simulated settlement by default** — MagicBlock settlement only runs if `PLATFORM_WALLET_PRIVATE_KEY` is set. Otherwise it logs the split but doesn't move real funds.

---

## The Big Idea

**x402-umbra is a pay-per-prompt AI gateway that runs on Solana.**

Instead of signing up, creating accounts, or managing subscriptions — users just send a small amount of SOL and get an AI response back. No accounts. No passwords. No billing portal. Just a wallet, a payment, and a prompt.

Think of it like a vending machine for AI. You put in a coin (SOL), you get an answer.

The backend supports 8 AI models across 4 providers (Claude, GPT-4o, Gemini, Llama) and automatically routes each request to the best available model. Payments are split between the platform operator and API key holders using MagicBlock's private settlement layer.

---

## Tech Stack

| Layer | What |
|-------|------|
| Backend | Node.js + Express + TypeScript |
| Monorepo | Turborepo + pnpm |
| Solana | `@solana/web3.js` — payment verification |
| AI | Vercel AI SDK — unified interface for all providers |
| Settlement | MagicBlock Private Payments API |
| Payment Protocol | x402 — HTTP 402 "Payment Required" standard |

---

## The x402 Payment Protocol

x402 is a standard for machine-to-machine payments built on HTTP. It works like this:

1. Client makes a request **without** a payment → server returns `HTTP 402 Payment Required`
2. Client reads the 402 response, sends the required SOL to the platform wallet on Solana
3. Client puts the **transaction signature** (base64 encoded) in the `x-payment` header
4. Client re-sends the request with that header
5. Server verifies the payment on-chain and processes the request

This is what the `x-payment` header is for in every `/api/chat` request. It's the "proof you paid" that the backend checks before touching any AI provider.

---

## Folder Structure

```
x402-umbra/
├── apps/
│   ├── backend/          ← the Express API server (main thing we built)
│   │   └── src/
│   │       ├── index.ts                    ← Express app, all routes
│   │       ├── aiProviders.ts              ← model definitions + Vercel AI SDK calls
│   │       ├── magicBlockPayments.ts       ← MagicBlock settlement integration
│   │       ├── x402PaymentVerifier.ts      ← on-chain payment verification
│   │       ├── services/
│   │       │   ├── aiService.ts            ← load balancing + provider routing
│   │       │   ├── paymentService.ts       ← orchestrates the full request flow
│   │       │   └── keyManagementService.ts ← API key registry + earnings tracking
│   │       └── utils/
│   │           ├── logger.ts
│   │           ├── errorHandler.ts
│   │           └── cache.ts                ← replay attack prevention (TimedSet)
│   ├── web/              ← Next.js frontend (Turborepo default, not modified yet)
│   └── docs/             ← Next.js docs app (Turborepo default, not modified yet)
└── packages/             ← shared ESLint + TypeScript configs
```

---

## All API Endpoints

### `GET /health`
**What it does:** Health check. Returns server status and config.

**No payment needed.**

```json
// Response
{
  "status": "ok",
  "x402Enabled": true,
  "paymentToken": "SOL",
  "requiredAmount": 10000000,
  "magicblockEnabled": false,
  "network": "devnet",
  "uptime": 42.3
}
```

`requiredAmount` is in lamports. 10,000,000 lamports = 0.01 SOL.

---

### `POST /api/chat` — the main endpoint
**What it does:** Takes a prompt, verifies a Solana payment, calls an AI model, returns the response.

**Requires `x-payment` header** (base64 of your Solana transaction signature).

```json
// Request body
{
  "prompt": "Explain black holes in simple words",
  "model": "gemini-2.0-flash",        // optional, picks cheapest if omitted
  "consumer_wallet": "YourWallet..."  // optional, for receipt tracking
}

// Headers
x-payment: <base64 encoded Solana tx signature>
```

```json
// Response
{
  "response": "Black holes are regions of space...",
  "model": "gemini-2.0-flash",
  "tokens": { "prompt": 12, "completion": 180, "total": 192 },
  "receipt": {
    "requestId": "uuid-here",
    "paymentSignature": "solana-tx-sig",
    "paymentAmount": 10000000,
    "paymentStatus": "verified",
    "settlementSignature": "sim_1234_abc",
    "settlementMethod": "simulated",
    "apiKeyOwner": "wallet-address",
    "apiKeyEarnings": 0.008,
    "platformFee": 0.002,
    "timestamp": "2026-04-12T..."
  }
}
```

If no `x-payment` header is sent, returns `HTTP 402` with instructions on how much to pay and where.

---

### `GET /api/models`
**What it does:** Lists all 8 AI models with their pricing.

```json
// Response (array)
[
  { "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "name": "Llama 3.3 70B", "provider": "together", "costPerK": { "input": 0.00088, "output": 0.00088 } },
  { "id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "provider": "google", "costPerK": { "input": 0.0001, "output": 0.0004 } },
  ...
]
```

---

### `GET /api/providers`
**What it does:** Lists all AI providers and which models they have.

```json
// Response (array)
[
  { "id": "together", "enabled": true, "models": ["meta-llama/..."], "tags": ["open-source", "cheap"] },
  { "id": "google",   "enabled": true, "models": ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"], "tags": [] },
  ...
]
```

---

### `POST /api/keys/register`
**What it does:** Register an AI provider key and link it to a Solana wallet. Once registered, whenever any user pays for a request that uses your key, you earn 80% of that payment.

```json
// Request body
{
  "apiKey": "sk-ant-your-anthropic-key",
  "ownerWallet": "YourSolanaWalletAddress",
  "model": "claude-sonnet-4-6",   // optional, "any" if omitted
  "dailyRequestLimit": 500         // optional, default 1000
}

// Response
{
  "keyHash": "sha256-hash-of-key",
  "status": "active"
}
```

The actual API key is never stored — only its SHA-256 hash. The key is used at request time to make AI calls.

---

### `GET /api/keys/:keyHash/earnings`
**What it does:** Check how much a registered key has earned.

```json
// Response
{
  "keyHash": "abc123...",
  "ownerWallet": "SolanaWallet...",
  "totalEarnings": "8000000",    // in lamports (as string, BigInt safe)
  "requestCount": 12,
  "dailyRequestCount": 3,
  "dailyRequestLimit": 1000,
  "isActive": true,
  "createdAt": "2026-04-12T..."
}
```

---

### `GET /api/analytics`
**What it does:** Platform-wide stats — total requests, cost, breakdown by provider, recent request log.

```json
// Response
{
  "totalRequests": 42,
  "totalCostUsd": 0.000312,
  "averageCostPerRequest": 0.0000074,
  "byProvider": { "together": 30, "google": 10, "claude": 2 },
  "x402Stats": { "processedPayments": 42 },
  "recentRequests": [ ... ]
}
```

---

## Full User Flow (step by step)

```
User                          Backend                        Solana / AI
 |                               |                               |
 |-- POST /api/chat (no header) →|                               |
 |← 402 Payment Required --------|                               |
 |   "send 0.01 SOL to wallet X" |                               |
 |                               |                               |
 |-- send 0.01 SOL on Solana ----|------------→ tx confirmed --→ |
 |                               |                               |
 |-- POST /api/chat              |                               |
 |   x-payment: <base64 sig> --→ |                               |
 |                               |                               |
 |                               |-- fetch tx from RPC --------→ |
 |                               |← tx verified (payer, amount) -|
 |                               |                               |
 |                               |-- pick AI key from pool       |
 |                               |-- route to best model         |
 |                               |-- call AI provider ----------→ |
 |                               |← AI response ------------------|
 |                               |                               |
 |                               |-- settle payment (MagicBlock) |
 |                               |   80% → key holder wallet     |
 |                               |   20% → platform wallet       |
 |                               |                               |
 |← { response, receipt } -------|                               |
```

---

## How Payment Verification Works (`x402PaymentVerifier.ts`)

When the backend gets an `x-payment` header it does this:

1. **Decode** the base64 header → get the Solana transaction signature string
2. **Replay attack check** — if this signature was already used in the last 24 hours, reject it. This prevents someone from copying a valid payment and reusing it.
3. **Fetch the transaction** from Solana RPC (`getParsedTransaction`)
4. **Find the SOL transfer** — scan the transaction instructions for a transfer to the platform wallet
5. **Check the amount** — must be ≥ `X402_PAYMENT_AMOUNT_LAMPORTS` (default 0.01 SOL)
6. **Mark as used** — add the signature to the in-memory `TimedSet` with 24h TTL
7. **Return** the payer wallet address and amount

If any step fails → `HTTP 402` or `HTTP 400` error with a clear message.

---

## How AI Routing Works (`aiService.ts` + `aiProviders.ts`)

**8 models registered across 4 providers:**

| Model | Provider | Input $/1K | Output $/1K |
|-------|----------|-----------|------------|
| Claude Opus 4 | Anthropic | $0.015 | $0.075 |
| Claude Sonnet 4.6 | Anthropic | $0.003 | $0.015 |
| GPT-4o | OpenAI | $0.005 | $0.015 |
| GPT-4o Mini | OpenAI | $0.00015 | $0.0006 |
| Gemini 2.5 Pro | Google | $0.00125 | $0.010 |
| Gemini 2.5 Flash | Google | $0.0003125 | $0.0025 |
| Gemini 2.0 Flash | Google | $0.0001 | $0.0004 |
| Llama 3.3 70B | Together.ai | $0.00088 | $0.00088 |

**Load balancing strategies** (set via `LOAD_BALANCING_STRATEGY` env var):
- `cheapest` (default) — sorts all models by combined token cost, picks the cheapest one first. If it fails, tries the next, and so on.
- `round-robin` — cycles through all models in order.

**Automatic fallback** — if a provider throws an error (bad API key, rate limit, downtime), the router silently tries the next model. The request only fails if ALL providers fail.

All models are called through the **Vercel AI SDK** (`generateText`), which normalizes the interface across all providers.

---

## How the API Key Economy Works (`keyManagementService.ts`)

This is the incentive layer. Here's the idea:

- Anyone can register their AI provider key (OpenAI, Anthropic, etc.) and link it to their Solana wallet
- When the platform gets a paid request, it picks an available registered key from the pool to make the AI call
- The key holder earns **80% of the payment** in SOL, the platform keeps **20%**
- Earnings are tracked in lamports (BigInt to avoid float precision issues)
- Each key has a **daily request limit** (default: 1000/day, resets at UTC midnight)
- The actual key string is never stored — only a SHA-256 hash

**Pool selection logic:** picks the first active key that matches the requested model (or any model) and hasn't hit its daily limit.

This creates an open marketplace where people provide AI API capacity and earn SOL for doing so.

---

## MagicBlock Integration (`magicBlockPayments.ts`)

### What MagicBlock is

MagicBlock is a privacy layer for Solana. It lets you send SPL tokens (USDC) between wallets without creating a visible link between sender and recipient on-chain. It uses a TEE (Trusted Execution Environment — a secure chip inside a server) to process transfers privately.

### What it does here

After a user pays and gets their AI response, the backend needs to split that payment:
- **80%** → the API key holder's wallet
- **20%** → the platform wallet (you, the operator)

Without MagicBlock, this split happens as a normal Solana transaction — visible to anyone on a block explorer. With MagicBlock, the redistribution is private.

### How the API actually works (no API key needed)

MagicBlock's Payments API (`https://payments.magicblock.app`) requires **zero API key**. It's an open HTTP API. You just call it.

The flow:

```
Backend                     MagicBlock API              Solana
  |                               |                        |
  |-- POST /v1/spl/transfer ---→  |                        |
  |   { from, to, amount,         |                        |
  |     mint, visibility:private} |                        |
  |                               |                        |
  |← { transactionBase64,  -----  |                        |
  |    sendTo: "ephemeral" }       |                        |
  |                               |                        |
  | [sign tx with platform        |                        |
  |  wallet private key]          |                        |
  |                               |                        |
  |-- submit signed tx --------------------------------→   |
  |← { signature } -------------------------------------------
```

1. Backend calls MagicBlock with `from` (platform wallet), `to` (key holder wallet), amount, and `visibility: "private"`
2. MagicBlock returns an **unsigned transaction** as base64
3. Backend deserializes it using `@solana/web3.js`
4. Backend signs it with the platform wallet's private key (`PLATFORM_WALLET_PRIVATE_KEY`)
5. Backend submits it to either:
   - Regular Solana RPC (if `sendTo === "base"`)
   - MagicBlock's TEE RPC / `devnet-tee.magicblock.app` (if `sendTo === "ephemeral"`)

### MagicBlock on devnet

Yes, devnet is fully supported. Set `MAGICBLOCK_NETWORK=devnet` and the API automatically uses:
- Devnet USDC mint: `4zMMC9srt5Ri5X14YQuhg8UTZMMzDdKhmkZMECCzk57`
- Ephemeral RPC: `https://devnet-tee.magicblock.app`

### What if PLATFORM_WALLET_PRIVATE_KEY is not set?

The backend falls back to **simulated settlement** — it logs the split (who earns what) but doesn't execute any on-chain transfer. This is the default for development. The receipt you get back still shows the amounts, just with `"settlementMethod": "simulated"`.

---

## Environment Variables Quick Reference

```env
# Server
PORT=3000
CORS_ORIGIN=*

# Solana
SOLANA_RPC=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PLATFORM_WALLET=<your Solana wallet address — receives payments>
X402_PAYMENT_AMOUNT_LAMPORTS=10000000   # 0.01 SOL per request

# AI Providers (at least one required)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...    # free tier available
TOGETHER_API_KEY=...                    # $1 free credit on signup
OPENAI_API_KEY=sk-...                   # paid only
ANTHROPIC_API_KEY=sk-ant-...            # paid only (separate from claude.ai)

# Load balancing
LOAD_BALANCING_STRATEGY=cheapest        # or "round-robin"

# MagicBlock (optional — leave blank for simulated settlement in dev)
PLATFORM_WALLET_PRIVATE_KEY=            # base58 private key for signing settlements
MAGICBLOCK_NETWORK=devnet               # or "mainnet"
```

---

## Key Design Decisions

**Why x402?** It's a machine-to-machine payment protocol. No login, no session, no API key for the end user. Just send SOL, get a response. Works perfectly for on-chain AI agents or bots that need to pay for services programmatically.

**Why SHA-256 hash the API keys?** So a database leak doesn't expose real API keys. The hash is enough to track earnings and look up the owner — you never need the raw key for that.

**Why BigInt for earnings?** SOL amounts in lamports can be large integers. JavaScript floats lose precision above 53 bits. Using `BigInt` for lamport accounting means earnings are always exact.

**Why Vercel AI SDK?** One interface for all providers. If a provider changes their API, only the SDK needs updating. Adding a new provider is just adding one entry to `AVAILABLE_MODELS`.

**Why simulated settlement by default?** MagicBlock settlement requires a private key, USDC balance, and on-chain activity. For development and testing you just want to see the flow work without spending real money. Simulation logs everything correctly so you can verify the split logic without touching mainnet.

**Why MagicBlock uses USDC (not SOL)?** MagicBlock is an SPL token privacy layer. It works at the token account level. The x402 payment comes in as native SOL (simpler for users — everyone has SOL), and the internal settlement redistribution uses USDC via MagicBlock (private transfers).
