# AgentX402 — Frontend UI/UX Specification

> **Scope of this document:** UI/UX reskin only.  
> All existing logic — x402 payment flow, Umbra private payment handling, wallet connection, on-chain verification, and AI model calls — is already implemented and must not be touched.  
> This spec covers **only** visual changes: layout, typography, colors, spacing, component appearance, and animations. Wire every new component to the exact same props, state, and handlers your current components use.

---

## ⚠ Critical Implementation Note

**Do not rewrite functionality. Do not change state management. Do not alter API calls, wallet adapters, or payment logic.**

Every component described here is a **visual replacement** for an existing component. The rule is:
- Keep the same `props`
- Keep the same `onClick`, `onChange`, `onSubmit` handlers
- Keep the same conditional rendering logic (quote appears when quote exists, status bar appears when tx is pending, etc.)
- Only change the JSX structure and Tailwind classes

If your current `QuoteBlock.tsx` receives `{ price, model, onPay }` as props, the new one receives exactly the same props — it just looks different.

---

## 1. Design Philosophy

AgentX402 is a utility product, not a consumer app. It should feel like a well-designed developer tool crossed with a premium payment terminal. Every interaction has weight — the user is signing a real transaction, paying real money, getting a real AI response. The UI earns that trust through restraint and precision.

**Core principles:**
- One surface. One font pairing. One accent (black).
- Every animation is functional, not decorative.
- The price is the hero — it gets the most visual weight.
- Incognito mode is the one dramatic moment — it earns its own visual language.
- Mobile-first, 640px max content width.

---

## 2. Tailwind Configuration

### Required additions to `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-poppins)', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'serif'],
      },
      colors: {
        // Neutral palette — the entire app lives here
        surface: '#f5f4f2',
        muted: '#888784',
        'muted-light': '#b8b6b3',

        // Incognito surfaces
        'incognito-bg':          '#111111',
        'incognito-surface':     '#1c1c1c',
        'incognito-border':      '#2e2e2e',
        'incognito-text':        '#e2e0dc',
        'incognito-muted':       '#555553',
        'incognito-btn':         '#222222',
        'incognito-btn-border':  '#333333',

        // Status — used only in status bars, never in chrome
        'status-pending-bg':    '#fef8ec',
        'status-pending-text':  '#92600a',
        'status-success-bg':    '#edf6ee',
        'status-success-text':  '#1e6b26',
        'status-error-bg':      '#fdf0ef',
        'status-error-text':    '#9e2b25',

        // Phantom-in-incognito warning (dark amber — not bright semantic yellow)
        'warn-dark-bg':   '#242010',
        'warn-dark-text': '#7a6a3a',
      },
      borderWidth: {
        'px': '0.5px',
      },
      fontSize: {
        '10': ['10px', { lineHeight: '1.4' }],
        '11': ['11px', { lineHeight: '1.5' }],
        '12': ['12px', { lineHeight: '1.5' }],
        '13': ['13px', { lineHeight: '1.6' }],
        '14': ['14px', { lineHeight: '1.75' }],
        '20': ['20px', { lineHeight: '1.2' }],
        '28': ['28px', { lineHeight: '1.1' }],
        '32': ['32px', { lineHeight: '1.1' }],
      },
      animation: {
        'pulse-dot':  'pulseDot 1.5s ease-in-out infinite',
        'slide-down': 'slideDown 180ms ease-out forwards',
        'fade-in':    'fadeIn 150ms ease-out forwards',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%':       { opacity: '0.4', transform: 'scale(0.7)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
```

### `globals.css` — minimal, fonts + typewriter only

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Instrument Serif italic — used only for price display and wordmark */
.font-serif-italic {
  font-family: var(--font-instrument-serif), serif;
  font-style: italic;
}

/* Typewriter cursor — applied to response text while streaming */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
.typewriter-cursor::after {
  content: '|';
  animation: blink 1s step-end infinite;
  margin-left: 1px;
}
```

---

## 3. Font Setup — `app/layout.tsx`

```tsx
import { Instrument_Serif, Poppins } from 'next/font/google'

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
})

const poppins = Poppins({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-poppins',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${poppins.variable}`}>
      <body className="font-sans bg-white text-[#1a1a1a] antialiased">
        {children}
      </body>
    </html>
  )
}
```

---

## 4. Typography Reference

All text is Poppins via `font-sans`. `font-serif-italic` (Instrument Serif italic) is used in **exactly two places**: the wordmark `AgentX402` and the price/quote number.

| Role | Tailwind classes |
|------|-----------------|
| Wordmark | `font-serif-italic text-20 text-[#1a1a1a]` |
| Price / Quote number | `font-serif-italic text-32 text-[#1a1a1a]` |
| Section heading | `font-sans text-base font-medium text-[#1a1a1a]` |
| Label / Button text | `font-sans text-13 font-medium` |
| Body / Description | `font-sans text-13 font-normal text-muted` |
| Metadata / Caption | `font-sans text-11 font-normal text-muted-light` |
| Uppercase tag | `font-sans text-10 font-medium uppercase tracking-widest text-muted-light` |

**Never use:** `font-semibold`, `font-bold`, `font-extrabold`. Never go below `text-10`. Always sentence case in UI labels.

---

## 5. Color Rules

The entire app uses black, white, and gray only. No brand colors. No purple, teal, or blue anywhere in chrome or buttons.

| Purpose | Tailwind class |
|---------|---------------|
| Primary text | `text-[#1a1a1a]` |
| Secondary text | `text-muted` |
| Tertiary / caption | `text-muted-light` |
| Page background | `bg-white` |
| Subtle surface / fills | `bg-surface` |
| All borders (default) | `border-px border-black/10` |
| Hover borders | `border-black/20` |
| Active chip / filled button | `bg-[#1a1a1a] text-white border-[#1a1a1a]` |

Semantic colors appear **only** inside the status bar component:

| State | Background | Text |
|-------|-----------|------|
| Pending | `bg-status-pending-bg` | `text-status-pending-text` |
| Success | `bg-status-success-bg` | `text-status-success-text` |
| Error | `bg-status-error-bg` | `text-status-error-text` |

Incognito surfaces:

| Element | Tailwind classes |
|---------|-----------------|
| Card background | `bg-incognito-bg` |
| Input / sub-surface | `bg-incognito-surface` |
| All borders | `border-incognito-border` |
| Primary text | `text-incognito-text` |
| Secondary text | `text-incognito-muted` |
| Button | `bg-incognito-btn border-px border-incognito-btn-border text-incognito-text` |

**Never use:** `backdrop-blur-*`, `backdrop-filter`, `shadow-*` (only `ring-*` for focus), `bg-gradient-*`, `from-*`, `to-*`, `via-*`.

---

## 6. Page Layout

```
┌──────────────────────────────────────────┐
│  Nav — h-12, sticky top-0, z-50          │
│  AgentX402          [wallet] [incognito] │
├──────────────────────────────────────────┤
│                                          │
│  max-w-[640px] mx-auto px-6 py-8        │
│                                          │
│  [WalletBanner]  ← always visible        │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Main card: rounded-xl border-px   │  │
│  │  p-5 space-y-6                     │  │
│  │                                    │  │
│  │  StepIndicator                     │  │
│  │  <hr />                            │  │
│  │  ModelChips                        │  │
│  │  <hr />                            │  │
│  │  PromptTextarea + submit button    │  │
│  │  <hr /> (when quote present)       │  │
│  │  QuoteBlock  ← animate-slide-down  │  │
│  │  <hr /> (when tx signed)           │  │
│  │  StatusBar   ← animate-fade-in     │  │
│  │  <hr /> (when response ready)      │  │
│  │  ResponseArea ← typewriter         │  │
│  └────────────────────────────────────┘  │
│                                          │
│  mt-8                                    │
│  PromptHistory                           │
└──────────────────────────────────────────┘
```

**`<main>` element:**
```
min-h-screen bg-white pt-12
```

**Content container:**
```
max-w-[640px] mx-auto px-6 py-8 sm:px-4
```

**Main card:** Use `cn()` to toggle incognito classes on the same element:
```tsx
<div className={cn(
  'rounded-xl border-px p-5 space-y-6',
  'transition-colors duration-[250ms] ease-in-out',
  isIncognito
    ? 'bg-incognito-bg border-incognito-border'
    : 'bg-white border-black/10'
)}>
```

**Internal dividers:**
```tsx
<hr className={cn(
  'border-t-px',
  isIncognito ? 'border-incognito-border' : 'border-black/10'
)} />
```

---

## 7. Navigation Bar

```tsx
<nav className="fixed top-0 inset-x-0 h-12 z-50 bg-white border-b border-px border-black/10">
  <div className="max-w-[640px] mx-auto h-full px-6 flex items-center justify-between">

    {/* Wordmark */}
    <span className="font-serif-italic text-20 text-[#1a1a1a] cursor-pointer select-none">
      AgentX402
    </span>

    {/* Right controls */}
    <div className="flex items-center gap-2.5">

      {/* Wallet button — wire to existing connect handler */}
      <button className={cn(
        'font-sans text-12 font-medium px-3.5 py-1.5 rounded-full',
        'border-px border-black/20 text-[#1a1a1a]',
        'hover:bg-surface transition-colors duration-100'
      )}>
        {walletConnected ? truncateAddress(address) : 'Connect wallet'}
      </button>

      {/* Incognito toggle */}
      <IncognitoPill isIncognito={isIncognito} onToggle={() => setIsIncognito(!isIncognito)} />

    </div>
  </div>
</nav>
```

Nav background: `bg-white`, no blur, no transparency, no glass.

---

## 8. Incognito Toggle — `IncognitoPill`

Same toggle handler as your existing implementation. Only the visual changes.

```tsx
// components/IncognitoPill.tsx
export function IncognitoPill({
  isIncognito,
  onToggle,
}: {
  isIncognito: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 px-3.5 py-1.5 rounded-full border-px',
        'font-sans text-12 font-medium select-none',
        'transition-all duration-200 ease-in-out',
        isIncognito
          ? 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
          : 'bg-transparent border-black/20 text-muted hover:bg-surface'
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full transition-colors duration-200',
        isIncognito ? 'bg-white' : 'bg-muted-light'
      )} />
      Incognito
    </button>
  )
}
```

When toggled ON: the pill goes solid black. Simultaneously, the main card background transitions to `#111111` via the `transition-colors duration-[250ms]` on the card itself — no JS needed, pure Tailwind transition on a class change.

---

## 9. Wallet Guidance Banner — `WalletBanner`

Always visible directly below the nav. Not dismissible. Transitions with incognito state. Wire nothing — this is purely informational UI.

```tsx
// components/WalletBanner.tsx
export function WalletBanner({ isIncognito }: { isIncognito: boolean }) {
  return (
    <div className={cn(
      'mb-4 px-3.5 py-2.5 rounded-lg border-px',
      'font-sans text-12 font-normal',
      'transition-all duration-[250ms] ease-in-out',
      isIncognito
        ? 'bg-incognito-surface border-incognito-border text-incognito-muted'
        : 'bg-surface border-black/10 text-muted'
    )}>
      {isIncognito ? (
        <>
          <span className="text-warn-dark-text">⚠</span>
          {'  '}Private payments require{' '}
          <span className="font-medium text-incognito-text">Solflare</span>
          {' '}or the{' '}
          <span className="font-medium text-incognito-text">Umbra wallet</span>.
          {' '}Phantom does not support Umbra stealth addresses and cannot complete private payments.
        </>
      ) : (
        <>
          {'ℹ  '}Standard payments work with any Solana wallet —{' '}
          <span className="font-medium text-[#1a1a1a]">Phantom</span>,{' '}
          <span className="font-medium text-[#1a1a1a]">Backpack</span>,{' '}
          <span className="font-medium text-[#1a1a1a]">Solflare</span>, etc.
        </>
      )}
    </div>
  )
}
```

---

## 10. Model Selector — `ModelChips`

Four chips. One selectable at a time. Wire `onSelect` to your existing model state setter — nothing else changes.

**Supported models (current):**

| Display label | Model ID | Provider |
|--------------|----------|----------|
| GPT-3.5 Turbo | `gpt-3.5-turbo` | OpenAI |
| Llama 3 · Groq | `llama3-70b-8192` | Groq |
| Gemini 2.0 Flash | `gemini-2.0-flash` | Google |
| Gemini 2.5 Pro | `gemini-2.5-pro` | Google |

```tsx
// components/ModelChips.tsx
const MODELS = [
  { label: 'GPT-3.5 Turbo',    id: 'gpt-3.5-turbo'   },
  { label: 'Llama 3 · Groq',   id: 'llama3-70b-8192'  },
  { label: 'Gemini 2.0 Flash', id: 'gemini-2.0-flash' },
  { label: 'Gemini 2.5 Pro',   id: 'gemini-2.5-pro'   },
]

export function ModelChips({
  selectedModel,
  onSelect,
  isIncognito,
}: {
  selectedModel: string
  onSelect: (id: string) => void
  isIncognito: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MODELS.map((m) => {
        const selected = selectedModel === m.id
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={cn(
              'px-3.5 py-1.5 rounded-full border-px',
              'font-sans text-12 font-medium',
              'transition-colors duration-[120ms] ease',
              selected
                ? isIncognito
                  ? 'bg-[#333333] border-[#444444] text-incognito-text'
                  : 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                : isIncognito
                  ? 'bg-transparent border-incognito-border text-incognito-muted hover:bg-incognito-surface'
                  : 'bg-transparent border-black/20 text-muted hover:bg-surface'
            )}
          >
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
```

---

## 11. Prompt Textarea + Submit Button

Wire `value`, `onChange`, and the submit handler to your existing state. Do not touch the submission logic.

```tsx
{/* Textarea */}
<textarea
  value={prompt}
  onChange={(e) => setPrompt(e.target.value)}
  placeholder="Enter your prompt..."
  rows={4}
  className={cn(
    'w-full resize-none rounded-lg border-px px-3.5 py-3',
    'font-sans text-13 font-normal',
    'placeholder:text-muted-light',
    'focus:outline-none transition-colors duration-100',
    isIncognito
      ? 'bg-incognito-surface border-incognito-border text-incognito-text placeholder:text-incognito-muted focus:border-[#444444]'
      : 'bg-transparent border-black/10 text-[#1a1a1a] focus:border-black/25'
  )}
/>

{/* Submit — right-aligned below textarea */}
<div className="flex justify-end mt-2">
  <button
    onClick={handleSubmit}
    disabled={!prompt.trim()}
    className={cn(
      'px-4 py-2 rounded-lg font-sans text-13 font-medium',
      'transition-all duration-100 ease active:scale-[0.97]',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      isIncognito
        ? 'bg-incognito-btn border-px border-incognito-btn-border text-incognito-text'
        : 'bg-[#1a1a1a] text-white hover:opacity-[0.88]'
    )}
  >
    Get quote →
  </button>
</div>
```

---

## 12. Step Indicator — `StepIndicator`

Four steps, vertical list. Wire `currentStep` to your existing flow state — the logic driving step progression is unchanged.

```tsx
// components/StepIndicator.tsx
const STEPS = [
  { n: 1, title: 'Pick model & enter prompt',  desc: 'Choose a model and type your prompt'    },
  { n: 2, title: 'Quote received',              desc: 'Payment required before inference'      },
  { n: 3, title: 'Sign & pay',                  desc: 'Confirm the transaction in your wallet' },
  { n: 4, title: 'Verify & respond',            desc: 'On-chain verification → AI response'   },
]

export function StepIndicator({
  currentStep,
  isIncognito,
}: {
  currentStep: 1 | 2 | 3 | 4
  isIncognito: boolean
}) {
  return (
    <>
      {/* Mobile: single-line summary */}
      <p className="text-13 font-medium font-sans text-muted sm:hidden">
        Step {currentStep} of 4 — {STEPS[currentStep - 1].title}
      </p>

      {/* Desktop: full list */}
      <div className="hidden sm:flex flex-col gap-4">
        {STEPS.map((step) => {
          const done   = currentStep > step.n
          const active = currentStep === step.n

          return (
            <div key={step.n} className="flex items-start gap-3">

              {/* Circle */}
              <div className={cn(
                'w-[22px] h-[22px] rounded-full flex-shrink-0 mt-0.5',
                'flex items-center justify-center',
                'font-sans text-11 font-medium border-px',
                'transition-all duration-150 ease',
                done
                  ? 'bg-status-success-bg border-status-success-bg text-status-success-text'
                  : active
                    ? isIncognito
                      ? 'bg-incognito-text border-incognito-text text-incognito-bg'
                      : 'bg-[#1a1a1a] border-[#1a1a1a] text-white'
                    : isIncognito
                      ? 'bg-transparent border-incognito-border text-incognito-muted'
                      : 'bg-transparent border-black/15 text-muted-light'
              )}>
                {done ? '✓' : step.n}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'font-sans text-13 font-medium leading-snug',
                  active || done
                    ? isIncognito ? 'text-incognito-text' : 'text-[#1a1a1a]'
                    : isIncognito ? 'text-incognito-muted' : 'text-muted'
                )}>
                  {step.title}
                </p>
                {active && (
                  <p className={cn(
                    'font-sans text-12 font-normal mt-0.5',
                    isIncognito ? 'text-incognito-muted' : 'text-muted'
                  )}>
                    {step.desc}
                  </p>
                )}
              </div>

            </div>
          )
        })}
      </div>
    </>
  )
}
```

Step completion animation: the circle transitions from active-black to success-green in 150ms via `transition-all duration-150` — pure Tailwind, no JS animation needed.

---

## 13. Quote Block — `QuoteBlock`

Appears with `animate-slide-down` when the backend returns the quote. Wire `price`, `modelLabel`, `currency`, and `onPay` to your existing quote state and payment trigger.

```tsx
// components/QuoteBlock.tsx
export function QuoteBlock({
  price,
  modelLabel,
  currency,
  onPay,
  isIncognito,
  isPhantomWallet,
}: {
  price: string
  modelLabel: string
  currency: 'SOL' | 'dUSDC'
  onPay: () => void
  isIncognito: boolean
  isPhantomWallet: boolean
}) {
  return (
    <div className="animate-slide-down space-y-2">

      {/* Incognito badge — only in private mode */}
      {isIncognito && (
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-incognito-muted" />
          <span className="font-sans text-10 font-medium uppercase tracking-widest text-incognito-muted">
            Private · Umbra
          </span>
        </div>
      )}

      {/* Main quote row */}
      <div className={cn(
        'rounded-lg px-4 py-3.5 flex items-center justify-between gap-4',
        isIncognito ? 'bg-incognito-surface' : 'bg-surface'
      )}>
        <div>
          {/* Price — Instrument Serif Italic */}
          <p className={cn(
            'font-serif-italic text-32 leading-none',
            isIncognito ? 'text-incognito-text' : 'text-[#1a1a1a]'
          )}>
            {price} {currency}
          </p>
          <p className={cn(
            'font-sans text-11 font-normal mt-1',
            isIncognito ? 'text-incognito-muted' : 'text-muted'
          )}>
            per inference · {modelLabel}
            {isIncognito && ' · link between wallets masked'}
          </p>
        </div>

        {/* Pay button — fires existing onPay handler */}
        <button
          onClick={onPay}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-lg font-sans text-13 font-medium',
            'transition-all duration-100 active:scale-[0.97]',
            isIncognito
              ? 'bg-incognito-btn border-px border-incognito-btn-border text-incognito-text'
              : 'bg-[#1a1a1a] text-white hover:opacity-[0.88]'
          )}
        >
          {isIncognito ? 'Sign & pay →' : 'Pay & run →'}
        </button>
      </div>

      {/* Phantom-in-incognito warning — only when Phantom is connected in private mode */}
      {isIncognito && isPhantomWallet && (
        <div className="px-3.5 py-2.5 rounded-lg bg-warn-dark-bg border-px border-warn-dark-text/20 font-sans text-12 font-normal text-warn-dark-text">
          ⚠{'  '}Your connected wallet (Phantom) does not support private payments.
          Switch to Solflare to use incognito mode.{' '}
          <a
            href="https://solflare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            How to switch ↗
          </a>
        </div>
      )}

    </div>
  )
}
```

---

## 14. Transaction Status Bar — `StatusBar`

Appears with `animate-fade-in` after wallet signs. Three states. Wire `status` and `onRetry` to your existing tx verification state — do not change verification logic.

```tsx
// components/StatusBar.tsx
export function StatusBar({
  status,
  isIncognito,
  onRetry,
}: {
  status: 'pending' | 'success' | 'error'
  isIncognito: boolean
  onRetry?: () => void
}) {
  return (
    <div className={cn(
      'animate-fade-in flex items-center gap-2 px-3.5 py-2.5 rounded-lg',
      'font-sans text-12 font-medium',
      status === 'pending' && 'bg-status-pending-bg text-status-pending-text',
      status === 'success' && 'bg-status-success-bg text-status-success-text',
      status === 'error'   && 'bg-status-error-bg text-status-error-text',
    )}>

      {/* Leading icon or pulse dot */}
      {status === 'pending' && (
        <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 animate-pulse-dot" />
      )}
      {status === 'success' && <span className="flex-shrink-0">✓</span>}
      {status === 'error'   && <span className="flex-shrink-0">✕</span>}

      {/* Message */}
      <span className="flex-1">
        {status === 'pending' && (
          isIncognito
            ? 'Scanning for matching Umbra UTXO...'
            : 'Scanning chain for payment...'
        )}
        {status === 'success' && 'Verified · response below'}
        {status === 'error'   && 'Payment not found — check wallet and retry'}
      </span>

      {/* Retry — only on error, wires to existing retry handler */}
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto flex-shrink-0 underline font-sans text-12 font-medium text-status-error-text"
        >
          Retry
        </button>
      )}

    </div>
  )
}
```

---

## 15. AI Response Area — `ResponseArea`

Appears after success status. Typewriter reveal — characters stream in progressively. If your backend already streams tokens, feed them into state as they arrive. Wire the `text` prop to your existing response state.

```tsx
// components/ResponseArea.tsx
export function ResponseArea({
  text,
  isStreaming,
  isIncognito,
}: {
  text: string
  isStreaming: boolean
  isIncognito: boolean
}) {
  return (
    <div>
      {/* Label */}
      <p className={cn(
        'font-sans text-10 font-medium uppercase tracking-widest mb-3',
        isIncognito ? 'text-incognito-muted' : 'text-muted-light'
      )}>
        Response
      </p>

      {/* Response text */}
      <p className={cn(
        'font-sans text-14 font-normal leading-[1.75]',
        isStreaming && 'typewriter-cursor',
        isIncognito ? 'text-incognito-text' : 'text-[#1a1a1a]'
      )}>
        {text}
      </p>
    </div>
  )
}
```

Remove `typewriter-cursor` class once streaming completes (when `isStreaming` becomes false).

---

## 16. Prompt History — `PromptHistory`

Below the main card. Wire `history`, `onClear` to your existing state — do not change data shape.

```tsx
// components/PromptHistory.tsx
// Assumes your existing HistoryItem type:
// { id: string, modelLabel: string, prompt: string, cost: string, currency: string, mode: 'standard' | 'private' }

export function PromptHistory({
  history,
  onClear,
}: {
  history: HistoryItem[]
  onClear: () => void
}) {
  if (!history.length) {
    return (
      <p className="text-center font-sans text-13 font-normal text-muted-light py-6">
        No prompts yet — run your first inference above.
      </p>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-sans text-13 font-medium text-[#1a1a1a]">History</span>
        <button
          onClick={onClear}
          className="font-sans text-12 font-normal text-muted hover:underline"
        >
          Clear
        </button>
      </div>

      {/* Rows */}
      <div className="divide-y divide-black/[0.07]">
        {history.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 py-2.5">

            {/* Mode dot: black = standard SOL, gray = Umbra private */}
            <span className={cn(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              item.mode === 'private' ? 'bg-[#555555]' : 'bg-[#1a1a1a]'
            )} />

            {/* Model name */}
            <span className="font-sans text-12 font-medium text-[#1a1a1a] min-w-[120px] hidden sm:block">
              {item.modelLabel}
            </span>

            {/* Prompt snippet */}
            <span className="font-sans text-12 font-normal text-muted flex-1 truncate">
              {item.prompt}
            </span>

            {/* Cost */}
            <span className="font-sans text-12 font-normal text-muted-light min-w-[70px] text-right tabular-nums">
              {item.cost} {item.currency}
            </span>

          </div>
        ))}
      </div>
    </div>
  )
}
```

**Mode dot encoding:** Black dot = standard SOL payment (visible on-chain). Gray dot = Umbra private payment (link masked). The dot is the only visual indicator of mode — no text label needed.

---

## 17. Animation Reference

All animations are Tailwind classes defined in the config. No JS animation libraries.

| Event | Tailwind class | Duration | Notes |
|-------|---------------|----------|-------|
| Quote block appear | `animate-slide-down` | 180ms | `translateY(-8px)→0` + opacity |
| Status bar appear | `animate-fade-in` | 150ms | `translateY(-4px)→0` + opacity |
| Scanning dot pulse | `animate-pulse-dot` | 1.5s loop | opacity 0.9→0.4 + scale |
| Incognito card flip | `transition-colors duration-[250ms] ease-in-out` on card div | 250ms | bg + border colors only |
| Incognito pill toggle | `transition-all duration-200 ease-in-out` on pill | 200ms | bg, border, text |
| Wallet banner swap | `transition-all duration-[250ms] ease-in-out` on banner | 250ms | bg, border, text |
| Model chip hover | `transition-colors duration-[120ms] ease` | 120ms | bg only |
| Button hover | `hover:opacity-[0.88]` | instant (CSS) | no duration |
| Button press | `active:scale-[0.97]` | ~80ms (browser default) | — |
| Step circle fill | `transition-all duration-150 ease` | 150ms | bg, border, text color |
| Typewriter stream | JS — ~40ms per character | streaming | remove cursor class on done |

**Rule:** No animation longer than 300ms except pulse loop and typewriter. No `animate-bounce`, `animate-spin`, or spring-based motion. Easing curves are defined in `tailwind.config.ts` keyframes.

---

## 18. Responsive Behavior

| Breakpoint | Change | Tailwind approach |
|-----------|--------|------------------|
| `< 640px` | Page padding narrows | `px-6 sm:px-4` on container |
| `< 640px` | Model chips wrap to 2 rows | natural — `flex-wrap` already set |
| `< 640px` | Quote block stacks vertically | `flex-col sm:flex-row` on quote row |
| `< 640px` | Pay button goes full width | `w-full sm:w-auto` on pay button |
| `< 640px` | Nav wordmark abbreviates | `after:content-['AgentX402'] sm:hidden` or conditional render |
| `< 480px` | Step indicator collapses | `hidden sm:flex` on full list, `sm:hidden` on summary line |
| `< 480px` | History hides model column | `hidden sm:block` on model name cell |

---

## 19. Component File Map

| Component | File | What changes |
|-----------|------|-------------|
| `Nav` | `components/Nav.tsx` | Visual restyle only — same wallet connect handler |
| `WalletBanner` | `components/WalletBanner.tsx` | New or replace existing banner — no handler |
| `IncognitoPill` | `components/IncognitoPill.tsx` | Visual restyle — same `isIncognito` toggle |
| `ModelChips` | `components/ModelChips.tsx` | Visual restyle — same `selectedModel` + `onSelect` |
| `PromptInput` | `components/PromptInput.tsx` | Visual restyle — same `value`, `onChange`, `onSubmit` |
| `StepIndicator` | `components/StepIndicator.tsx` | Visual restyle — same `currentStep` prop |
| `QuoteBlock` | `components/QuoteBlock.tsx` | Visual restyle — same `price`, `onPay` props |
| `StatusBar` | `components/StatusBar.tsx` | Visual restyle — same `status`, `onRetry` props |
| `ResponseArea` | `components/ResponseArea.tsx` | Visual restyle — same streamed `text` prop |
| `PromptHistory` | `components/PromptHistory.tsx` | Visual restyle — same `history[]`, `onClear` props |

---

## 20. Never Do List

- No `backdrop-blur-*` or any `backdrop-filter` utility
- No gradient utilities — `bg-gradient-*`, `from-*`, `to-*`, `via-*`
- No `shadow-*` utilities — only `ring-*` for focus states on inputs
- No `font-semibold`, `font-bold`, `font-extrabold` — max is `font-medium`
- No Tailwind color utilities outside the defined custom palette — no `bg-purple-500`, `bg-indigo-600`, `bg-blue-500`, etc.
- No `rounded-2xl` or higher on rectangular containers — max is `rounded-xl`. Pills use `rounded-full` explicitly
- No icon component libraries (`lucide-react`, `heroicons`) for UI chrome — use plain text characters: `✓`, `✕`, `→`, `ℹ`, `⚠`
- No `animate-spin` loading spinners — the only animation for loading state is `animate-pulse-dot`
- No modals, sheets, or drawers — all state changes happen inline in the main card, in-place
- No `uppercase` Tailwind class on visible UI labels except the 10px uppercase tracking tag role
- No `text-xs` (12px via Tailwind default) for anything below 11px — use the custom `text-10` or `text-11` tokens from the config