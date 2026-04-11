# Quick Prompt for Claude Code

Copy and paste this into Claude Code. It's focused, backend-only, and production-ready.

---

## The Prompt (Copy This)

```
Build a production-ready Node.js/Express backend API with TypeScript.

**Stack**:
- Express.js
- Vercel AI SDK (for Claude, GPT, Llama)
- Solana (native SOL, devnet/mainnet)
- MagicBlock Private Payments
- x402 payment protocol

**Core Endpoints** (Backend API Only, No Frontend):

1. **POST /api/chat** (Main endpoint)
   - Header: x-payment (base64 transaction signature)
   - Body: { prompt, model?, consumer_wallet? }
   - Process:
     a) Verify x402 payment (native SOL transaction on Solana)
     b) Route to cheapest AI provider (Claude, GPT, Llama via Vercel AI SDK)
     c) Settle privately via MagicBlock (80% to API key holder, 20% platform)
     d) Return response + payment receipt + settlement signature
   - Response: { response, model, tokens, receipt: { paymentSignature, settlementSignature, ... } }

2. **POST /api/keys/register**
   - Register API key for staking
   - Input: { apiKey, ownerWallet, model?, dailyRequestLimit? }
   - Response: { keyHash, status }

3. **GET /api/keys/:keyHash/earnings**
   - Check earnings for API key
   - Response: { totalEarnings, requestCount, isActive, ... }

4. **GET /api/providers** - List AI providers + status
5. **GET /api/models** - List available models
6. **GET /api/analytics** - Platform analytics (requests, costs, etc)
7. **GET /health** - Health check

**x402 Payment Verification (Native SOL)**:
- Decode x-payment header to get transaction signature
- Fetch transaction from Solana RPC
- Parse SOL transfer instruction
- Verify: amount (0.01 SOL), recipient (platform wallet), confirmed on-chain
- Prevent replay attacks (cache processed signatures)
- Return { valid, payer, amount, transactionSignature }

**Vercel AI SDK Integration**:
- Import from @ai-sdk/anthropic (Claude)
- Import from @ai-sdk/openai (GPT-4)
- Import from @ai-sdk/togetherai (Llama, Mistral)
- Route to cheapest provider based on cost/token
- Track usage: promptTokens, completionTokens, cost
- Support streaming responses

**MagicBlock Private Settlement**:
- After successful AI response
- Call MagicBlock Private Payments API
- Transfer 0.0008 SOL to API key holder (80%)
- Transfer 0.0002 SOL to platform (20%)
- Settlement happens privately (no on-chain link between payer and recipient)
- Auto-settle to Solana via MagicBlock crank

**API Key Staking**:
- Store API keys encrypted (never plaintext, store only hash)
- Track totalEarnings per key (incremented by 80% of each request cost)
- Enforce daily rate limits (default 1000 requests/day)
- Support withdrawal (simple transfer to user wallet)

**Environment Variables**:
- PORT=3000
- SOLANA_RPC=https://api.devnet.solana.com
- SOLANA_NETWORK=devnet
- PLATFORM_WALLET=(your wallet address)
- X402_PAYMENT_AMOUNT_LAMPORTS=10000000 (0.01 SOL)
- ANTHROPIC_API_KEY=(from Anthropic)
- OPENAI_API_KEY=(from OpenAI)
- TOGETHER_API_KEY=(from Together.ai)
- MAGICBLOCK_API_KEY=(from MagicBlock)
- MAGICBLOCK_NETWORK=mainnet

**Data Storage** (MVP: in-memory):
- apiKeyPool: Map<keyHash, { ownerWallet, totalEarnings, requestCount, ... }>
- requestHistory: Array<{ requestId, consumerId, providerId, cost, ... }>
- processedSignatures: Set<signature> (for replay attack prevention)

**Error Handling**:
- 402 Payment Required (if x-payment header missing or verification fails)
- 400 Bad Request (missing fields)
- 503 Service Unavailable (no API keys available, all providers down)
- 500 Internal Server Error (with details)

**Logging**:
- Log x402 payment verifications (success/failure)
- Log AI provider routing decisions
- Log MagicBlock settlements
- Log errors with stack traces

**Project Structure**:
src/
  server.ts                    (main Express app)
  x402PaymentVerifier.ts       (Solana payment verification)
  magicBlockPayments.ts        (MagicBlock integration)
  aiProviders.ts               (Vercel AI SDK setup)
  services/
    paymentService.ts          (orchestration)
    aiService.ts               (routing logic)
    keyManagementService.ts    (staking)

package.json with:
- express
- typescript
- @solana/web3.js
- ai
- @ai-sdk/anthropic
- @ai-sdk/openai
- @ai-sdk/togetherai
- @magicblock-labs/private-payments
- bs58

**Requirements**:
- All endpoints documented with request/response examples
- All environment variables in .env.example
- Error handling for all edge cases
- Comments explaining key logic
- Ready for deployment to Vercel/Railway
- Production-ready code (not prototype)

Create:
1. Complete server.ts with all endpoints
2. x402PaymentVerifier.ts (verify native SOL transactions)
3. magicBlockPayments.ts (private settlement)
4. aiProviders.ts (Vercel AI SDK integration)
5. services/* (business logic)
6. package.json
7. .env.example
8. README with API documentation

Backend only. No frontend. Focus on API endpoints, payment verification, and AI routing.
```

---

## How to Use This

1. **Copy the prompt above**
2. **Open Claude Code**
3. **Paste into message**
4. **Claude will generate:**
   - Complete backend with all endpoints
   - x402 payment verification (native SOL)
   - MagicBlock integration
   - Vercel AI SDK setup
   - Error handling
   - Ready to deploy

5. **Get the files:**
   - src/server.ts
   - src/x402PaymentVerifier.ts
   - src/magicBlockPayments.ts
   - src/aiProviders.ts
   - src/services/*
   - package.json
   - .env.example

---

## After Claude Code Generates

1. Copy files to your project
2. Run `npm install`
3. Add API keys to `.env`
4. `npm run dev` to test
5. Deploy to Vercel/Railway

---

## What You'll Get

✅ Backend API (Express)
✅ x402 verification (native SOL)
✅ MagicBlock settlement (private)
✅ Multi-provider AI (Vercel SDK)
✅ API key staking system
✅ Payment receipts with signatures
✅ Error handling
✅ Ready for production

---

**That's it. Paste the prompt. Get the backend.**