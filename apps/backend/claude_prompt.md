# Claude Code Prompt: Backend API with MagicBlock, x402 & Vercel AI SDK

## Project: Pay-Per-Prompt AI Backend

Build a production-ready backend API (Node.js/Express) that:
1. Verifies x402 payments (native SOL on Solana)
2. Routes to multiple AI providers via Vercel AI SDK
3. Settles payments privately via MagicBlock
4. Manages API key staking & earnings

**No frontend. Backend only.**

---

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **AI Integration**: Vercel AI SDK (`ai` package)
- **Payment Verification**: x402 (native SOL)
- **Private Settlement**: MagicBlock Private Payments API
- **Blockchain**: Solana (devnet/mainnet)
- **Language**: TypeScript

---

## Core Functionality

### 1. x402 Payment Verification (Native SOL)

**Endpoint**: `POST /api/chat` with `x-payment` header

**Input**:
- `x-payment` header: base64-encoded transaction signature (from client wallet)
- Body: `{ prompt, model, consumer_wallet }`

**Process**:
1. Decode x-payment header to get transaction signature
2. Fetch transaction from Solana RPC using signature
3. Verify it's a valid SOL transfer to platform wallet
4. Check amount (0.01 SOL = 10,000,000 lamports)
5. Verify confirmed on-chain
6. Prevent replay attacks (cache processed signatures)

**Output**: `{ valid: true, payer, amount, transactionSignature }`

### 2. Multi-Provider AI via Vercel AI SDK

**Supported Providers** (via Vercel AI SDK):
- Claude (Anthropic)
- GPT-4 (OpenAI)
- Llama (Together.ai)
- Any Vercel AI SDK supported model

**Process**:
1. Route to cheapest provider (load balancing by cost)
2. Stream response if available
3. Track token usage and cost
4. Support model selection from client

### 3. MagicBlock Private Settlement

**Process** (after AI response):
1. Call MagicBlock Private Payments API
2. Route 0.0008 SOL to API key holder (80%)
3. Route 0.0002 SOL to platform (20%)
4. Settlement happens privately (no on-chain link)
5. Auto-settle via MagicBlock crank to Solana

### 4. API Key Staking System

**Endpoints**:
- `POST /api/keys/register` - Register API key
- `GET /api/keys/:keyHash/earnings` - Check earnings
- `POST /api/keys/:keyHash/withdraw` - Withdraw earnings

**Process**:
- Store API keys encrypted (never plaintext)
- Track earnings per key
- Manage daily rate limits
- Support withdrawals (public or private via Umbra later)

---

## API Endpoints

### Primary

**POST /api/chat**
```
Headers: { "x-payment": "base64_transaction_signature" }
Body: { 
  "prompt": "What is Solana?",
  "model": "claude-opus-4-20250514",  // optional, defaults to cheapest
  "consumer_wallet": "7yxq..."         // optional
}

Response: {
  "response": "AI response text...",
  "model": "claude-opus-4-20250514",
  "tokens": { "prompt": 12, "completion": 145, "total": 157 },
  "receipt": {
    "requestId": "uuid",
    "paymentSignature": "39ixR...",
    "paymentAmount": 10000000,
    "paymentStatus": "verified",
    "settlementSignature": "magic_block_tx",
    "settlementMethod": "magicblock-tee",
    "apiKeyOwner": "wallet",
    "apiKeyEarnings": 0.0008,
    "platformFee": 0.0002,
    "timestamp": "2025-04-11T..."
  }
}
```

### Key Management

**POST /api/keys/register**
```
Body: {
  "apiKey": "sk-ant-xxxxx",
  "ownerWallet": "7yxq...",
  "model": "claude",
  "dailyRequestLimit": 1000
}

Response: { "keyHash": "a1b2c3...", "status": "active" }
```

**GET /api/keys/:keyHash/earnings**
```
Response: {
  "keyHash": "a1b2c3...",
  "ownerWallet": "7yxq...",
  "totalEarnings": "1250000000",
  "requestCount": 15678,
  "isActive": true,
  "createdAt": "2025-04-10T..."
}
```

### System

**GET /api/providers**
```
Response: [{
  "id": "claude",
  "enabled": true,
  "latency": 125,
  "pricing": { "input": 0.003, "output": 0.015 },
  "tags": ["premium", "accurate"]
}]
```

**GET /api/models**
```
Response: [{
  "name": "claude-opus-4-20250514",
  "provider": "claude",
  "costPerK": { "input": 0.003, "output": 0.015 }
}]
```

**GET /api/analytics**
```
Response: {
  "totalRequests": 1523,
  "totalCost": 3.45,
  "averageCostPerRequest": 0.00226,
  "byProvider": { "claude": 450, "gpt": 890 },
  "x402Stats": { "processedPayments": 1523 }
}
```

**GET /health**
```
Response: {
  "status": "ok",
  "x402Enabled": true,
  "paymentToken": "SOL",
  "requiredAmount": 10000000,
  "magicblockEnabled": true,
  "network": "devnet"
}
```

---

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# Solana
SOLANA_RPC=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
PLATFORM_WALLET=YourPlatformWalletAddress

# x402 Payment
X402_PAYMENT_AMOUNT_LAMPORTS=10000000    # 0.01 SOL

# AI Providers (Vercel AI SDK)
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
TOGETHER_API_KEY=xxxxx

# MagicBlock
MAGICBLOCK_API_KEY=your_api_key
MAGICBLOCK_NETWORK=mainnet

# Database/Caching (optional for MVP)
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

---

## Project Structure

```
src/
├── server.ts                    # Express app + main endpoints
├── x402PaymentVerifier.ts       # Verify native SOL transactions
├── magicBlockPayments.ts        # MagicBlock private settlement
├── aiProviders.ts               # Vercel AI SDK integration
├── services/
│   ├── paymentService.ts        # Payment orchestration
│   ├── aiService.ts             # AI routing logic
│   └── keyManagementService.ts  # API key staking
└── utils/
    ├── logger.ts
    ├── errorHandler.ts
    └── cache.ts                 # Simple in-memory for MVP

.env.example
package.json
tsconfig.json
```

---

## Key Implementation Details

### 1. x402 Verification Flow

```typescript
// 1. Parse X-PAYMENT header (base64 transaction signature)
const signature = Buffer.from(xPaymentHeader, "base64").toString("utf8");

// 2. Fetch from Solana RPC
const tx = await connection.getTransaction(signature, { commitment: "confirmed" });

// 3. Extract SOL transfer instruction from parsed transaction
// 4. Verify: amount, recipient, confirmation status
// 5. Check replay attacks (seen before?)
// 6. Return { valid: true, payer, amount, transactionSignature }
```

### 2. Vercel AI SDK Integration

```typescript
// Import from Vercel AI SDK
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";      // Claude
import { openai } from "@ai-sdk/openai";            // GPT
import { togetherAi } from "@ai-sdk/togetherai";    // Llama, Mistral

// Usage
const { text, usage } = await generateText({
  model: selectedModel,  // e.g., anthropic.messages.create
  prompt: userPrompt,
  temperature: 0.7,
  maxTokens: 2048
});

// Track: usage.promptTokens, usage.completionTokens
```

### 3. MagicBlock Settlement

```typescript
// After AI response succeeds
const settlement = await magicblock.privateTransfer({
  from: consumerWallet,
  to: apiKeyHolderWallet,
  amount: "0.0008",  // 80% of 0.001 SOL
  splits: [{
    recipient: platformWallet,
    amount: "0.0002"  // 20%
  }]
});

// No on-chain link between payer and recipient
```

### 4. API Key Staking

```typescript
// Store encrypted hash (never plaintext)
const keyHash = hash(apiKey);

// Track: totalEarnings, requestCount, dailyLimit
// Each successful request increments earnings:
key.totalEarnings += costInUSDC * 0.8;
key.requestCount += 1;
```

---

## Error Handling

1. **Payment Failed** → 402 Payment Required
2. **Invalid Signature** → 402 with details
3. **No API Keys** → 503 Service Unavailable
4. **AI Provider Down** → 503 (auto-failover to next)
5. **MagicBlock Error** → 500 (log for monitoring)

---

## Load Balancing Strategy

- **Default**: Lowest cost (minimize AI expenses)
- **Alternative**: Round-robin, lowest latency, highest reliability
- **Configurable**: Via `LOAD_BALANCING_STRATEGY` env var

---

## Monitoring & Logging

Track:
- x402 payment verifications (success/failure)
- AI provider usage (tokens, cost, latency)
- MagicBlock settlements (success/failure)
- API key earnings (total, daily)
- Error rates and types

Log to console for MVP, can add structured logging later.

---

## Testing

```bash
# 1. Start server
npm run dev

# 2. Test health
curl http://localhost:3000/health

# 3. Test payment verification (devnet)
# - Create SOL transfer via Phantom
# - Get transaction signature
# - Send as x-payment header with prompt
curl -X POST http://localhost:3000/api/chat \
  -H "x-payment: base64_signature" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is AI?"}'

# 4. Check analytics
curl http://localhost:3000/api/analytics
```

---

## Security Considerations

1. **API Keys**: Hash before storing (never plaintext)
2. **x402**: Check for replay attacks (signature cache)
3. **Rate Limiting**: Per-key daily request limits
4. **CORS**: Restrict to frontend domain
5. **Logging**: Don't log sensitive data

---

## Optional Enhancements (Phase 2+)

- PostgreSQL for persistence (instead of in-memory)
- Redis for session caching & rate limiting
- Webhook notifications for settlements
- Umbra integration for private withdrawals
- DAO governance for fee changes
- Smart contract on Solana for on-chain accounting

---

## Success Criteria

✅ Payment verification works (x402 with native SOL)
✅ Routes to multiple AI providers (via Vercel AI SDK)
✅ MagicBlock settlement settles payments privately
✅ API key staking tracks earnings correctly
✅ All endpoints return proper receipts
✅ Handles errors gracefully
✅ Logs important events

---

## Deliverables

1. **src/server.ts** - Main Express app with all endpoints
2. **src/x402PaymentVerifier.ts** - x402 verification logic
3. **src/magicBlockPayments.ts** - MagicBlock integration
4. **src/aiProviders.ts** - Vercel AI SDK setup
5. **src/services/** - Business logic (payment, AI, keys)
6. **.env.example** - All configuration variables
7. **package.json** - Dependencies
8. **README.md** - API documentation

---

## Notes

- **Frontend**: Not included (only backend)
- **Database**: In-memory Map for MVP (add PostgreSQL later)
- **Caching**: Simple Set for replay attack prevention
- **Payments**: Native SOL, not USDC (can add USDC later)
- **Settlement**: Automatic via MagicBlock crank
- **Logging**: Console output for development

---

**Build this backend. It's production-ready. **