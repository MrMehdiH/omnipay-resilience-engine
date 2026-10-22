/**
 * @file src/core/dag/idempotency-engine.ts
 * @description In-process idempotency registry that collapses duplicate checkout intents
 * (double-clicks, impatient retries during Shaparak SMS-OTP latency, client retries after a
 * VPN-induced socket drop) into exactly one execution.
 *
 * Guarantees
 *  - O(1) lookup, claim, completion and eviction (hash maps + insertion-ordered expiry).
 *  - Concurrent duplicates while a run is IN FLIGHT are COALESCED onto the same Promise
 *    (single-flight); duplicates after completion are REPLAYED from the cached result.
 *  - Same key + different payload fingerprint → IdempotencyConflictError (fail-fast, matches
 *    Stripe's semantics for key reuse with a mutated body).
 *  - Thrown operations are NOT cached: a crash/infrastructure fault releases the key so the
 *    caller can retry. Business outcomes (declines, DLQ) must be *returned*, not thrown.
 *
 * Environment-agnostic: no React / DOM / Next.js / Node-specific imports.
 */
import { IdempotencyKeySchema, type IdempotencyKey } from '../../schemas/transaction.schema';

/* ═══════════════════════════════════════════════════════════════════════════
 * Errors
 * ═══════════════════════════════════════════════════════════════════════════ */

export class IdempotencyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The same key was presented with a different request body. */
export class IdempotencyConflictError extends IdempotencyError {
  public constructor(
    public readonly key: IdempotencyKey,
    public readonly expectedFingerprint: string,
    public readonly receivedFingerprint: string,
  ) {
    super(
      `Idempotency key "${key}" was reused with a different payload ` +
        `(expected fingerprint ${expectedFingerprint}, received ${receivedFingerprint}).`,
    );
  }
}

/** Registry is saturated with in-flight work; refusing is safer than evicting a live claim. */
export class IdempotencyCapacityError extends IdempotencyError {
  public constructor(public readonly capacity: number) {
    super(`Idempotency registry is at capacity (${capacity} in-flight keys); refusing new claims.`);
  }
}

export class IdempotencyConfigError extends IdempotencyError {}

/* ═══════════════════════════════════════════════════════════════════════════
 * Public contracts
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: (): number => Date.now() };

export interface IdempotencyRegistryOptions {
  /** How long a completed result stays replayable. Default: 24h (Stripe's window). */
  readonly ttlMs?: number;
  /** Max completed entries retained; oldest are evicted first in O(1). Default: 10_000. */
  readonly maxCompletedEntries?: number;
  /** Max concurrent in-flight keys before claims are refused. Default: 10_000. */
  readonly maxInFlightEntries?: number;
  readonly clock?: Clock;
}

export type IdempotencyMode = 'EXECUTED' | 'COALESCED' | 'REPLAYED';

export interface IdempotencyOutcome<TResult> {
  readonly mode: IdempotencyMode;
  readonly result: TResult;
}

export type IdempotencyLookup<TResult> =
  | { readonly state: 'ABSENT' }
  | { readonly state: 'IN_FLIGHT'; readonly fingerprint: string }
  | { readonly state: 'COMPLETED'; readonly fingerprint: string; readonly result: TResult };

export interface IdempotencyStats {
  readonly inFlight: number;
  readonly completed: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Internal entries
 * ═══════════════════════════════════════════════════════════════════════════ */

interface InFlightEntry<TResult> {
  readonly fingerprint: string;
  readonly promise: Promise<TResult>;
}

interface CompletedEntry<TResult> {
  readonly fingerprint: string;
  readonly result: TResult;
  readonly expiresAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_COMPLETED = 10_000;
const DEFAULT_MAX_IN_FLIGHT = 10_000;

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new IdempotencyConfigError(`${name} must be a positive safe integer, received ${value}.`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Registry
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Two maps instead of one:
 *  - `inFlight` holds live claims (never evicted by capacity pressure).
 *  - `completed` is written on completion with a constant TTL, so JS Map insertion order is
 *    exactly expiry order → expired entries are always at the head and are swept in
 *    O(expired) total, i.e. amortised O(1) per operation. No heap, no O(n) scan.
 *
 * Note: this is a per-process registry (one browser tab / one server instance). Cross-node
 * exactly-once requires the same contract backed by a shared store (Redis `SET NX PX`).
 */
export class IdempotencyRegistry<TResult> {
  private readonly inFlight = new Map<IdempotencyKey, InFlightEntry<TResult>>();
  private readonly completed = new Map<IdempotencyKey, CompletedEntry<TResult>>();
  private readonly ttlMs: number;
  private readonly maxCompletedEntries: number;
  private readonly maxInFlightEntries: number;
  private readonly clock: Clock;

  public constructor(options: IdempotencyRegistryOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxCompletedEntries = options.maxCompletedEntries ?? DEFAULT_MAX_COMPLETED;
    this.maxInFlightEntries = options.maxInFlightEntries ?? DEFAULT_MAX_IN_FLIGHT;
    this.clock = options.clock ?? systemClock;

    assertPositiveInteger('ttlMs', this.ttlMs);
    assertPositiveInteger('maxCompletedEntries', this.maxCompletedEntries);
    assertPositiveInteger('maxInFlightEntries', this.maxInFlightEntries);
  }

  /**
   * Run `operation` at most once per key.
   * @throws IdempotencyConflictError when the key is reused with a different fingerprint.
   * @throws IdempotencyCapacityError when too many keys are in flight.
   * @throws whatever `operation` throws (the key is released so a retry is possible).
   */
  public async execute(
    rawKey: string,
    fingerprint: string,
    operation: () => Promise<TResult>,
  ): Promise<IdempotencyOutcome<TResult>> {
    const key = IdempotencyKeySchema.parse(rawKey);
    if (fingerprint.length === 0) {
      throw new IdempotencyConfigError('Fingerprint must be a non-empty string.');
    }

    const now = this.clock.now();
    this.sweepExpired(now);

    const done = this.completed.get(key);
    if (done !== undefined) {
      this.assertFingerprint(key, done.fingerprint, fingerprint);
      return { mode: 'REPLAYED', result: done.result };
    }

    const live = this.inFlight.get(key);
    if (live !== undefined) {
      this.assertFingerprint(key, live.fingerprint, fingerprint);
      return { mode: 'COALESCED', result: await live.promise };
    }

    if (this.inFlight.size >= this.maxInFlightEntries) {
      throw new IdempotencyCapacityError(this.maxInFlightEntries);
    }

    // Claim synchronously (before any await) → a second click in the same tick sees IN_FLIGHT.
    const claim: { entry: InFlightEntry<TResult> | null } = { entry: null };
    const promise = this.runAndRecord(key, fingerprint, operation, claim);
    claim.entry = { fingerprint, promise };
    this.inFlight.set(key, claim.entry);

    return { mode: 'EXECUTED', result: await promise };
  }

  /** O(1) non-mutating inspection (expired entries report ABSENT). */
  public lookup(rawKey: string): IdempotencyLookup<TResult> {
    const key = IdempotencyKeySchema.parse(rawKey);
    const live = this.inFlight.get(key);
    if (live !== undefined) return { state: 'IN_FLIGHT', fingerprint: live.fingerprint };

    const done = this.completed.get(key);
    if (done !== undefined && done.expiresAt > this.clock.now()) {
      return { state: 'COMPLETED', fingerprint: done.fingerprint, result: done.result };
    }
    return { state: 'ABSENT' };
  }

  /** Explicitly forget a completed key (e.g. after manual DLQ reconciliation). In-flight keys are immune. */
  public invalidate(rawKey: string): boolean {
    const key = IdempotencyKeySchema.parse(rawKey);
    return this.completed.delete(key);
  }

  public stats(): IdempotencyStats {
    this.sweepExpired(this.clock.now());
    return { inFlight: this.inFlight.size, completed: this.completed.size };
  }

  public clear(): void {
    this.completed.clear();
    // In-flight promises still resolve for their awaiters; they just won't be recorded.
    this.inFlight.clear();
  }

  /* ─────────────────────────────── internals ─────────────────────────────── */

  private async runAndRecord(
    key: IdempotencyKey,
    fingerprint: string,
    operation: () => Promise<TResult>,
    claim: { readonly entry: InFlightEntry<TResult> | null },
  ): Promise<TResult> {
    // Yield once so the claim is registered before user code runs, even if `operation`
    // completes synchronously.
    await Promise.resolve();
    try {
      const result = await operation();
      // Only record if our claim survived (a `clear()` mid-flight voids it).
      if (this.inFlight.get(key) === claim.entry) {
        this.recordCompletion(key, fingerprint, result);
      }
      return result;
    } finally {
      // Identity check: never release a newer claim for the same key.
      if (this.inFlight.get(key) === claim.entry) {
        this.inFlight.delete(key);
      }
    }
  }

  private recordCompletion(key: IdempotencyKey, fingerprint: string, result: TResult): void {
    const now = this.clock.now();
    this.completed.delete(key); // keep insertion order == expiry order
    this.completed.set(key, { fingerprint, result, expiresAt: now + this.ttlMs });

    while (this.completed.size > this.maxCompletedEntries) {
      const oldest = this.completed.keys().next();
      if (oldest.done === true) break;
      this.completed.delete(oldest.value);
    }
  }

  private sweepExpired(now: number): void {
    for (const [key, entry] of this.completed) {
      if (entry.expiresAt > now) break; // head is the soonest-to-expire → stop at first live entry
      this.completed.delete(key);
    }
  }

  private assertFingerprint(key: IdempotencyKey, expected: string, received: string): void {
    if (expected !== received) {
      throw new IdempotencyConflictError(key, expected, received);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Fingerprinting (deterministic, dependency-free, runtime-agnostic)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Canonical JSON: object keys sorted, `undefined` members dropped. Throws on values that
 * cannot be represented deterministically (functions, symbols, bigint, cycles, non-finite numbers).
 */
export function canonicalize(value: unknown): string {
  return canonicalizeInner(value, new Set<object>());
}

function canonicalizeInner(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new IdempotencyError(`Cannot fingerprint non-finite number ${String(value)}.`);
      }
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      throw new IdempotencyError(`Cannot fingerprint value of type "${typeof value}".`);
  }

  const obj = value as object;
  if (ancestors.has(obj)) {
    throw new IdempotencyError('Cannot fingerprint a cyclic structure.');
  }
  ancestors.add(obj);
  try {
    if (Array.isArray(obj)) {
      const items: string[] = [];
      for (const item of obj as readonly unknown[]) {
        items.push(item === undefined ? 'null' : canonicalizeInner(item, ancestors));
      }
      return `[${items.join(',')}]`;
    }

    const record = obj as Readonly<Record<string, unknown>>;
    const parts: string[] = [];
    for (const k of Object.keys(record).sort()) {
      const member = record[k];
      if (member === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${canonicalizeInner(member, ancestors)}`);
    }
    return `{${parts.join(',')}}`;
  } finally {
    ancestors.delete(obj);
  }
}

/**
 * cyrb53 — fast 53-bit non-cryptographic hash. Sufficient for detecting key reuse with a
 * mutated body; NOT a security primitive (use SHA-256 server-side for tamper evidence).
 */
export function hash53(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, '0');
}

export function fingerprintOf(value: unknown): string {
  return hash53(canonicalize(value));
}