import styles from "./page.module.css";

type EndpointDoc = {
  method: "GET" | "POST";
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

const endpoints: EndpointDoc[] = [
  {
    method: "GET",
    path: "/health",
    summary: "Health and runtime status",
    description:
      "Returns service health, x402 payment settings, Solana network, and uptime. Use this first to confirm the API is reachable and correctly configured.",
    responses: [
      {
        status: "200",
        description: "Backend is reachable and returns its runtime state.",
        example: `{
  "status": "ok",
  "x402Enabled": true,
  "paymentToken": "SOL",
  "requiredAmount": 10000000,
  "magicblockEnabled": true,
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
      "Primary endpoint for AI generation. The caller must send an x402 payment proof in the x-payment header and a prompt in the request body.",
    request: {
      headers: [
        {
          name: "x-payment",
          type: "string",
          required: true,
          description: "Base64-encoded Solana transaction signature used for x402 payment verification.",
        },
      ],
      body: `{
  "prompt": "Explain how x402 payments work in this backend",
  "model": "gpt-4.1-mini",
  "consumer_wallet": "9k3ExampleWalletPublicKey"
}`,
      example: `curl -X POST http://localhost:8080/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-payment: <base64-signature>" \\
  -d '{
    "prompt": "Explain how x402 payments work in this backend",
    "model": "gpt-4.1-mini",
    "consumer_wallet": "9k3ExampleWalletPublicKey"
  }'`,
    },
    responses: [
      {
        status: "200",
        description: "AI response plus payment and settlement receipt details.",
        example: `{
  "response": "x402 lets the backend verify payment before serving the AI response...",
  "model": "gpt-4.1-mini",
  "tokens": {
    "prompt": 19,
    "completion": 76,
    "total": 95
  },
  "receipt": {
    "requestId": "c3d0a7b3-7f2b-4f5b-b18a-24f84eaf2f69",
    "paymentSignature": "5uQexampleSignature",
    "paymentAmount": 10000000,
    "paymentStatus": "verified",
    "settlementSignature": "3jPexampleSettlement",
    "settlementMethod": "magicblock",
    "apiKeyOwner": "8PqExampleProviderWallet",
    "apiKeyEarnings": 8000000,
    "platformFee": 2000000,
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
        description: "No API key providers are currently available for routing the request.",
        example: `{
  "error": "No registered API keys available. Please try again later."
}`,
      },
    ],
  },
  {
    method: "POST",
    path: "/api/keys/register",
    summary: "Register a provider API key",
    description:
      "Adds an API key to the in-memory key pool so the backend can route AI calls through that provider and attribute earnings to the owner wallet.",
    request: {
      body: `{
  "apiKey": "sk-provider-secret",
  "ownerWallet": "7mXExampleOwnerWallet",
  "model": "gpt-4.1-mini",
  "dailyRequestLimit": 1000
}`,
      example: `curl -X POST http://localhost:8080/api/keys/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "sk-provider-secret",
    "ownerWallet": "7mXExampleOwnerWallet",
    "model": "gpt-4.1-mini",
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
    summary: "Read earnings for one registered key",
    description:
      "Fetches the earnings, limits, and activity data for a specific API key hash. Useful for provider dashboards and payout tracking.",
    request: {
      params: [
        {
          name: "keyHash",
          type: "string",
          required: true,
          description: "SHA-256 hash of the provider API key returned at registration time.",
        },
      ],
      example: `curl http://localhost:8080/api/keys/6aa1f7f4c2f4b7ef.../earnings`,
    },
    responses: [
      {
        status: "200",
        description: "Earnings and usage stats for the requested key.",
        example: `{
  "keyHash": "6aa1f7f4c2f4b7ef...",
  "ownerWallet": "7mXExampleOwnerWallet",
  "totalEarnings": "24000000",
  "requestCount": 3,
  "dailyRequestCount": 3,
  "dailyRequestLimit": 1000,
  "isActive": true,
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
    summary: "List configured AI providers",
    description:
      "Returns providers derived from the model registry. Each provider includes its available models, pricing summary, and tags.",
    responses: [
      {
        status: "200",
        description: "Provider catalog for the current backend build.",
        example: `[
  {
    "id": "openai",
    "enabled": true,
    "models": ["gpt-4.1-mini", "gpt-4.1"],
    "pricing": {
      "input": 0.00015,
      "output": 0.0006
    },
    "tags": ["fast", "reliable"]
  }
]`,
      },
    ],
  },
  {
    method: "GET",
    path: "/api/models",
    summary: "List available models",
    description:
      "Returns the model catalog exposed by the backend, including provider and pricing information per 1K tokens.",
    responses: [
      {
        status: "200",
        description: "Model catalog with provider and cost metadata.",
        example: `[
  {
    "id": "gpt-4.1-mini",
    "name": "GPT-4.1 Mini",
    "provider": "openai",
    "costPerK": {
      "input": 0.00015,
      "output": 0.0006
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
      "model": "gpt-4.1-mini",
      "provider": "openai",
      "tokens": 95,
      "timestamp": "2026-04-12T12:00:00.000Z"
    }
  ]
}`,
      },
    ],
  },
];

const quickstart = `curl -X POST http://localhost:8080/api/chat \\
  -H "Content-Type: application/json" \\
  -H "x-payment: <base64-signature>" \\
  -d '{
    "prompt": "Give me a one paragraph summary of this backend",
    "model": "gpt-4.1-mini",
    "consumer_wallet": "9k3ExampleWalletPublicKey"
  }'`;

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AgentX402 Backend API</p>
          <h1>Endpoint reference for payments, chat routing, providers, and analytics.</h1>
          <p className={styles.lead}>
            This page documents how to call the Express backend in{" "}
            <code>apps/backend/src/index.ts</code>. It focuses on what each endpoint does,
            what it expects, and what it returns.
          </p>
          <div className={styles.heroMeta}>
            <span>Base URL: <code>http://localhost:8080</code></span>
            <span>Auth model: <code>x-payment</code> header on paid chat requests</span>
            <span>Format: <code>application/json</code></span>
          </div>
        </div>
        <aside className={styles.panel}>
          <h2>Quick start</h2>
          <p>Register a provider key first, then send a paid chat request.</p>
          <pre className={styles.codeBlock}>
            <code>{quickstart}</code>
          </pre>
        </aside>
      </section>

      <section className={styles.overviewGrid}>
        <article className={styles.infoCard}>
          <h2>How to use this API</h2>
          <p>
            The backend verifies an x402 payment, selects a registered provider key,
            sends the prompt to an AI provider, settles the payment split, and returns
            a response with a receipt.
          </p>
        </article>
        <article className={styles.infoCard}>
          <h2>Important request rules</h2>
          <ul className={styles.list}>
            <li><code>POST /api/chat</code> requires <code>x-payment</code>.</li>
            <li><code>prompt</code> must be a non-empty string.</li>
            <li>Provider keys are stored in memory in the current backend implementation.</li>
          </ul>
        </article>
        <article className={styles.infoCard}>
          <h2>Error shape</h2>
          <pre className={styles.smallCode}>
            <code>{`{ "error": "message", "details": "optional" }`}</code>
          </pre>
          <p>
            Validation issues return <code>400</code>, payment failures may return{" "}
            <code>402</code>, provider availability issues return <code>503</code>.
          </p>
        </article>
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
                            <strong>{field.name}</strong> ({field.type}) {field.required ? "required" : "optional"}: {field.description}
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
                            <strong>{field.name}</strong> ({field.type}) {field.required ? "required" : "optional"}: {field.description}
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
                    <div key={response.status + response.description} className={styles.responseCard}>
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
