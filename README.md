# Agentx402

A high-performance, private AI agent platform powered by Solana and Umbra. This monorepo implements a 402 Payment Required flow for AI model inference, supporting both standard Solana transactions and private Umbra payments.

## Architecture Overview

This project is structured as a Turborepo monorepo for seamless full-stack development.

- **Frontend (apps/web)**: A modern Next.js single-page application that handles wallet connections, payment flows, and AI interactions.
- **Backend (apps/backend)**: An Express.js service that manages model dispatch, payment verification, and quote generation.
- **Shared Config (packages/*)**: Shared TypeScript, ESLint, and styling configurations.

## Tech Stack

- **Frontend**: Next.js, Solana Wallet Adapter, Umbra SDK, Tailwind CSS.
- **Backend**: Node.js, Express, Zod (Validation), Solana Web3.js.
- **Payments**: 
  - **Standard**: Direct SOL transfers on Solana Devnet.
  - **Umbra**: Stealth-address based private payments using UTXO proofs.
- **AI Models**:
  - OpenAI (gpt-3.5-turbo)
  - Groq (llama-3.3-70b-versatile)
  - Google Gemini (gemini-2.5-pro, gemini-2.0-flash)

## Core Features

### 1. Dual-Mode Payments (HTTP 402 Flow)
The agent utilizes a "402 Payment Required" architecture:
- **Standard Flow**: Frontend signs a direct SOL transfer. Backend verifies the transaction signature on-chain before processing the AI request.
- **Umbra Private Flow**: Frontend creates a private UTXO payment. Backend verifies the Umbra transaction proofs and viewing keys before granting access to the model.

### 2. Model Dispatcher
A centralized AI service that routes requests to various providers (OpenAI, Groq, Google) based on user selection and payment confirmation.

### 3. Real-time Payment Verification
Robust backend services for checking Solana transaction status and Umbra payment validity, ensuring zero-latency access once funds are confirmed.

## Project Structure

```text
.
├── apps
│   ├── web          # Next.js frontend
│   └── backend      # Express.js API
├── packages
│   ├── eslint-config # Shared linting rules
│   └── typescript-config # Shared TS configurations
├── turbo.json       # Monorepo pipeline configuration
└── package.json     # Root dependencies and scripts
```

## Important Notes

- **Database**: While a Prisma schema exists in apps/backend/prisma/schema.prisma, the current runtime uses an in-memory, environment-backed configuration for model keys and pricing (defined in apps/backend/src/db/prisma.ts).
- **Solana Network**: Currently configured for Devnet testing.
- **Redundant Code**: Note that apps/backend/src/controllers/premiumRouter.ts is a legacy implementation. The active router is located in apps/backend/src/routes/premiumRouter.ts.

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Configure .env files in both apps/web and apps/backend using the provided samples.

3. **Run Development Mode**:
   ```bash
   npm run dev
   ```

---
Built with intensity by the x402 team.
