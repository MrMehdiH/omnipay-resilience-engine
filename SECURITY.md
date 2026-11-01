# Security Policy

OmniPay Resilience Engine is an **in-browser simulation** of payment-resilience patterns
(idempotency, status inquiry, retry with backoff, dead-lettering) for the Global (Stripe / Klarna)
and Iranian (Shaparak / SnappPay) rails. It is published as a static site on GitHub Pages.

**It does not process real payments.** It has no backend, collects no card data, sets no cookies,
uses no browser storage and makes no network calls at runtime. All gateway adapters are simulators.

This policy explains what counts as a vulnerability in that context, how to report one, and what
to expect after you do.

---

## Supported versions

| Version / branch | Supported |
| --- | --- |
| `main` (deployed to GitHub Pages) | ✅ |
| Any other branch, fork or tag | ❌ |

The project is pre-1.0. Fixes land on `main` only and ship with the next Pages deployment.

---

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.**

1. **Preferred:** use GitHub's private reporting. On the repository page, open
   **Security → Report a vulnerability**. The report stays private between you and the maintainer.
2. **Fallback:** email **mr.mhd.2000p@gmail.com** with the subject `[SECURITY] omnipay-resilience-engine`.

Reports in **English or Persian (فارسی)** are welcome.

A useful report includes:

- the affected file, function or URL, and the commit SHA you tested;
- step-by-step reproduction, ideally as a failing Vitest test or a chaos-config + seed;
- the impact you believe it has, and against which threat in the [scope](#scope) below.

### What happens next

This is a single-maintainer project, so the targets below are best-effort commitments, not an SLA.

| Stage | Target |
| --- | --- |
| Acknowledgement | within **3 business days** |
| Triage and severity assessment (CVSS v4.0) | within **10 business days** |
| Fix or mitigation for High / Critical | within **30 days** of triage |
| Public disclosure | after a fix ships, or at **90 days**, whichever is first, coordinated with you |

Fixes are released through a GitHub Security Advisory and credited to the reporter unless you ask
to stay anonymous. There is no bug bounty.

### Safe harbour

Good-faith research that follows this policy will not be pursued legally. Stay within the
repository, the GitHub Pages site and your own local clone. Do not attack GitHub infrastructure,
other users, or any real payment provider (Stripe, Klarna, Shaparak PSPs, SnappPay) while testing.

---

## Scope

Because no money moves, the interesting attack surface is **the correctness guarantees the engine
claims** and **the supply chain that builds and deploys it**.

### In scope

**1. Violations of the core money-safety invariants** in `src/core/` and `src/schemas/`.
These are treated as security bugs even though the gateways are simulated, because the core is
written to be reusable with real adapters. Report any input or interleaving that makes the engine:

- execute the gateway **more than once** for one idempotency key (broken single-flight / replay);
- accept a **mutated payload** under an existing key without `IdempotencyConflictError`;
- **re-authorize after an ambiguous outcome** (timeout / socket reset) without a status inquiry first;
- **auto-refund (compensate)** a transaction whose outcome is ambiguous instead of dead-lettering it;
- let a value that fails its Zod schema cross a boundary (payload, gateway outcome, inquiry, telemetry);
- leave a ledger entry in an illegal state transition, or allow cart-lock contention between two intents.

**2. Client-side security of the deployed site:** XSS, HTML/script injection, open redirects,
`target="_blank"` links without `noopener`, or any way to make the page run attacker-controlled code.

**3. Supply chain and CI/CD:** malicious or compromised dependencies, lockfile tampering, GitHub
Actions workflow injection, over-broad `GITHUB_TOKEN` permissions, or any way to publish content to
GitHub Pages without going through `main`.

**4. Secrets:** any credential, token or key committed anywhere in the history.

### Out of scope

These are known, documented properties of a demo. They are not vulnerabilities:

| Property | Why it is out of scope |
| --- | --- |
| `cyrb53` is not cryptographic | It is a fast, client-side fail-fast fingerprint. A production backend must use SHA-256 or HMAC (see `CLAUDE.md`). |
| Idempotency is per browser tab | The registry is in-process by design. Exactly-once across nodes needs a shared store (e.g. Redis `SET NX PX`). |
| Simulated declines, timeouts and VPN geo-blocks | That is the product working as intended. |
| Missing HTTP security headers (CSP, HSTS, etc.) | GitHub Pages does not allow custom response headers. |
| Volumetric DoS against GitHub Pages | Report it to GitHub, not here. |
| Findings only from automated scanners | Please include a concrete, reproducible impact. |
| Vulnerabilities in a dependency with no reachable path in this project | Upstream `npm audit` noise. Do report it if you can show reachability. |

---

## Security design

These properties are deliberate. Changes that weaken them need a test and a justification in the PR.

| Concern | Control | Where |
| --- | --- | --- |
| Duplicate charges (double-click, impatient retry) | Intent-scoped idempotency key, O(1) single-flight registry; concurrent duplicates are coalesced, late duplicates replayed | `src/core/dag/idempotency-engine.ts` |
| Key reuse with a tampered body | Canonical-JSON fingerprint; mismatch → `IdempotencyConflictError` | same |
| Double charge after a lost response | Ambiguous outcomes (`INQUIRE`) go to a status inquiry before any re-authorize; unresolved → DLQ | `src/core/dag/transaction-dag.ts` |
| Refunding money that may have moved | Ambiguous or exhausted states are parked, never compensated | same |
| Untrusted adapter output | Every gateway and inquiry response is Zod-parsed; a contract violation becomes a dead letter, not a guess | `src/schemas/transaction.schema.ts` |
| Malformed input | Strict Zod schemas (unknown keys rejected); integer minor-unit money; HTTPS-only IPG callbacks; Persian-digit normalisation for Iranian mobiles | same |
| Concurrent intents on one cart | Re-entrant per-key cart lease; a second intent is aborted with `CART_LOCKED` | `InMemoryCartLock` |
| Telemetry leaking into money flow | Listener exceptions are swallowed; observers cannot break a payment run | `TransactionDag.emit` |
| Client attack surface | No runtime `fetch`, no cookies or web storage, no `dangerouslySetInnerHTML` or `eval`; external links use `rel="noopener noreferrer"` | `src/app`, `src/components` |
| Regression of the above | Deterministic Vitest suite (injected clock, scheduler and PRNG); typecheck, ESLint and tests gate every PR in CI | `src/**/__tests__`, `.github/workflows/ci.yml` |

---

## Hardening roadmap

Known gaps, listed in the open so reporters do not need to rediscover them:

- [ ] Scope `GITHUB_TOKEN` per job: `contents: read` for verify, and `pages: write` + `id-token: write` only on the deploy job.
- [ ] Pin third-party GitHub Actions to full commit SHAs instead of major-version tags.
- [ ] Enable Dependabot (npm + GitHub Actions) and a scheduled `npm audit --omit=dev` check.
- [ ] Enable CodeQL (JavaScript/TypeScript) and secret scanning with push protection.
- [ ] Protect `main`: require PRs and passing status checks, and block force-pushes.
- [ ] Add a `<meta http-equiv="Content-Security-Policy">` tag, as far as a static export on Pages allows.

---

## Guidance for anyone reusing `src/core/` with real gateways

The core is environment-agnostic and can be wired to real adapters. If you do, the following are
**your** responsibility, and this project makes no guarantee about them:

1. Run the engine **server-side**. Never trust a client-side registry for money movement.
2. Back the idempotency registry and cart lock with a **shared, durable store**, and replace
   `cyrb53` with **SHA-256 / HMAC** fingerprints.
3. Implement `GatewayPort.inquire` against the provider's real status API. For Shaparak PSPs, follow
   the full **redirect → callback → Verify (or Reverse)** flow within the PSP's verification window,
   and verify the callback server-side. Never trust callback parameters alone.
4. Forward the idempotency key to the provider (Stripe `Idempotency-Key`, or the PSP's unique order
   / reservation number) so the provider deduplicates too.
5. Keep card data out of your systems entirely (hosted payment pages / tokenisation) to stay outside
   PCI DSS scope, and never log PANs, CVV2, OTPs or the dynamic password (رمز پویا).
6. Persist dead-lettered transactions and reconcile them against provider settlement reports.
