# What We Built

## Plain-English Summary

We built a working end-to-end pay-before-inference flow on Solana.

The product lets a user:

1. Open the frontend.
2. Connect Phantom.
3. Choose an AI model.
4. Enter a prompt.
5. Receive a payment quote from the backend.
6. Sign a SOL transfer locally in the browser.
7. Send the signed transaction to the backend for verification.
8. Get the AI response only after payment passes verification.

That is the actual implemented product today.

There is now also an experimental private-payment variant using Umbra.

## Core Architecture

### Frontend: `apps/web`

The frontend is a Next.js app that handles the client side of the x402-style payment flow.

It currently does these jobs:

- Checks backend health on load.
- Connects to Phantom through the injected `window.solana` provider.
- Lets the user choose one of four hardcoded model ids.
- Sends an initial request to the backend without payment.
- Receives a `402 Payment Required` response with `receiver`, `amountLamports`, and `memo`.
- Builds a native SOL transfer transaction against Solana devnet.
- Uses Phantom to sign the transaction locally.
- Serializes the signed transaction to base64.
- Re-sends the request with the signed transaction in the `x402-signed-tx` header.
- Displays the returned AI output and paid transaction signature.

### Backend: `apps/backend`

The backend is an Express server with one main business endpoint:

- `GET /health`
- `POST /premium`

The `/premium` route currently does this:

1. Validates `prompt` and `model` with Zod.
2. Finds the matching model entry from the in-memory store.
3. Reads the owner wallet and price in lamports for that model.
4. If the `x402-signed-tx` header is missing, returns HTTP `402` with a payment quote.
5. If the header exists, verifies the signed transaction contents.
6. Submits the transaction to Solana if it has not already landed.
7. Confirms the transaction and checks that the expected receiver actually received the funds.
8. Calls the selected AI provider with the stored API key.
9. Returns `{ paidTxSignature, ai }`.

If `paymentMethod` is `"umbra"`, the route instead:

1. Issues a private quote with a unique `quoteId`.
2. Expects the browser to create a receiver-claimable Umbra UTXO to the platform wallet.
3. Scans the platform wallet's claimable UTXOs for a matching amount and destination.
4. Marks the matched leaf as consumed in memory.
5. Returns the AI output only after that match is found.

## Models Wired Into The Product

These are the real model ids used by the frontend and backend right now:

| Model id | Provider | Actual model call |
| --- | --- | --- |
| `gpt-3.5-turbo` | OpenAI | `gpt-3.5-turbo` |
| `groq` | Groq | `llama-3.3-70b-versatile` |
| `gemini-2` | Google | `gemini-2.0-flash` |
| `gemini-2.5-pro` | Google | `gemini-2.5-pro` |

Each model is mapped in the backend to:

- an API key
- an owner wallet
- a `rate_per_request` value in lamports

That mapping currently lives in memory inside `apps/backend/src/db/prisma.ts`.

## Payment Flow Details

The payment flow is quote-first, then signed-transaction verification.

### Step 1: Quote

Client sends:

```json
{
  "model": "groq",
  "prompt": "Summarize the Solana runtime"
}
```

Backend returns HTTP `402`:

```json
{
  "message": "Payment required",
  "paymentRequest": {
    "receiver": "wallet-address",
    "amountLamports": 1000000,
    "memo": "payment for model:groq"
  }
}
```

### Step 2: Browser Signing

The frontend creates a `SystemProgram.transfer(...)` transaction using:

- payer = connected Phantom wallet
- receiver = backend quote receiver
- lamports = backend quote amount
- RPC = Solana devnet

Then it signs with Phantom and serializes the full signed transaction to base64.

### Step 3: Paid Request

The frontend re-sends the same request body with:

```text
x402-signed-tx: <base64 signed transaction>
```

### Step 4: Backend Verification

The backend:

- deserializes the signed transaction
- checks for a valid SOL transfer instruction
- checks the expected receiver
- checks the amount is at least the quoted lamports
- derives the transaction signature from the signed bytes
- submits the transaction if needed
- confirms it on-chain
- fetches the confirmed transaction
- verifies the receiver's balance delta

Only after that does it call the model.

## What Is Good About This Build

- The payment gate is real, not simulated in the browser.
- Signing happens in the user wallet, not on the server.
- The server verifies actual transaction content before model execution.
- The backend checks on-chain confirmation and post-transaction balance change.
- The product already demonstrates the essential x402-style UX: pay first, then compute.
- The private path now demonstrates a real Umbra-integrated pay-before-inference flow with viewing-key disclosure in the frontend.

## What Is Not In The Current Build

These items are not part of the working implementation right now, even if older docs implied otherwise:

- No `/api/chat`, `/api/models`, `/api/providers`, `/api/analytics`, or key-registration API.
- No live MagicBlock settlement flow.
- No revenue splitting or key-holder earnings logic in the active request path.
- No persisted API-key marketplace.
- No PostgreSQL-backed model lookup in the active code path.
- No automatic provider fallback or pricing-based routing.
- The Umbra payment matcher is still an MVP implementation built around scanning claimable UTXOs and consuming matches in memory.

## Database Status

There is a Prisma schema for an `ApiKey` table in `apps/backend/prisma/schema.prisma`, but the active backend logic is not using Prisma queries right now.

Instead, the app uses an in-memory object that acts like a temporary registry. That means:

- changes require a backend restart
- nothing persists across deployments or process restarts
- pricing and owners are configured in code plus environment variables

## Environment Variables That Matter

The backend currently depends on:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
DEFAULT_OWNER=YourSolanaWalletAddress
OPENAI_API_KEY=
groq_API_KEY=
GOOGLE_API_KEY=
GOOGLE_API_KEY2=
```

Meaning:

- `OPENAI_API_KEY` powers `gpt-3.5-turbo`
- `groq_API_KEY` powers `groq`
- `GOOGLE_API_KEY` powers `gemini-2.5-pro`
- `GOOGLE_API_KEY2` powers `gemini-2`

The frontend also reads:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
```

## Apps In The Monorepo

### `apps/backend`

Implemented and active.

### `apps/web`

Implemented and active.

### `apps/admin`

Present, but currently scaffold/default and not part of the working product flow.

### `apps/docs`

Present, but currently scaffold/default and not part of the working product flow.

## Final Product Definition

The cleanest description of what we built is:

AgentX402 is a Solana-based pay-per-prompt AI app where the browser requests a quote, pays with a signed SOL transfer, the backend verifies that payment on-chain, and only then returns AI output from the chosen model.
