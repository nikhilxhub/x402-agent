# AgentX402

AgentX402 is a Solana x402-style pay-per-request AI app in a Turborepo monorepo.

The current implementation has:

- A Next.js frontend in `apps/web` that connects to Phantom, requests a payment quote, signs a SOL transfer locally, and re-submits the signed transaction to the backend.
- An Express backend in `apps/backend` that returns a `402 Payment Required` quote, verifies the signed transaction, submits it to Solana devnet if needed, and then calls the selected AI model.
- A simple in-memory model registry that maps each supported model to an owner wallet, API key, and per-request lamport price.
- An experimental Umbra private-payment path that creates receiver-claimable UTXOs in the browser and verifies them server-side by scanning for matching claimable UTXOs addressed to the platform wallet.

## What Is Actually Implemented

This repo is not currently a generic AI marketplace or multi-route gateway. The working flow is narrower and concrete:

1. The frontend sends `POST /premium` with `model` and `prompt`.
2. The backend looks up that model in its local in-memory store.
3. If no signed payment is attached, the backend responds with HTTP `402` and a payment quote.
4. The frontend builds a native SOL transfer transaction in the browser and signs it with Phantom.
5. The frontend sends the signed transaction back in the `x402-signed-tx` header.
6. The backend verifies the transfer instructions, submits the transaction when necessary, confirms it on devnet, checks receiver balance change, and only then calls the AI provider.
7. The backend returns the AI text plus the paid transaction signature.

There is also an experimental private flow:

1. The frontend sends `POST /premium` with `paymentMethod: "umbra"`.
2. The backend returns a private quote with a unique `quoteId`, Umbra mint metadata, and a unique atomic amount.
3. The browser creates an Umbra receiver-claimable UTXO addressed to the platform wallet.
4. The frontend re-submits the request with `x402-quote-id`.
5. The backend scans for a matching unconsumed claimable UTXO and only then releases the AI response.

## Supported Models

The current UI and backend support these model ids:

| Model id | Provider | Backend adapter |
| --- | --- | --- |
| `gpt-3.5-turbo` | OpenAI | `@ai-sdk/openai` |
| `groq` | Groq | `@ai-sdk/groq` using `llama-3.3-70b-versatile` |
| `gemini-2` | Google | `@ai-sdk/google` using `gemini-2.0-flash` |
| `gemini-2.5-pro` | Google | `@ai-sdk/google` using `gemini-2.5-pro` |

## Repo Layout

```text
apps/
  backend/   Express + TypeScript API
  web/       Next.js frontend for wallet + payment + prompt flow
  admin/     default scaffold, not part of the implemented flow
  docs/      default scaffold, not part of the implemented flow
packages/
  ui/
  eslint-config/
  typescript-config/
```

## Backend API

### `GET /health`

Returns:

```json
{ "ok": true }
```

### `POST /premium`

Request body:

```json
{
  "model": "gemini-2",
  "prompt": "Explain Solana accounts simply"
}
```

First response when no payment is attached:

```json
{
  "message": "Payment required",
  "paymentRequest": {
    "receiver": "wallet-address",
    "amountLamports": 1000000,
    "memo": "payment for model:gemini-2"
  }
}
```

Final paid request uses header:

```text
x402-signed-tx: <base64 serialized signed transaction>
```

Success response:

```json
{
  "paidTxSignature": "solana-signature",
  "ai": "model output text"
}
```

## Required Backend Environment Variables

Create `apps/backend/.env`.

Minimum useful variables:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
DEFAULT_OWNER=YourSolanaWalletAddress

OPENAI_API_KEY=
groq_API_KEY=
GOOGLE_API_KEY=
GOOGLE_API_KEY2=
UMBRA_PLATFORM_PRIVATE_KEY=
UMBRA_NETWORK=devnet
UMBRA_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
UMBRA_INDEXER_API_ENDPOINT=https://utxo-indexer.api.umbraprivacy.com
UMBRA_TREE_INDEX=0
```

Notes:

- `GOOGLE_API_KEY` is used for `gemini-2.5-pro`.
- `GOOGLE_API_KEY2` is used for `gemini-2`.
- `groq_API_KEY` is lowercase in the current backend code.
- If a model is selected but its mapped API key is missing, the request will fail at runtime.
- `UMBRA_PLATFORM_PRIVATE_KEY` is only required for the private Umbra path. It should be the platform wallet secret in base58 or JSON-array form.

## Run The Project

Install dependencies:

```sh
pnpm install
```

Run the backend:

```sh
pnpm --filter backend dev
```

Run the frontend:

```sh
pnpm --filter web dev
```

Default local ports:

- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3002`

Frontend backend base URL:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

## Frontend Flow

The web app in `apps/web` currently provides:

- Phantom wallet connect
- Backend health check
- Model picker
- Prompt input
- Payment quote display in lamports/SOL
- Local transaction signing
- Final AI response view with paid transaction signature

The frontend is hardcoded to Solana devnet via `clusterApiUrl("devnet")`.

## Important Current Limitations

- Model pricing and ownership are not fetched from a database; they come from an in-memory object in `apps/backend/src/db/prisma.ts`.
- The Prisma schema exists, but the live code path does not currently query PostgreSQL.
- The backend only exposes `/premium` and `/health`.
- There is no provider auto-fallback, analytics API, earnings API, key registration API, or MagicBlock settlement in the current request flow.
- The Umbra path currently verifies by scanning for a matching claimable UTXO. It is suitable for an MVP/demo flow, but it is not yet hardened for high-concurrency production settlement.
- The frontend currently targets Phantom-compatible wallet injection and assumes browser signing.

## Tech Stack

- Monorepo: Turborepo + pnpm
- Frontend: Next.js 16, React 19, Tailwind CSS
- Backend: Express 5, TypeScript
- Solana: `@solana/web3.js`
- AI SDKs: Vercel AI SDK with OpenAI, Groq, and Google adapters
