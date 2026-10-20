<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OmniPay Resilience Engine — Architectural Contract & Guardrails

## 1. Project Overview & Mission
`omnipay-resilience-engine` is an interactive full-stack resilience and fintech growth engineering showcase built to demonstrate production-grade distributed resilience patterns to Global and Iranian CTOs, VPs of Engineering, and Tech Recruiters.

It models dual payment ecosystems, chaos engineering scenarios (network latency spikes, payment gateway degradation, network partitions), self-healing circuit breakers, idempotency key guarantees, and real-time DAG (Directed Acyclic Graph) transaction pipelines.

---

## 2. Dual-Ecosystem Contract

The application operates under two distinct localized payment ecosystems switchable in real time:

| Specification | Global Ecosystem (`GLOBAL_STRIPE`) | Iranian Ecosystem (`IRAN_SHAPARAK`) |
| :--- | :--- | :--- |
| **Locale & Direction** | `en` (English), `dir="ltr"` | `fa` (Persian), `dir="rtl"` |
| **Typography** | `Inter`, `JetBrains Mono` | `Vazirmatn`, `JetBrains Mono` |
| **Payment Rails** | Stripe (Credit/Debit) + Klarna BNPL | Shaparak IPG (Saman/Mellat/Parsian) + SnappPay BNPL |
| **Currency** | USD (`$`) | Iranian Toman (`تومان`) |
| **Failure Modes** | Card decline (e.g., `do_not_honor`), 3DS timeouts, Stripe 500s | Shaparak error codes (e.g. 11/14/41/55), Card expiration |
| **Special Simulation** | Global multi-region routing & currency conversion | VPN Warning Simulation (alerting user if non-Iran IP is detected for IPG callback security) |

---

## 3. Strict Stack & Code Standards

- **Framework**: Next.js App Router (React 19, Server & Client component clarity).
- **TypeScript**: `strict: true`, zero `any` usage (`unknown` + type narrowing or Zod parsing required).
- **CSS & Design Tokens**: Tailwind CSS paired with a **3-tier CSS Custom Property Design Token** architecture:
  - **Tier 1 (Primitives)**: Palette hues, scale baselines, base spacing.
  - **Tier 2 (Semantics)**: Purpose-driven abstractions (`--surface-primary`, `--accent-brand`, `--text-muted`, `--border-subtle`, `--status-danger`).
  - **Tier 3 (Component/Context)**: Component-specific variables (`--header-height`, `--card-elevation`).
  - **Hardcoded hex/raw arbitrary px in components are strictly prohibited.**
- **State Management**: Zustand for atomic client state.
- **Schema & Validation**: Zod for all transactional payloads, configurations, and API inputs.
- **Icons**: `lucide-react`.
- **Utilities**: `clsx` and `tailwind-merge` via `cn(...)` utility helper.

---

## 4. Architectural Boundaries & Directory Isolation

```
src/
├── app/                  # Next.js App Router (routes, layouts, providers)
├── components/           # Atomic Design hierarchy
│   ├── atoms/            # Pure UI building blocks (Button, Badge, StatusDot)
│   ├── molecules/        # Interactive composites (EcosystemSwitch, XRayBadge)
│   └── organisms/        # Domain features (Header, ChaosController, DAGVisualizer)
├── core/                 # Pure TypeScript domain logic (NO React imports allowed)
│   ├── circuit-breaker/  # State machine (Closed, Open, Half-Open)
│   ├── idempotency/      # Distributed token & deduplication simulation
│   ├── dag/              # Transaction pipeline dependency graph solver
│   └── vpn/              # Iran IP/VPN heuristic detection simulator
├── design-tokens/        # 3-tier CSS token definitions (tokens.css)
├── schemas/              # Zod contracts & type definitions
├── store/                # Zustand client stores
└── lib/                  # Shared helper utilities (e.g., cn)
```

### Strict Rules:
1. **`src/core/` Isolation**: Pure TypeScript logic only. **Zero React imports** (`import React from 'react'` is forbidden). Must be 100% unit-testable in isolation.
2. **`src/schemas/` First**: All data structures crossing boundaries must have a single source of truth defined with Zod and exported as inferred TS types.
3. **Atomic Hierarchy**: `atoms` must not import `molecules` or `organisms`. `molecules` must not import `organisms`.
