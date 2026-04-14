import styles from "./page.module.css";

type HttpMethod = "GET" | "POST";

type EndpointDoc = {
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  request?: {
    headers?: Array<{ name: string; type: string; required: boolean; description: string }>;
    params?: Array<{ name: string; type: string; required: boolean; description: string }>;
    body?: string;
    example?: string;
  };
  responses: Array<{ status: string; description: string; example: string }>;
};

type ModelDoc = {
  id: string;
  name: string;
  provider: string;
  input: number;
  output: number;
};

const models: ModelDoc[] = [
  {
    id: "claude-opus-4-20250514",
    name: "Claude Opus 4",
    provider: "claude",
    input: 0.015,
    output: 0.075,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "claude",
    input: 0.003,
    output: 0.015,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    input: 0.005,
    output: 0.015,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    input: 0.00015,
    output: 0.0006,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    input: 0.00125,
    output: 0.01,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    input: 0.0003125,
    output: 0.0025,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    input: 0.0001,
    output: 0.0004,
  },
  {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    name: "Llama 3.3 70B (Together)",
    provider: "together",
    input: 0.00088,
    output: 0.00088,
  },
];

const endpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/health",
    summary: "Health and runtime status",
    description:
      "Returns the current runtime state for payments and settlement, including the configured Solana network and whether MagicBlock settlement is active.",
    responses: [
      {
        status: "200",
        description: "Backend is reachable and exposes the current payment configuration.",
        example: `{
  "status": "ok",
  "x402Enabled": true,
  "paymentToken": "SOL",
  "requiredAmount": 10000000,
  "magicblockEnabled": false,
  "network": "devnet",
  "uptime": 123.456
}`,
      },
    ],
  },
  {
    method: "POST",
    path: "/api/chat",
    summary: "Pay-per-prompt chat request",
    description:
      "Verifies the x402 payment, routes the prompt to an eligible AI model, settles the split, and returns the model output with a receipt.",
    request: {
      headers: [
        {
          name: "x-payment",
          type: "string",
          required: true,
          description:
            "Base64-encoded Solana transaction signature used as the proof-of-payment header.",
        },
      ],
      body: `{
  "prompt": "Explain how the backend decides between user keys and platform keys",
  "model": "gpt-4o-mini",
  "consumer_wallet": "9k3ExampleWalletPublicKey"
}`,
      example: `curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-payment: <base64-signature>" \\
  -d '{
    "prompt": "Explain how the backend decides between user keys and platform keys",
    "model": "gpt-4o-mini",
    "consumer_wallet": "9k3ExampleWalletPublicKey"
  }'`,
    },
    responses: [
      {
        status: "200",
        description: "AI response plus the payment and settlement receipt.",
        example: `{
  "response": "The backend first verifies the payment, then tries healthy user keys for the requested model before falling back to platform models...",
  "model": "gpt-4o-mini",
  "tokens": {
    "prompt": 21,
    "completion": 88,
    "total": 109
  },
  "receipt": {
    "requestId": "c3d0a7b3-7f2b-4f5b-b18a-24f84eaf2f69",
    "paymentSignature": "5uQexampleSignature",
    "paymentAmount": 10000000,
    "paymentStatus": "verified",
    "settlementSignature": "sim_1234_abc",
    "settlementMethod": "simulated",
    "apiKeyOwner": "8PqExampleProviderWallet",
    "apiKeyEarnings": 0.008,
    "platformFee": 0.002,
    "timestamp": "2026-04-12T12:00:00.000Z"
  }
}`,
      },
      {
        status: "402",
        description: "Payment header missing or invalid for a paid request.",
        example: `{
  "error": "Payment required",
  "details": "Include a valid Solana transaction signature in the x-payment header (base64 encoded).",
  "requiredAmount": 10000000,
  "paymentToken": "SOL",
  "recipientWallet": "YourPlatformWallet"
}`,
      },
      {
        status: "400",
        description: "Prompt missing or empty.",
        example: `{
  "error": "prompt is required and must be a non-empty string"
}`,
      },
      {
        status: "503",
        description:
          "No configured models are available, or every active model is failing or in cooldown.",
        example: `{
  "error": "No AI providers are available right now. All platform models are in cooldown or unconfigured."
}`,
      },
    ],
  },
  {
    method: "POST",
    path: "/api/keys/register",
    summary: "Register a provider API key",
    description:
      "Adds a provider key to the in-memory pool. The key can target one specific model or stay model-agnostic with the default value of any.",
    request: {
      body: `{
  "apiKey": "sk-provider-secret",
  "ownerWallet": "7mXExampleOwnerWallet",
  "model": "gpt-4o-mini",
  "dailyRequestLimit": 1000
}`,
      example: `curl -X POST http://localhost:3000/api/keys/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "sk-provider-secret",
    "ownerWallet": "7mXExampleOwnerWallet",
    "model": "gpt-4o-mini",
    "dailyRequestLimit": 1000
  }'`,
    },
    responses: [
      {
        status: "201",
        description: "API key accepted and activated.",
        example: `{
  "keyHash": "6aa1f7f4c2f4b7ef...",
  "status": "active"
}`,
      },
      {
        status: "201",
        description: "The same key was already registered earlier.",
        example: `{
  "keyHash": "6aa1f7f4c2f4b7ef...",
  "status": "already_registered"
}`,
      },
      {
        status: "400",
        description: "Required registration fields are missing.",
        example: `{
  "error": "apiKey and ownerWallet are required"
}`,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/keys/:keyHash/earnings",
    summary: "Read earnings and key health",
    description:
      "Fetches payout totals, limits, request counts, and health fields such as consecutive failures and blacklist status for a specific key.",
    request: {
      params: [
        {
          name: "keyHash",
          type: "string",
          required: true,
          description: "SHA-256 hash returned when the key was registered.",
        },
      ],
      example: `curl http://localhost:3000/api/keys/6aa1f7f4c2f4b7ef.../earnings`,
    },
    responses: [
      {
        status: "200",
        description: "Usage, earnings, and health data for the requested key.",
        example: `{
  "keyHash": "6aa1f7f4c2f4b7ef...",
  "ownerWallet": "7mXExampleOwnerWallet",
  "totalEarnings": "24000000",
  "requestCount": 3,
  "dailyRequestCount": 3,
  "dailyRequestLimit": 1000,
  "isActive": true,
  "consecutiveFailures": 0,
  "blacklisted": false,
  "blacklistedAt": null,
  "createdAt": "2026-04-12T10:00:00.000Z"
}`,
      },
      {
        status: "400",
        description: "The requested key hash does not exist.",
        example: `{
  "error": "API key not found: 6aa1f7f4c2f4b7ef..."
}`,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/providers",
    summary: "List currently usable providers",
    description:
      "Returns only providers that are usable right now. Entries can come from platform .env keys or from user-registered keys that unlock specific models.",
    responses: [
      {
        status: "200",
        description: "Provider catalog visible to callers for the current runtime state.",
        example: `[
  {
    "id": "openai",
    "enabled": true,
    "source": "platform",
    "models": ["gpt-4o", "gpt-4o-mini"],
    "pricing": {
      "input": 0.005,
      "output": 0.015
    },
    "tags": ["fast", "reliable"]
  },
  {
    "id": "google",
    "enabled": true,
    "source": "user-provided",
    "models": ["gemini-2.0-flash"],
    "pricing": {
      "input": 0.0001,
      "output": 0.0004
    },
    "tags": []
  }
]`,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/models",
    summary: "List callable models",
    description:
      "Returns the subset of models that can actually be called right now. Each model includes whether it is backed by a platform key or a user-provided key.",
    responses: [
      {
        status: "200",
        description: "Visible model catalog with provider, source, and pricing metadata.",
        example: `[
  {
    "id": "gpt-4o-mini",
    "name": "GPT-4o Mini",
    "provider": "openai",
    "source": "platform",
    "costPerK": {
      "input": 0.00015,
      "output": 0.0006
    }
  },
  {
    "id": "gemini-2.0-flash",
    "name": "Gemini 2.0 Flash",
    "provider": "google",
    "source": "user-provided",
    "costPerK": {
      "input": 0.0001,
      "output": 0.0004
    }
  }
]`,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/analytics",
    summary: "Platform analytics snapshot",
    description:
      "Summarizes request volume, provider usage, x402 payment counts, and the most recent requests handled by the backend.",
    responses: [
      {
        status: "200",
        description: "Aggregated request and cost analytics.",
        example: `{
  "totalRequests": 12,
  "totalCostUsd": 0.042381,
  "averageCostPerRequest": 0.003532,
  "byProvider": {
    "openai": 8,
    "claude": 4
  },
  "x402Stats": {
    "processedPayments": 12
  },
  "recentRequests": [
    {
      "requestId": "c3d0a7b3-7f2b-4f5b-b18a-24f84eaf2f69",
      "model": "gpt-4o-mini",
      "provider": "openai",
      "tokens": 109,
      "timestamp": "2026-04-12T12:00:00.000Z"
    }
  ]
}`,
      },
    ],
  },
];

const quickstart = `curl -X POST http://localhost:3000/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-payment: <base64-signature>" \\
  -d '{
    "prompt": "Give me a one paragraph summary of this backend",
    "model": "gpt-4o-mini",
    "consumer_wallet": "9k3ExampleWalletPublicKey"
  }'`;

const errorShape = `{
  "error": "message",
  "details": "optional"
}`;

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AgentX402 Backend API</p>
          <h1>Endpoint reference for x402 payments, AI routing, keys, and analytics.</h1>
          <p className={styles.lead}>
            This page documents the current Express backend in{" "}
            <code>apps/backend/src/index.ts</code> and the runtime behavior behind it.
            The examples below track the actual route handlers, model registry, and
            key-routing logic in the backend source.
          </p>
          <div className={styles.heroMeta}>
            <span>
              Base URL: <code>http://localhost:3000</code>
            </span>
            <span>
              Paid route: <code>POST /api/chat</code>
            </span>
            <span>
              Payment proof: <code>x-payment</code> header
            </span>
            <span>
              Format: <code>application/json</code>
            </span>
          </div>
        </div>
        <aside className={styles.panel}>
          <h2>Quick start</h2>
          <p>
            Register a provider key if you want marketplace routing, then send a paid
            chat request to the backend.
          </p>
          <pre className={styles.codeBlock}>
            <code>{quickstart}</code>
          </pre>
        </aside>
      </section>

      <section className={styles.overviewGrid}>
        <article className={styles.infoCard}>
          <h2>How routing works now</h2>
          <ul className={styles.list}>
            <li>
              The backend verifies the x402 payment before it attempts any provider call.
            </li>
            <li>
              User-registered keys are only tried when the request includes a specific{" "}
              <code>model</code>.
            </li>
            <li>
              Platform models fall back automatically and enter a 5 minute cooldown after
              3 consecutive failures.
            </li>
          </ul>
        </article>
        <article className={styles.infoCard}>
          <h2>Important request rules</h2>
          <ul className={styles.list}>
            <li>
              <code>POST /api/chat</code> requires a valid <code>x-payment</code> header.
            </li>
            <li>
              <code>prompt</code> must be a non-empty string.
            </li>
            <li>
              Registered keys are stored in memory and disappear on server restart.
            </li>
          </ul>
        </article>
        <article className={styles.infoCard}>
          <h2>Error shape</h2>
          <pre className={styles.smallCode}>
            <code>{errorShape}</code>
          </pre>
          <p>
            Validation issues return <code>400</code>, payment failures return{" "}
            <code>402</code>, unavailable routing capacity returns <code>503</code>, and
            unhandled errors return <code>500</code>.
          </p>
        </article>
      </section>

      <section className={styles.endpointSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Model Registry</p>
          <h2>Supported backend models</h2>
        </div>
        <div className={styles.endpointList}>
          {models.map((model) => (
            <article key={model.id} className={styles.endpointCard}>
              <div className={styles.endpointHead}>
                <span className={styles.methodGet}>{model.provider}</span>
                <code className={styles.path}>{model.id}</code>
              </div>
              <h3>{model.name}</h3>
              <p className={styles.description}>
                Input <code>${model.input}</code> per 1K tokens, output{" "}
                <code>${model.output}</code> per 1K tokens.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.endpointSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Endpoints</p>
          <h2>Reference</h2>
        </div>
        <div className={styles.endpointList}>
          {endpoints.map((endpoint) => (
            <article key={`${endpoint.method}-${endpoint.path}`} className={styles.endpointCard}>
              <div className={styles.endpointHead}>
                <span
                  className={
                    endpoint.method === "GET" ? styles.methodGet : styles.methodPost
                  }
                >
                  {endpoint.method}
                </span>
                <code className={styles.path}>{endpoint.path}</code>
              </div>
              <h3>{endpoint.summary}</h3>
              <p className={styles.description}>{endpoint.description}</p>

              {endpoint.request ? (
                <section className={styles.subsection}>
                  <h4>Request</h4>
                  {endpoint.request.headers ? (
                    <div className={styles.fieldGroup}>
                      <p className={styles.subLabel}>Headers</p>
                      <ul className={styles.fieldList}>
                        {endpoint.request.headers.map((field) => (
                          <li key={field.name}>
                            <strong>{field.name}</strong> ({field.type}){" "}
                            {field.required ? "required" : "optional"}: {field.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {endpoint.request.params ? (
                    <div className={styles.fieldGroup}>
                      <p className={styles.subLabel}>Path params</p>
                      <ul className={styles.fieldList}>
                        {endpoint.request.params.map((field) => (
                          <li key={field.name}>
                            <strong>{field.name}</strong> ({field.type}){" "}
                            {field.required ? "required" : "optional"}: {field.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {endpoint.request.body ? (
                    <div className={styles.fieldGroup}>
                      <p className={styles.subLabel}>JSON body</p>
                      <pre className={styles.codeBlock}>
                        <code>{endpoint.request.body}</code>
                      </pre>
                    </div>
                  ) : null}

                  {endpoint.request.example ? (
                    <div className={styles.fieldGroup}>
                      <p className={styles.subLabel}>Example call</p>
                      <pre className={styles.codeBlock}>
                        <code>{endpoint.request.example}</code>
                      </pre>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section className={styles.subsection}>
                <h4>Responses</h4>
                <div className={styles.responses}>
                  {endpoint.responses.map((response) => (
                    <div
                      key={response.status + response.description}
                      className={styles.responseCard}
                    >
                      <div className={styles.responseMeta}>
                        <span className={styles.statusCode}>{response.status}</span>
                        <p>{response.description}</p>
                      </div>
                      <pre className={styles.codeBlock}>
                        <code>{response.example}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </section>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
