# AgentX402

A **pay-per-prompt AI gateway** built on the x402 payment protocol. Users pay SOL on Solana per request, and the backend routes prompts to multiple AI providers (Claude, GPT-4o, Gemini, Llama). Payments are settled privately through MagicBlock's TEE layer.

---

## Before You Start — API Keys You Need

Copy `apps/backend/.env.example` to `apps/backend/.env` and fill in the keys below.

```sh
cp apps/backend/.env.example apps/backend/.env
```

---

## 1. Google Generative AI (Gemini) — FREE tier available

**Variable:** `GOOGLE_GENERATIVE_AI_API_KEY`

**What it does:** Powers Gemini 2.5 Pro, Gemini 2.5 Flash, and Gemini 2.0 Flash in this project.

**Good news: Google gives free API keys.** Gemini has a generous free tier (requests per minute limit, but no billing required to start).

**How to get it:**
1. Go to **https://aistudio.google.com**
2. Sign in with your Google account
3. Click **"Get API key"** in the left sidebar
4. Click **"Create API key"** → choose a project (or create a new one)
5. Copy the key — it starts with `AIza...`

Paste it as:
```
GOOGLE_GENERATIVE_AI_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxxxxxx
```

> The free tier is enough to test the project. If you hit rate limits, go to Google Cloud Console and enable billing to get higher limits.

---

## 2. OpenAI (GPT-4o) — NOT free, requires payment

**Variable:** `OPENAI_API_KEY`

**What it does:** Powers GPT-4o and GPT-4o Mini models.

**OpenAI does NOT have a free tier anymore.** You must add a payment method and purchase credits. The minimum top-up is $5. New accounts sometimes (not always) get a small free credit — do not rely on it.

**How to get it:**
1. Go to **https://platform.openai.com**
2. Sign up or log in
3. Go to **Settings → Billing** and add a payment method
4. Purchase at least **$5** of credits
5. Go to **API Keys** (https://platform.openai.com/api-keys)
6. Click **"Create new secret key"**
7. Copy the key immediately — it starts with `sk-...` and is shown only once

Paste it as:
```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> If you want to skip OpenAI for now, just leave the key blank. The backend will still work with other providers — the `LOAD_BALANCING_STRATEGY=cheapest` setting will automatically route to cheaper models.

---

## 3. Anthropic (Claude) — your $20 plan does NOT include API access

**Variable:** `ANTHROPIC_API_KEY`

**Important:** The **Claude.ai Pro ($20/month) subscription** is for the **website chat** only. It does NOT give you API access. The API is a separate product with separate billing.

**You need to create an API account separately:**
1. Go to **https://console.anthropic.com**
2. Sign up (can use the same email as your Claude.ai account)
3. Go to **Billing** and add a payment method
4. Purchase API credits — minimum is usually **$5**
5. Go to **API Keys** → **Create Key**
6. Copy the key — it starts with `sk-ant-...`

Paste it as:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Claude Sonnet 4.6 and Claude Opus 4 are the models used here. Sonnet is much cheaper per token. If you want to minimize API costs during testing, you can comment out the Opus model in `apps/backend/src/aiProviders.ts`.

---

## 4. Together AI (Llama 3.3 70B) — FREE $1 credit on signup

**Variable:** `TOGETHER_API_KEY`

**What it does:** Routes prompts to open-source models like Meta's Llama 3.3 70B — the cheapest option in this project at $0.00088 per 1K tokens.

**Together AI gives free credits on signup.** New accounts get $1 free credit, which is enough for thousands of test requests with Llama.

**How to get it:**
1. Go to **https://api.together.ai**
2. Sign up with email or GitHub
3. Go to **Settings → API Keys**
4. Click **"Create API Key"**
5. Copy the key

Paste it as:
```
TOGETHER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Together AI is great for development and testing because it is the cheapest provider in this project and gives free credits. Start here if you want to test without spending money.

---

## 5. MagicBlock — OPTIONAL, for private on-chain payments

**Variable:** `PLATFORM_WALLET_PRIVATE_KEY`

### What is MagicBlock?

MagicBlock is a **privacy layer for Solana payments**. It uses a TEE (Trusted Execution Environment — a secure chip-level enclave) to process USDC transfers without creating a visible on-chain link between sender and recipient.

### Why is it used here?

In AgentX402, when a user pays SOL for an AI request, the backend splits that payment:
- **80%** goes to the API key holder (the person who registered their key)
- **20%** stays with the platform wallet (you, the operator)

Without MagicBlock, these splits happen as normal on-chain transfers — anyone can see the payment graph on a Solana explorer. With MagicBlock's private USDC transfers, the redistribution is settled privately.

### No API key needed

**MagicBlock's Payments API requires no API key.** Authentication is handled entirely by wallet signatures on the transactions it returns. See the official reference: https://payments.magicblock.app/reference

### How it works

The backend calls MagicBlock's `/v1/spl/transfer` endpoint, which returns an **unsigned transaction**. The backend then signs that transaction with the platform wallet's private key and submits it to Solana (or MagicBlock's ephemeral RPC).

This means to enable real on-chain settlement you need:
1. The platform wallet's private key (base58-encoded) in `PLATFORM_WALLET_PRIVATE_KEY`
2. USDC in that wallet for the transfers

### Is it required?

**No. MagicBlock is optional.** If you do not set `PLATFORM_WALLET_PRIVATE_KEY`, the backend automatically falls back to **"simulated settlement"** — payment splits are logged but not executed on-chain. This is fine for development and testing.

```
# Leave blank for simulated mode during development:
PLATFORM_WALLET_PRIVATE_KEY=
```

### How to export your platform wallet's private key

Your platform wallet is the Solana wallet you set in `PLATFORM_WALLET`. To get its private key:

- **Phantom wallet:** Settings → Security & Privacy → Export Private Key → enter password → copy the base58 key
- **Solana CLI:** `solana-keygen show --outfile /dev/stdout` or check your keypair JSON file

> **WARNING:** Keep `PLATFORM_WALLET_PRIVATE_KEY` secret. Never commit it to git. It is already in `.gitignore` via `.env`.

> **Recommendation:** Leave `PLATFORM_WALLET_PRIVATE_KEY` empty while building and testing. The simulated settlement mode logs all the payment splits correctly — you just will not see them on-chain. Add the real key when you are ready to go to production.

---

## Quick Setup Summary

| Key | Free? | Priority |
|-----|-------|----------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes, free tier at aistudio.google.com | Get this first |
| `TOGETHER_API_KEY` | $1 free credit at api.together.ai | Get this second |
| `OPENAI_API_KEY` | No, minimum $5 at platform.openai.com | Optional |
| `ANTHROPIC_API_KEY` | No, separate from Claude.ai Pro — console.anthropic.com | Optional |
| `PLATFORM_WALLET_PRIVATE_KEY` | No key needed — export from your own wallet | Leave blank for dev |

**Minimum to get started:** You only need ONE AI provider key. Start with Google (free) or Together AI ($1 credit). The backend will route all requests to whichever providers have valid keys.

---

## Other Environment Variables

```env
# Your Solana wallet address — this is where platform fees go
PLATFORM_WALLET=YourSolanaWalletAddressHere

# How much SOL users must pay per request (in lamports)
# 10,000,000 lamports = 0.01 SOL
X402_PAYMENT_AMOUNT_LAMPORTS=10000000

# "cheapest" routes to lowest cost model, "round-robin" cycles through all
LOAD_BALANCING_STRATEGY=cheapest

# Use devnet for testing (free SOL from faucet), mainnet for production
SOLANA_NETWORK=devnet
SOLANA_RPC=https://api.devnet.solana.com
```

To get devnet SOL for testing: https://faucet.solana.com — paste your wallet address and request free test SOL.

---

## Running the Backend

```sh
# Install dependencies
pnpm install

# Start the backend in development mode
pnpm --filter backend dev

# Or from the backend directory:
cd apps/backend
pnpm dev
```

The server starts on `http://localhost:3000`. Check it with:
```sh
curl http://localhost:3000/health
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server status and config |
| POST | `/api/chat` | Pay-per-prompt — requires `x-payment` header |
| GET | `/api/models` | List all available AI models |
| GET | `/api/providers` | List all AI providers and status |
| GET | `/api/analytics` | Request and cost analytics |
| POST | `/api/keys/register` | Register an API key to earn from requests |
| GET | `/api/keys/:keyHash/earnings` | Check earnings for a key |
