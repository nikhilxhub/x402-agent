# Superteam Grant Application Draft

## Project Name

**AgentX402**

## One-Line Summary

AgentX402 is a Solana-native agentic product built using `solana.new` with Claude/Codex: users pay in SOL through the x402 flow, submit a prompt, and receive an AI response without accounts, subscriptions, or off-chain billing.

## Short Pitch

I am building **AgentX402**, a Solana-native pay-per-prompt AI gateway. The core idea is simple: instead of forcing users to create accounts, buy subscriptions, or manage credit cards just to access AI features, AgentX402 lets them pay a small amount of **SOL per request** and get an instant AI response.

The product uses **Solana** for payment verification, **x402** as the payment-required request pattern, and a lightweight frontend that lets a user connect their wallet, sign a payment transaction, submit a prompt, and receive a response. Behind the scenes, the backend verifies the payment on-chain, routes the prompt to the best available AI model, and returns a receipt.

This fits the current moment perfectly. The cost of building software has collapsed because AI coding tools can compress weeks of engineering work into days. I am already building inside an agentic workflow using `solana.new` with Claude/Codex, and I want to use this grant to scale that workflow up so I can finish, harden, and ship a working Solana product during the Frontier window.

## Why This Fits The Agentic Engineering Grant

This application is not just about a Solana product. It is also about how I build it.

I am already using an **agentic engineering workflow** with `solana.new` plus Claude/Codex to move from:

**idea -> prompt -> production**

That workflow is especially powerful for a project like AgentX402 because the product spans multiple moving parts:

- Solana wallet interactions
- on-chain payment verification
- backend API design
- AI provider orchestration
- frontend product UX
- deployment and debugging across the stack

Using Claude/Codex inside `solana.new` lets me iterate faster on all of those layers. Instead of treating AI as a chatbot for one-off code generation, I am using it as an engineering copilot for architecture, implementation, debugging, refactoring, and shipping.

The point of this grant, for me, is to **upscale that agentic engineering loop**:

- faster iteration cycles
- better code quality
- more ambitious execution within the same time window
- tighter shipping velocity during Frontier

## The Problem

Most AI products still use a Web2 billing model:

- users create accounts
- users subscribe before they even know if they need the product
- developers need Stripe, auth, pricing plans, invoicing, and account recovery
- bots, agents, and power users cannot pay for usage in a native machine-to-machine way

That is a bad fit for crypto-native users and an even worse fit for autonomous software.

If someone wants to pay for one query, one action, one model call, or one API request, they should be able to do that directly with a wallet. This is especially relevant on Solana, where transactions are fast and cheap enough to support real micro-payments.

## The Solution

AgentX402 is a **pay-per-use AI gateway on Solana**.

The flow is:

1. A user opens the app and connects a Solana wallet.
2. The app fetches the backend payment requirements.
3. The user enters a prompt and signs a SOL transfer.
4. The client attaches the transaction signature in the `x-payment` header.
5. The backend verifies the payment on Solana.
6. The backend routes the prompt to an available AI provider.
7. The user gets the model response plus a payment receipt.

The product removes the usual friction:

- no sign-up
- no subscription
- no credit card
- no pre-funded platform balance
- no manual invoicing

It becomes: **pay with SOL, send a prompt, get a result**.

## Why This Matters on Solana

Solana is the right chain for this because the experience depends on cheap and fast transactions. AgentX402 is not just "AI with a wallet button." The Solana integration is part of the core product logic:

- payment is made in native **SOL**
- payment proof is verified on-chain using `@solana/web3.js`
- request processing depends on valid payment confirmation
- the product is designed around an HTTP `402 Payment Required` style workflow using x402
- the frontend uses a Solana wallet flow instead of a Web2 checkout flow

This means Solana is not a decorative add-on. It is the payment rail that makes the product work.

## What Is Already Built

I already have a working codebase for the core system. The current implementation includes:

- a **Node.js + Express + TypeScript backend**
- Solana payment verification with `@solana/web3.js`
- a main `POST /api/chat` endpoint that requires an `x-payment` header
- support for multiple AI providers and models through the Vercel AI SDK
- model routing and provider fallback logic
- a minimal **Next.js frontend** where a user can connect a wallet, sign a transfer, submit a prompt, and receive the response
- analytics and provider/model listing endpoints
- a receipt flow that shows payment details after a successful request

There is also an extended marketplace-style concept already started in the repo where third-party API key providers can register keys and earn from usage, with settlement logic designed around MagicBlock.

## Current Repo Direction

The product vision is broader than a simple demo. I see AgentX402 becoming a base payment layer for:

- pay-per-prompt AI apps
- crypto-native AI agents
- bots that need to buy inference on demand
- marketplaces where model access can be monetized per request

The immediate goal for Frontier is not to ship every long-term feature. The immediate goal is to ship a focused, working MVP that proves the core loop:

**wallet payment -> verified on-chain -> AI response returned**

## MVP Scope for the Grant

The MVP I want to submit during Frontier will focus on a practical, shippable version of AgentX402 with the following scope:

### Core Product

- wallet-connected frontend
- prompt input and model selection
- SOL payment transaction from the client
- backend x402 payment verification
- AI response generation after payment confirmation
- request receipt showing payment and model metadata

### Solana Integration

- native SOL payment flow
- wallet signing from the frontend
- on-chain verification through Solana RPC
- clear display of payment amount and recipient

### Product Quality

- cleaner frontend UX for payment and response states
- error handling for failed wallet signatures, insufficient funds, and invalid payment headers
- deployment of the backend and frontend to a live URL
- end-to-end testing on devnet, with the option to move to mainnet-ready configuration after validation

### Hackathon Submission Readiness

- public demo URL
- GitHub repository
- clear README and documentation
- working demo flow suitable for Colosseum judging

## What Still Needs to Be Shipped

To be fully honest, there are still some gaps between the current codebase and a polished hackathon-ready product:

- persistence is still limited in parts of the backend
- some marketplace/payment-settlement logic is still closer to prototype quality than final production quality
- the frontend is functional but still minimal
- deployment and final end-to-end QA need to be completed
- some edge cases need to be hardened around replay protection, payment confirmation, and fallback behavior

That is exactly why this grant matters. The build is real already, but the remaining work is the difference between "interesting repo" and "shipped product."

## How I Will Use AI Coding Tools

I want to use the grant to cover a month of top-tier AI coding tools that will accelerate execution in a very specific way inside `solana.new` with Claude/Codex:

- generate and refine backend boilerplate faster
- harden API routes and validation
- speed up frontend iteration for wallet UX and payment-state handling
- debug integration issues across Solana wallet flows, RPC calls, and AI provider routing
- improve docs, test coverage, deployment setup, and product polish
- move faster on repetitive engineering tasks so I can spend more time on product decisions and shipping

In other words, I am not using AI tools as a substitute for having an idea. I am using them as force multiplication to ship the idea faster and at a higher quality level within the hackathon window.

More specifically, I am using the agentic workflow for:

- turning product requirements into implementation plans
- generating and revising code across frontend and backend modules
- tracing bugs across wallet, RPC, and API boundaries
- accelerating documentation, test scaffolding, and deployment preparation
- keeping momentum high enough to actually ship, not just prototype

## Why This Project Is Shippable

This is not a vague concept-stage application. It is already anchored by a working repo and a concrete implementation path.

Why I believe it is realistic to ship within the grant window:

- the core architecture is already defined
- the backend payment and routing model already exists
- the frontend payment flow is already started
- the remaining work is focused on polish, reliability, deployment, and tightening the MVP
- the scope can be kept deliberately narrow around one powerful user story

That user story is:

**As a user, I can connect a Solana wallet, pay a small amount of SOL, send a prompt, and get an AI response immediately.**

If that is live, the project succeeds as an MVP.

## Planned Build Timeline

### Week 1

- finalize MVP scope
- harden backend validation and payment checks
- clean up environment configuration and docs

### Week 2

- improve frontend UX and wallet/payment states
- test full pay-request-response flow repeatedly on devnet
- fix edge cases and improve error handling

### Week 3

- deploy frontend and backend
- produce demo assets and submission-ready documentation
- validate the live product end to end

### Week 4

- polish remaining issues
- submit to the Colosseum Frontier hackathon
- prepare grant tranche completion materials

## Long-Term Vision

The long-term vision for AgentX402 is bigger than a single app.

I want it to evolve into infrastructure for paid AI actions on Solana:

- AI endpoints that can be monetized per call
- wallet-native billing for software agents
- composable paid APIs for consumer and developer use cases
- potentially a marketplace where builders can contribute model access or compute and earn from usage

But the right approach is to start with a strong wedge: one working product with one clean loop and one clear reason to exist.

That wedge is AgentX402.

## Why I Am Applying for This Grant

I am applying because this grant is aligned with exactly how I want to build:

- focused scope
- fast iteration
- real shipping pressure
- Solana-native utility
- strong leverage from AI coding tools

The Frontier window creates the right forcing function. I already have the base implementation and a clear direction. What I need now is to compress the build cycle, close the remaining gaps, and ship a polished MVP before the hackathon deadline.

This grant would directly increase the probability that AgentX402 goes from a strong prototype to a live Solana product.

## Submission-Friendly Summary

AgentX402 is a Solana-native pay-per-prompt AI gateway built around the x402 payment flow. Instead of subscriptions or credit cards, users pay a small amount of SOL per request, submit a prompt, and receive an AI response. The backend verifies the payment on-chain, routes the request to an available AI model, and returns a receipt. I am building it using an agentic engineering workflow in `solana.new` with Claude/Codex, and this grant would help me scale that workflow up to finish, harden, deploy, and submit a working MVP during the Frontier hackathon window.

## Short Version for Form Fields

I am building **AgentX402**, a Solana-native pay-per-prompt AI gateway, using `solana.new` with Claude/Codex as my agentic engineering workflow. Users connect their wallet, pay in SOL per request, submit a prompt, and receive an AI response without subscriptions or traditional billing. The backend verifies payments on-chain using Solana, processes requests through an x402-style payment flow, routes prompts to AI providers, and returns a receipt. I already have a working codebase for the core system, and this grant would help me upscale my agentic engineering workflow so I can polish, debug, deploy, and ship a live MVP during the Frontier window.

## Goals And Milestones

Before the deadline, I plan to hit the following goals and milestones for AgentX402:

1. Complete the end-to-end MVP flow so a user can connect a Solana wallet, pay in SOL, submit a prompt, and receive an AI response.
2. Harden the x402 payment flow by improving payment verification, replay protection, request validation, and error handling.
3. Improve the frontend UX so the payment flow is clear and reliable, including wallet connection, payment status, confirmation states, and receipt display.
4. Deploy the product to a live public URL with a working backend and frontend.
5. Test the full flow repeatedly on Solana devnet and fix blocking issues before submission.
6. Prepare a clean hackathon submission package with a GitHub repo, demo link, documentation, and product explanation.

Milestone breakdown:

1. Milestone 1: Stable core flow
The backend verifies payment correctly, the frontend can initiate payment from a wallet, and successful requests return model output plus receipt data.

2. Milestone 2: Product hardening
The app handles common failure cases cleanly, including rejected wallet signatures, invalid payment headers, RPC confirmation failures, and unavailable AI providers.

3. Milestone 3: Live deployment
AgentX402 is deployed and usable from a public URL, with environment configuration and documentation ready for reviewers.

4. Milestone 4: Final submission
The project is submitted to the Colosseum Frontier hackathon with a working demo, repository, and supporting documentation.

## Primary KPI

The primary KPI is:

**Number of successful end-to-end paid prompt completions on the live product**

This is the most important metric because it captures the full value of the project in one number. A successful paid prompt completion means:

- the wallet flow worked
- the SOL payment was made successfully
- the payment was verified on-chain
- the backend processed the prompt
- the user received a response

For this MVP, success means proving that the full Solana-native pay-per-prompt loop works reliably in production-like conditions.

## Superteam Prompt Response

If I were answering the prompt `help me apply for the agentic engineering grant by Superteam` inside a Claude/Codex session on `solana.new`, my response would be:

I am applying for the Superteam Agentic Engineering Grant to build **AgentX402**, a Solana-native pay-per-prompt AI gateway. The product uses the x402 payment flow so that a user can connect a wallet, pay in SOL for a request, send a prompt, and receive an AI response without subscriptions or traditional Web2 billing. The core Solana integration is not cosmetic: payment is made in native SOL, verified on-chain, and required before the backend processes the request.

I am already building this through an agentic engineering workflow using `solana.new` with Claude/Codex. That workflow helps me move much faster across backend architecture, frontend wallet UX, Solana payment verification, AI provider integrations, debugging, and deployment. Instead of using AI tools for one-off code generation, I am using them as a continuous engineering layer to turn product requirements into implementation, fixes, and shipped features.

This grant would help me upscale that workflow during the Frontier build window. I already have the core repository and product direction in place; the remaining work is to harden the MVP, improve the user experience, deploy it, and submit a polished live product. My goal is to ship a focused Solana product that proves a simple loop: pay with SOL, send a prompt, and get an AI response.

## Links To Add Before Submission

- Demo URL: `ADD_LIVE_URL_HERE`
- GitHub Repo: `ADD_GITHUB_URL_HERE`
- Hackathon Submission URL: `ADD_COLOSSEUM_URL_HERE`
- Contact / X / Telegram: `ADD_CONTACT_HERE`
