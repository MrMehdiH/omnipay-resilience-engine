# CLAUDE.md - System Rules & Architecture

## 1. Project: Omnipay Resilience Engine
Zero-Auth Interactive Sandbox demonstrating Idempotency, DAG-based transaction state machines, and Growth Loop economics.

## 2. Dual-Ecosystem Localization
- **Global Mode (en, LTR):** Stripe + Klarna BNPL, USD metrics, Edge Webhook latency.
- **Iran Mode (fa, RTL):** Shaparak IPG + SnappPay BNPL, Toman formatting, Vazirmatn font, VPN-active latency warning.

## 3. Directory Structure (Strictly Isolated Core)
- `src/core/`: Pure TypeScript, zero React/DOM imports. Must be environment-agnostic.
- `src/core/dag/`: Idempotency registry and DAG state machine logic.
- `src/core/growth-engine/`: Unit economics and BNPL calculator.
- `src/schemas/`: Zod schemas defining all system I/O boundaries.

## 4. Strict Technical Constraints
- **Stack:** Next.js 16.4.2 (App Router), TypeScript (strict: true, zero any), Tailwind CSS, Zustand, Zod, Vitest.
- **Styling:** 3-tier CSS custom property Design Tokens. Absolutely NO hardcoded hex/px values.
- **State Management:** Shared states like `vpnDetected` must be read from a single Zustand atom to prevent desync between `ChaosConfig` and DAG dependencies.

## 5. UI & Core Contracts
- **Intent-Based Identity:** `transactionId` and `idempotencyKey` MUST be generated ONCE per purchase intent, not per click. Fingerprint hashes payload to detect manipulation.
- **Cart Lock Re-entrancy:** The `CART_LOCK` node must execute before `IDEMPOTENCY`. The lock is re-entrant for a specific key, preventing tab/intent contention while allowing the registry to handle double-clicks.
- **Registry Scope:** The IdempotencyRegistry operates in-process (single node). Exactly-once guarantees across multiple nodes require a distributed lock (e.g., Redis `SET NX PX`). Cryptographic tamper checks must use SHA-256 on the backend, while `cyrb53` is used here for fast client-side fail-fast.

## 6. Graph & Money Logic
- **DAG Definition:** The transaction graph is bounded. `GATEWAY ⇄ RETRY_BACKOFF` is the only cycle, resolving into a DAG of max depth (4 + 2·maxAttempts).
- **Shaparak Codes:** 
  - Code 11 is VIP Approved (Success).
  - Hard Declines (Non-retryable): 14, 41, 51, 54, 55.
  - Transient Errors (Retryable): 91, 96.
- **Failure Routing:**
  - Hard Decline -> Compensate ledger entry.
  - Ambiguous State (Timeout/Invalid Response/Exhausted Retries) -> DEAD_LETTERED (DLQ). **Never auto-refund ambiguous states.**
  - Adapter Contract Violation (Zod parse fail) -> DEAD_LETTERED.