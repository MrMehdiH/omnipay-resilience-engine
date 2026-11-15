# OmniPay Resilience Engine

An interactive, in-browser simulation of payment resilience and BNPL unit economics, with English/LTR and Persian/RTL ecosystems.

[Live demo](https://mrmehdih.github.io/omnipay-resilience-engine/) · [Security policy](SECURITY.md) · [Critical review](docs/critical-review-01.fa.md) · [Publishing guide](docs/publishing-review-01.fa.md)

**No real payments, backend, card collection, or provider integrations.** Stripe, Klarna, Shaparak and SnappPay identify the simulated ecosystem. The ledger, idempotency registry and dead-letter outcomes live in memory in one browser tab; reloading clears them. VPN faults are manually simulated; the application does not inspect your IP.

## What the demo implements

- Intent-scoped idempotency: concurrent requests share one operation; completed requests replay the cached result; changed payloads under the same key fail.
- Re-entrant cart leases and an optimistic ledger with guarded transitions.
- Gateway outcomes classified as safe to retry, definitive refusal, unknown, or requiring reconciliation. Unknown outcomes require status inquiry before another authorization; unresolved outcomes are never compensated automatically.
- Bounded retries and status inquiries with full-jitter exponential backoff. A seeded simulator and seeded retry randomness reproduce decisions and delays; UUIDs and wall-clock telemetry are intentionally different on fresh runs.
- Chaos presets for latency, partition, hard declines, transient errors and a hypothetical VPN fault.
- A transaction state machine and telemetry viewer. The retry edge is cyclic; its bounded execution can be unrolled into an acyclic trace. This is not a general-purpose DAG dependency solver.
- BNPL fee and margin assumptions, discounted LTV, referral rewards, blended CAC and finite or steady-state viral growth.

The Replay control demonstrates a completed intent without contacting the gateway again. Concurrent duplicate coalescing is verified in core tests. Clearing a warning does not disable its simulated fault.

## Run locally

Use Node.js 22.12+ in the 22.x line, 24.x, or 26+ (see `package.json`). CI uses Node 22. Dependencies are locked in `package-lock.json`.

```sh
git clone https://github.com/MrMehdiH/omnipay-resilience-engine.git
cd omnipay-resilience-engine
npm ci
npm run dev
```

Open `http://localhost:3000`.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The project uses Next.js 16.4.2, React 19.3, TypeScript, Tailwind CSS 4, Zustand, Zod and Vitest. Read the installed Next.js guides in `node_modules/next/dist/docs/` before changing framework code.

## Architecture

| Directory | Responsibility |
| --- | --- |
| `src/core/dag` | Framework-independent state machine, injected ports and in-memory adapters |
| `src/core/growth-engine` | Growth model and money formatting |
| `src/schemas` | Transaction, configuration and ecosystem contracts |
| `src/store` | Simulation orchestration and client state |
| `src/components/{atoms,molecules,organisms}` | UI layers |
| `src/design-tokens` | Primitive, semantic and contextual CSS variables |

ESLint rejects explicit `any`, framework imports in core/schemas, and imports from higher atomic UI layers. Currency is `USD` (cents) or `IRT` (whole Toman) throughout the core and UI. Growth assumptions are illustrative inputs, not vendor pricing or investment advice.

## Deployment

`output: "export"` produces `out/`; `next start` is not the serving path for this static export. For a local build made without `GITHUB_ACTIONS`, any static file server can serve `out/` (for example, if Python is installed: `python -m http.server 3000 --bind 127.0.0.1 --directory out`).

On GitHub Actions, the build uses `/omnipay-resilience-engine` as its base path. Pull requests run lint, typecheck, tests and export. Pushes to `main` also upload and deploy the Pages artifact. The current workflow does not deploy from `workflow_dispatch`.

Google fonts are fetched at build time by `next/font` and bundled with the export. Builds need access to those font sources. Runtime assets are served by the static host.

## Limits and next work

- Circuit-breaker behavior, multi-region routing and currency conversion remain roadmap items. Circuit-state types alone are not an implementation.
- This is a local simulation of distributed-system patterns. Cross-process deduplication, durable reconciliation, provider verification and production timeouts need server-side adapters and storage.
- Lease renewal/fencing and cancellation are not implemented. Real adapters must enforce time budgets; the engine does not interrupt a never-resolving port.
- The growth model still declares some contracts inside `src/core/growth-engine`; move those to shared schemas before adding another consumer.
- Browser smoke checks are currently manual; automated accessibility, responsive and browser regression checks remain work to add.

## Author

**Mehdi (Willam) Heydari | مهدی حیدری** — product direction and architecture, with AI-assisted implementation.

[GitHub](https://github.com/MrMehdiH) · [LinkedIn](https://www.linkedin.com/in/mehdi-heydari-7b70b9291) · [Email](mailto:mr.mhd.2000p@gmail.com)
