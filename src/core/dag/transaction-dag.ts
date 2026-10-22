/**
 * @file src/core/dag/transaction-dag.ts
 * @description Event-driven state machine for the checkout pipeline:
 *
 *   CART_LOCK ─▶ IDEMPOTENCY ─▶ OPTIMISTIC ─▶ GATEWAY ─┬─▶ DLQ_OR_COMMIT  (approved → COMMIT)
 *        │            │              │           ▲  │   ├─▶ DLQ_OR_COMMIT  (hard decline → compensate)
 *        │            │              │           │  ▼   └─▶ DLQ_OR_COMMIT  (ambiguous / exhausted → DLQ)
 *        │            │              │       RETRY_BACKOFF
 *        └────────────┴──────────────┴──────────────────▶ DLQ_OR_COMMIT  (ABORTED)
 *
 * The only cycle is GATEWAY ⇄ RETRY_BACKOFF and it is bounded by `RetryPolicy.maxAttempts`,
 * so the unrolled execution graph is a DAG of depth ≤ 4 + 2·maxAttempts.
 *
 * All side effects go through injected ports (cart lock, ledger, gateway, scheduler, clock,
 * RNG) → fully deterministic under test, runnable in Node, Edge and the browser.
 *
 * Environment-agnostic: no React / DOM / Next.js / Node-specific imports.
 */
import {
  ChaosConfigSchema,
  GatewayOutcomeSchema,
  RetryPolicySchema,
  TransactionPayloadSchema,
  type ChaosConfig,
  type DagNodeId,
  type DagNodeState,
  type DagNodeStatus,
  type Ecosystem,
  type GatewayFailure,
  type GatewayOutcome,
  type IdempotencyKey,
  type RetryPolicy,
  type SettlementOutcome,
  type SettlementResult,
  type TelemetryEvent,
  type TransactionPayload,
} from '../../schemas/transaction.schema';
import {
  IdempotencyRegistry,
  fingerprintOf,
  systemClock,
  type Clock,
} from './idempotency-engine';

/* ═══════════════════════════════════════════════════════════════════════════
 * Errors
 * ═══════════════════════════════════════════════════════════════════════════ */

export class TransactionDagError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A transition outside the declared graph was attempted — a programming error, never user input. */
export class InvalidDagTransitionError extends TransactionDagError {
  public constructor(
    public readonly from: DagNodeId | null,
    public readonly to: DagNodeId,
  ) {
    super(`Illegal DAG transition ${from ?? 'START'} → ${to}.`);
  }
}

/** Another checkout intent (different idempotency key) holds this cart. */
export class CartLockContendedError extends TransactionDagError {
  public constructor(
    public readonly cartId: string,
    public readonly heldBy: IdempotencyKey,
  ) {
    super(`Cart "${cartId}" is locked by another checkout intent.`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Transition table — O(1) legality checks
 * ═══════════════════════════════════════════════════════════════════════════ */

const TERMINAL: DagNodeId = 'DLQ_OR_COMMIT';

const TRANSITIONS: Readonly<Record<DagNodeId, ReadonlySet<DagNodeId>>> = {
  CART_LOCK: new Set<DagNodeId>(['IDEMPOTENCY', TERMINAL]),
  IDEMPOTENCY: new Set<DagNodeId>(['OPTIMISTIC', TERMINAL]),
  OPTIMISTIC: new Set<DagNodeId>(['GATEWAY', TERMINAL]),
  GATEWAY: new Set<DagNodeId>(['RETRY_BACKOFF', TERMINAL]),
  RETRY_BACKOFF: new Set<DagNodeId>(['GATEWAY', TERMINAL]),
  DLQ_OR_COMMIT: new Set<DagNodeId>(),
};

export function canTransition(from: DagNodeId, to: DagNodeId): boolean {
  return TRANSITIONS[from].has(to);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Ports (hexagonal boundaries)
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface Scheduler {
  sleep(ms: number): Promise<void>;
}

/**
 * `setTimeout` is a host API (HTML / Node / WinterCG), not ECMAScript. Typing it locally keeps
 * this module compilable without `lib.dom` or `@types/node`, i.e. truly environment-agnostic.
 */
interface TimerHost {
  setTimeout(callback: () => void, ms: number): unknown;
}

function resolveTimerHost(): TimerHost {
  const candidate = (globalThis as { readonly setTimeout?: unknown }).setTimeout;
  if (typeof candidate !== 'function') {
    throw new TransactionDagError('No setTimeout on globalThis; inject a Scheduler explicitly.');
  }
  return globalThis as unknown as TimerHost;
}

export const realTimeScheduler: Scheduler = {
  sleep: (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      resolveTimerHost().setTimeout(resolve, Math.max(0, ms));
    }),
};

/** Uniform random in [0, 1). */
export type RandomSource = () => number;

export interface CartLockHandle {
  release(): void;
}

export interface CartLockPort {
  /** Re-entrant per owner. Throws CartLockContendedError when another owner holds a live lease. */
  acquire(cartId: string, owner: IdempotencyKey, leaseMs: number): Promise<CartLockHandle>;
}

export interface OptimisticLedgerPort {
  /** Optimistically mark the order as paid (UI shows success instantly). */
  reserve(tx: TransactionPayload): Promise<void>;
  /** Gateway approved: make the optimistic entry durable. */
  commit(tx: TransactionPayload, gatewayReference: string): Promise<void>;
  /** Definitive failure: roll the optimistic entry back. */
  compensate(tx: TransactionPayload, failure: GatewayFailure): Promise<void>;
  /** Ambiguous money state: freeze the entry for reconciliation (no rollback, no commit). */
  park(tx: TransactionPayload, failure: GatewayFailure): Promise<void>;
}

export interface GatewayAttemptContext {
  /** 1-based attempt number. */
  readonly attempt: number;
}

export interface GatewayPort {
  /** Must be idempotent on `tx.idempotencyKey` (forward it as Stripe `Idempotency-Key` / IPG `ResNum`). */
  authorize(tx: TransactionPayload, context: GatewayAttemptContext): Promise<unknown>;
}

export type TelemetryListener = (event: TelemetryEvent) => void;

export interface TransactionDagDependencies {
  readonly gateway: GatewayPort;
  readonly ledger: OptimisticLedgerPort;
  readonly cartLock: CartLockPort;
  readonly retryPolicy: RetryPolicy;
  /** Client egress IP looks non-Iranian (VPN on) — drives the Shaparak VPN warning. */
  readonly vpnDetected?: () => boolean;
  readonly registry?: IdempotencyRegistry<SettlementResult>;
  readonly scheduler?: Scheduler;
  readonly clock?: Clock;
  readonly random?: RandomSource;
  /** Cart lease. Must exceed worst-case pipeline time (Iranian SMS OTP can take minutes). Default 5 min. */
  readonly cartLeaseMs?: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Pure helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * AWS "full jitter" exponential backoff: U(0, min(cap, base · 2^(n-1))).
 * Full jitter de-synchronises retry storms after a Shaparak switch outage.
 */
export function computeBackoffDelay(
  policy: RetryPolicy,
  failedAttempt: number,
  random: RandomSource,
): number {
  if (!Number.isSafeInteger(failedAttempt) || failedAttempt < 1) {
    throw new TransactionDagError(`failedAttempt must be a positive integer, received ${failedAttempt}.`);
  }
  const exponent = Math.min(failedAttempt - 1, 30); // guard 2^n overflow
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** exponent);
  const r = random();
  if (!(r >= 0 && r < 1)) {
    throw new TransactionDagError(`RandomSource must return a value in [0, 1), received ${r}.`);
  }
  return Math.floor(r * ceiling);
}

/** Mulberry32: tiny seeded PRNG → reproducible chaos runs. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toDiagnostic(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.length > 512 ? `${text.slice(0, 509)}...` : text;
}

function createInitialNodes(): Record<DagNodeId, DagNodeState> {
  const node = (nodeId: DagNodeId): DagNodeState => ({
    nodeId,
    status: 'PENDING',
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  });
  return {
    CART_LOCK: node('CART_LOCK'),
    IDEMPOTENCY: node('IDEMPOTENCY'),
    OPTIMISTIC: node('OPTIMISTIC'),
    GATEWAY: node('GATEWAY'),
    RETRY_BACKOFF: node('RETRY_BACKOFF'),
    DLQ_OR_COMMIT: node('DLQ_OR_COMMIT'),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Per-run context (no shared mutable state between concurrent transactions)
 * ═══════════════════════════════════════════════════════════════════════════ */

class RunContext {
  public readonly nodes: Record<DagNodeId, DagNodeState> = createInitialNodes();
  public current: DagNodeId | null = null;
  private sequence = 0;

  public constructor(
    public readonly tx: TransactionPayload,
    /** Distinguishes duplicate-click runs of the same transaction → globally unique eventIds. */
    private readonly runId: string,
    private readonly clock: Clock,
    private readonly emit: (event: TelemetryEvent) => void,
  ) {}

  public now(): number {
    return Math.max(0, Math.round(this.clock.now()));
  }

  public base(): {
    eventId: string;
    transactionId: string;
    ecosystem: Ecosystem;
    sequence: number;
    timestamp: number;
  } {
    const sequence = this.sequence;
    this.sequence += 1;
    return {
      eventId: `${this.tx.transactionId}:${this.runId}:${sequence}`,
      transactionId: this.tx.transactionId,
      ecosystem: this.tx.ecosystem,
      sequence,
      timestamp: this.now(),
    };
  }

  public enter(nodeId: DagNodeId): void {
    if (this.current === null ? nodeId !== 'CART_LOCK' : !canTransition(this.current, nodeId)) {
      throw new InvalidDagTransitionError(this.current, nodeId);
    }
    const prev = this.nodes[nodeId];
    const visits = prev.visits + 1;
    this.nodes[nodeId] = { ...prev, status: 'ACTIVE', visits, enteredAt: this.now(), exitedAt: null };
    this.current = nodeId;
    this.emit({ ...this.base(), type: 'NODE_ENTERED', nodeId, attempt: visits });
  }

  public exit(nodeId: DagNodeId, status: Exclude<DagNodeStatus, 'PENDING' | 'ACTIVE'>, error?: string): void {
    const prev = this.nodes[nodeId];
    if (prev.status !== 'ACTIVE' || this.current !== nodeId) {
      throw new TransactionDagError(`Cannot exit node ${nodeId}: it is not the active node.`);
    }
    const exitedAt = this.now();
    this.nodes[nodeId] = {
      ...prev,
      status,
      exitedAt,
      lastError: error ?? prev.lastError,
    };
    this.emit({
      ...this.base(),
      type: 'NODE_EXITED',
      nodeId,
      status,
      durationMs: Math.max(0, exitedAt - (prev.enteredAt ?? exitedAt)),
    });
  }

  /** Mark never-visited nodes as SKIPPED so the visualizer can grey them out. */
  public skipUnvisited(): void {
    for (const id of Object.keys(this.nodes) as DagNodeId[]) {
      const node = this.nodes[id];
      if (node.status === 'PENDING') this.nodes[id] = { ...node, status: 'SKIPPED' };
    }
  }

  public snapshot(): Record<DagNodeId, DagNodeState> {
    return { ...this.nodes };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * The engine
 * ═══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_CART_LEASE_MS = 5 * 60 * 1000;

interface GatewayLoopResult {
  readonly outcome: GatewayOutcome;
  readonly attempts: number;
}

export class TransactionDag {
  private readonly listeners = new Set<TelemetryListener>();
  private runSerial = 0;
  private readonly gateway: GatewayPort;
  private readonly ledger: OptimisticLedgerPort;
  private readonly cartLock: CartLockPort;
  private readonly retryPolicy: RetryPolicy;
  private readonly vpnDetected: () => boolean;
  private readonly registry: IdempotencyRegistry<SettlementResult>;
  private readonly scheduler: Scheduler;
  private readonly clock: Clock;
  private readonly random: RandomSource;
  private readonly cartLeaseMs: number;

  public constructor(deps: TransactionDagDependencies) {
    this.gateway = deps.gateway;
    this.ledger = deps.ledger;
    this.cartLock = deps.cartLock;
    this.retryPolicy = RetryPolicySchema.parse(deps.retryPolicy);
    this.vpnDetected = deps.vpnDetected ?? ((): boolean => false);
    this.clock = deps.clock ?? systemClock;
    this.registry = deps.registry ?? new IdempotencyRegistry<SettlementResult>({ clock: this.clock });
    this.scheduler = deps.scheduler ?? realTimeScheduler;
    this.random = deps.random ?? Math.random;
    this.cartLeaseMs = deps.cartLeaseMs ?? DEFAULT_CART_LEASE_MS;
    if (!Number.isSafeInteger(this.cartLeaseMs) || this.cartLeaseMs <= 0) {
      throw new TransactionDagError(`cartLeaseMs must be a positive integer, received ${this.cartLeaseMs}.`);
    }
  }

  /** Subscribe to telemetry. Returns an unsubscribe function. */
  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Execute a checkout. `rawPayload` is parsed with Zod (fail-fast on malformed input).
   * Business failures (decline, DLQ, contention) are RETURNED as a SettlementResult;
   * only contract violations and programming errors throw.
   */
  public async execute(rawPayload: unknown): Promise<SettlementResult> {
    const tx = TransactionPayloadSchema.parse(rawPayload);
    this.runSerial += 1;
    const ctx = new RunContext(tx, this.runSerial.toString(36), this.clock, (event) => this.emit(event));

    // ── CART_LOCK ───────────────────────────────────────────────────────────
    ctx.enter('CART_LOCK');
    let lock: CartLockHandle;
    try {
      lock = await this.cartLock.acquire(tx.cartId, tx.idempotencyKey, this.cartLeaseMs);
    } catch (error: unknown) {
      const code = error instanceof CartLockContendedError ? 'CART_LOCKED' : 'CART_LOCK_UNAVAILABLE';
      ctx.exit('CART_LOCK', 'FAILED', toDiagnostic(error));
      return this.settle(ctx, 'ABORTED', 0, null, {
        code,
        disposition: 'DECLINE',
        message: toDiagnostic(error),
      }, false);
    }
    ctx.exit('CART_LOCK', 'SUCCEEDED');

    try {
      // ── IDEMPOTENCY ───────────────────────────────────────────────────────
      ctx.enter('IDEMPOTENCY');
      const outcome = await this.registry.execute(tx.idempotencyKey, fingerprintOf(tx), async () => {
        ctx.exit('IDEMPOTENCY', 'SUCCEEDED');
        return this.runClaimed(ctx);
      });

      if (outcome.mode !== 'EXECUTED') {
        // Duplicate click: the original run owns the money movement; we only mirror its result.
        ctx.exit('IDEMPOTENCY', 'SKIPPED');
        this.emit({
          ...ctx.base(),
          type: 'IDEMPOTENCY_REPLAY',
          idempotencyKey: tx.idempotencyKey,
          mode: outcome.mode,
        });
      }
      return outcome.result;
    } catch (error: unknown) {
      // Conflict / capacity errors surface before the claim callback runs.
      if (ctx.current === 'IDEMPOTENCY' && ctx.nodes.IDEMPOTENCY.status === 'ACTIVE') {
        ctx.exit('IDEMPOTENCY', 'FAILED', toDiagnostic(error));
      }
      throw error;
    } finally {
      lock.release();
    }
  }

  /* ─────────────────────────────── internals ─────────────────────────────── */

  /** Runs only for the single winner of the idempotency claim. */
  private async runClaimed(ctx: RunContext): Promise<SettlementResult> {
    const { tx } = ctx;

    // ── OPTIMISTIC ──────────────────────────────────────────────────────────
    ctx.enter('OPTIMISTIC');
    try {
      await this.ledger.reserve(tx);
    } catch (error: unknown) {
      ctx.exit('OPTIMISTIC', 'FAILED', toDiagnostic(error));
      return this.settle(ctx, 'ABORTED', 0, null, {
        code: 'LEDGER_RESERVE_FAILED',
        disposition: 'DECLINE',
        message: toDiagnostic(error),
      }, false);
    }
    ctx.exit('OPTIMISTIC', 'SUCCEEDED');

    // Iran: IPG callbacks are geo-fenced; warn before burning a gateway attempt + SMS OTP.
    if (tx.ecosystem === 'IRAN_SHAPARAK' && this.vpnDetected()) {
      this.emit({
        ...ctx.base(),
        type: 'VPN_WARNING',
        message:
          'Non-Iranian egress IP detected. Shaparak IPG callbacks may be rejected — disable VPN before paying.',
      });
    }

    // ── GATEWAY ⇄ RETRY_BACKOFF ─────────────────────────────────────────────
    const { outcome, attempts } = await this.runGatewayLoop(ctx);

    // ── DLQ_OR_COMMIT ───────────────────────────────────────────────────────
    if (outcome.ok) {
      try {
        await this.ledger.commit(tx, outcome.reference);
      } catch (error: unknown) {
        // Gateway captured money but our ledger failed: the textbook DLQ case.
        const failure: GatewayFailure = {
          code: 'LEDGER_COMMIT_FAILED',
          disposition: 'DEAD_LETTER',
          message: toDiagnostic(error),
        };
        await this.safePark(tx, failure);
        return this.settle(ctx, 'DEAD_LETTERED', attempts, outcome.reference, failure, false);
      }
      return this.settle(ctx, 'COMMITTED', attempts, outcome.reference, null, false);
    }

    const { failure } = outcome;
    if (failure.disposition === 'DECLINE') {
      const compensated = await this.safeCompensate(tx, failure);
      return this.settle(ctx, 'DECLINED', attempts, null, failure, compensated);
    }

    // DEAD_LETTER, or RETRY exhausted → money state is ambiguous; never auto-refund.
    await this.safePark(tx, failure);
    return this.settle(ctx, 'DEAD_LETTERED', attempts, null, failure, false);
  }

  private async runGatewayLoop(ctx: RunContext): Promise<GatewayLoopResult> {
    const { maxAttempts } = this.retryPolicy;

    for (let attempt = 1; ; attempt += 1) {
      ctx.enter('GATEWAY');
      const outcome = await this.callGateway(ctx.tx, attempt);

      if (outcome.ok) {
        ctx.exit('GATEWAY', 'SUCCEEDED');
        return { outcome, attempts: attempt };
      }

      const { failure } = outcome;
      ctx.exit('GATEWAY', 'FAILED', `${failure.code}: ${failure.message}`);

      if (failure.disposition !== 'RETRY' || attempt >= maxAttempts) {
        const final: GatewayOutcome =
          failure.disposition === 'RETRY'
            ? {
                ok: false,
                failure: {
                  code: 'RETRIES_EXHAUSTED',
                  disposition: 'DEAD_LETTER',
                  message: `Gave up after ${attempt} attempt(s); last error ${failure.code}: ${failure.message}`.slice(0, 512),
                },
              }
            : outcome;
        return { outcome: final, attempts: attempt };
      }

      ctx.enter('RETRY_BACKOFF');
      const delayMs = computeBackoffDelay(this.retryPolicy, attempt, this.random);
      this.emit({
        ...ctx.base(),
        type: 'RETRY_SCHEDULED',
        attempt: attempt + 1,
        delayMs,
        failureCode: failure.code,
      });
      await this.scheduler.sleep(delayMs);
      ctx.exit('RETRY_BACKOFF', 'SUCCEEDED');
    }
  }

  /** Gateway adapters are an I/O boundary: their output is Zod-parsed, exceptions are classified. */
  private async callGateway(tx: TransactionPayload, attempt: number): Promise<GatewayOutcome> {
    let raw: unknown;
    try {
      raw = await this.gateway.authorize(tx, { attempt });
    } catch (error: unknown) {
      // Network-level fault (socket reset on VPN drop, DNS, fetch abort): transient.
      return {
        ok: false,
        failure: { code: 'ADAPTER_EXCEPTION', disposition: 'RETRY', message: toDiagnostic(error) },
      };
    }

    const parsed = GatewayOutcomeSchema.safeParse(raw);
    if (!parsed.success) {
      // We cannot tell whether money moved → never retry blindly.
      return {
        ok: false,
        failure: {
          code: 'GATEWAY_CONTRACT_VIOLATION',
          disposition: 'DEAD_LETTER',
          message: parsed.error.message.slice(0, 512),
        },
      };
    }
    return parsed.data;
  }

  private async safeCompensate(tx: TransactionPayload, failure: GatewayFailure): Promise<boolean> {
    try {
      await this.ledger.compensate(tx, failure);
      return true;
    } catch {
      await this.safePark(tx, failure);
      return false;
    }
  }

  private async safePark(tx: TransactionPayload, failure: GatewayFailure): Promise<void> {
    try {
      await this.ledger.park(tx, failure);
    } catch {
      // The settlement result itself (DEAD_LETTERED) is the source of truth for reconciliation.
    }
  }

  private settle(
    ctx: RunContext,
    outcome: SettlementOutcome,
    attempts: number,
    gatewayReference: string | null,
    failure: GatewayFailure | null,
    compensated: boolean,
  ): SettlementResult {
    ctx.enter(TERMINAL);
    ctx.exit(TERMINAL, outcome === 'COMMITTED' ? 'SUCCEEDED' : 'FAILED', failure?.code);
    ctx.skipUnvisited();

    const result: SettlementResult = {
      transactionId: ctx.tx.transactionId,
      ecosystem: ctx.tx.ecosystem,
      outcome,
      attempts,
      gatewayReference,
      failure,
      compensated,
      nodes: ctx.snapshot(),
      settledAt: ctx.now(),
    };

    this.emit({ ...ctx.base(), type: 'SETTLED', outcome, attempts, compensated });
    return result;
  }

  /** Observer faults must never break a payment flow. */
  private emit(event: TelemetryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Swallowed by design: telemetry is best-effort.
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Reference adapters (in-memory / chaos) — for the sandbox and unit tests
 * ═══════════════════════════════════════════════════════════════════════════ */

interface LockLease {
  readonly owner: IdempotencyKey;
  refCount: number;
  expiresAt: number;
}

/** O(1) re-entrant lease lock keyed by cartId. */
export class InMemoryCartLock implements CartLockPort {
  private readonly leases = new Map<string, LockLease>();

  public constructor(private readonly clock: Clock = systemClock) {}

  public acquire(cartId: string, owner: IdempotencyKey, leaseMs: number): Promise<CartLockHandle> {
    const now = this.clock.now();
    const existing = this.leases.get(cartId);

    if (existing !== undefined && existing.expiresAt > now && existing.owner !== owner) {
      return Promise.reject(new CartLockContendedError(cartId, existing.owner));
    }

    let lease: LockLease;
    if (existing !== undefined && existing.expiresAt > now) {
      existing.refCount += 1;
      existing.expiresAt = Math.max(existing.expiresAt, now + leaseMs);
      lease = existing;
    } else {
      lease = { owner, refCount: 1, expiresAt: now + leaseMs };
      this.leases.set(cartId, lease);
    }

    let released = false;
    return Promise.resolve({
      release: (): void => {
        if (released) return; // double-release is a no-op
        released = true;
        lease.refCount -= 1;
        if (lease.refCount <= 0 && this.leases.get(cartId) === lease) {
          this.leases.delete(cartId);
        }
      },
    });
  }
}

export type LedgerEntryStatus = 'RESERVED' | 'COMMITTED' | 'COMPENSATED' | 'PARKED';

export interface LedgerEntry {
  readonly transactionId: string;
  readonly status: LedgerEntryStatus;
  readonly amountMinor: number;
  readonly gatewayReference: string | null;
  readonly failureCode: string | null;
}

/** O(1) in-memory ledger with explicit state-transition guards. */
export class InMemoryOptimisticLedger implements OptimisticLedgerPort {
  private readonly entries = new Map<string, LedgerEntry>();

  public get(transactionId: string): LedgerEntry | undefined {
    return this.entries.get(transactionId);
  }

  public reserve(tx: TransactionPayload): Promise<void> {
    if (this.entries.has(tx.transactionId)) {
      return Promise.reject(new TransactionDagError(`Ledger entry ${tx.transactionId} already exists.`));
    }
    this.entries.set(tx.transactionId, {
      transactionId: tx.transactionId,
      status: 'RESERVED',
      amountMinor: tx.amountMinor,
      gatewayReference: null,
      failureCode: null,
    });
    return Promise.resolve();
  }

  public commit(tx: TransactionPayload, gatewayReference: string): Promise<void> {
    return this.transition(tx.transactionId, 'COMMITTED', { gatewayReference });
  }

  public compensate(tx: TransactionPayload, failure: GatewayFailure): Promise<void> {
    return this.transition(tx.transactionId, 'COMPENSATED', { failureCode: failure.code });
  }

  public park(tx: TransactionPayload, failure: GatewayFailure): Promise<void> {
    return this.transition(tx.transactionId, 'PARKED', { failureCode: failure.code });
  }

  private transition(
    transactionId: string,
    status: LedgerEntryStatus,
    patch: Partial<Pick<LedgerEntry, 'gatewayReference' | 'failureCode'>>,
  ): Promise<void> {
    const entry = this.entries.get(transactionId);
    if (entry === undefined || entry.status !== 'RESERVED') {
      return Promise.reject(
        new TransactionDagError(
          `Ledger entry ${transactionId} cannot move to ${status} from ${entry?.status ?? 'MISSING'}.`,
        ),
      );
    }
    this.entries.set(transactionId, { ...entry, ...patch, status });
    return Promise.resolve();
  }
}

/* ── Chaos gateway: dual-ecosystem failure catalogue ───────────────────────── */

interface FailureTemplate {
  readonly code: string;
  readonly message: string;
}

/** Stripe decline_code values (hard declines → user must change card). */
const STRIPE_HARD_DECLINES: readonly FailureTemplate[] = [
  { code: 'do_not_honor', message: 'Card declined by issuer (do_not_honor).' },
  { code: 'insufficient_funds', message: 'Card has insufficient funds.' },
  { code: 'expired_card', message: 'Card has expired.' },
];

const STRIPE_TRANSIENT: readonly FailureTemplate[] = [
  { code: 'api_error', message: 'Stripe returned HTTP 500.' },
  { code: 'rate_limit', message: 'Stripe returned HTTP 429.' },
];

/** ISO-8583 response codes surfaced by Shaparak-connected issuers. */
const SHAPARAK_HARD_DECLINES: readonly FailureTemplate[] = [
  { code: '14', message: 'کد ۱۴: شماره کارت نامعتبر است.' },
  { code: '41', message: 'کد ۴۱: کارت مفقودی است.' },
  { code: '51', message: 'کد ۵۱: موجودی کافی نیست.' },
  { code: '54', message: 'کد ۵۴: تاریخ انقضای کارت گذشته است.' },
  { code: '55', message: 'کد ۵۵: رمز کارت (رمز پویا) اشتباه است.' },
];

const SHAPARAK_TRANSIENT: readonly FailureTemplate[] = [
  { code: '91', message: 'کد ۹۱: سوییچ یا صادرکننده در دسترس نیست.' },
  { code: '96', message: 'کد ۹۶: خطای سیستمی شاپرک.' },
];

/**
 * Deterministic chaos gateway. Latency = base + U(0, jitter) (+ SMS-OTP latency on Shaparak).
 * Evaluation order mirrors reality: partition → timeout → geo-block → issuer response.
 */
export class ChaosGatewaySimulator implements GatewayPort {
  private readonly config: ChaosConfig;
  private readonly random: RandomSource;
  private readonly scheduler: Scheduler;
  private referenceCounter = 0;

  public constructor(rawConfig: unknown, scheduler: Scheduler = realTimeScheduler) {
    this.config = ChaosConfigSchema.parse(rawConfig);
    this.random = createSeededRandom(this.config.seed);
    this.scheduler = scheduler;
  }

  public async authorize(tx: TransactionPayload, _context: GatewayAttemptContext): Promise<GatewayOutcome> {
    const c = this.config;
    const isIran = tx.ecosystem === 'IRAN_SHAPARAK';

    if (!c.enabled) {
      await this.scheduler.sleep(c.latency.baseMs);
      return this.approve(isIran);
    }

    const latencyMs =
      c.latency.baseMs + Math.floor(this.random() * c.latency.jitterMs) + (isIran ? c.smsOtpLatencyMs : 0);

    if (c.networkPartition) {
      await this.scheduler.sleep(Math.min(latencyMs, c.gatewayTimeoutMs));
      return this.fail('NETWORK_PARTITION', 'RETRY', 'Gateway unreachable (network partition).');
    }

    if (latencyMs > c.gatewayTimeoutMs) {
      await this.scheduler.sleep(c.gatewayTimeoutMs);
      return this.fail(
        isIran ? 'IPG_TIMEOUT' : '3ds_timeout',
        'RETRY',
        `No response within ${c.gatewayTimeoutMs}ms (simulated latency ${latencyMs}ms).`,
      );
    }

    await this.scheduler.sleep(latencyMs);

    if (isIran && c.vpnDetected) {
      return this.fail('IPG_GEO_BLOCKED', 'DECLINE', 'IPG rejected a non-Iranian client IP (VPN active).');
    }

    if (this.random() < c.gatewayFailureRate) {
      const hard = this.random() < c.hardDeclineRatio;
      const catalogue = isIran
        ? hard ? SHAPARAK_HARD_DECLINES : SHAPARAK_TRANSIENT
        : hard ? STRIPE_HARD_DECLINES : STRIPE_TRANSIENT;
      const template = this.pick(catalogue);
      return this.fail(template.code, hard ? 'DECLINE' : 'RETRY', template.message);
    }

    return this.approve(isIran);
  }

  private approve(isIran: boolean): GatewayOutcome {
    this.referenceCounter += 1;
    const suffix = Math.floor(this.random() * 0xffffff).toString(16).padStart(6, '0');
    return {
      ok: true,
      reference: `${isIran ? 'shp_rrn' : 'pi'}_${this.referenceCounter.toString(36)}${suffix}`,
    };
  }

  private fail(code: string, disposition: GatewayFailure['disposition'], message: string): GatewayOutcome {
    return { ok: false, failure: { code, disposition, message } };
  }

  private pick(catalogue: readonly FailureTemplate[]): FailureTemplate {
    const template = catalogue[Math.floor(this.random() * catalogue.length)];
    if (template === undefined) {
      throw new TransactionDagError('Failure catalogue is empty.');
    }
    return template;
  }
}