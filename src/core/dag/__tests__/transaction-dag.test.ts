/**
 * @file src/core/dag/__tests__/transaction-dag.test.ts
 * @description Deterministic unit tests for the TransactionDag state machine.
 *
 * Determinism strategy — every source of nondeterminism is injected:
 *  - Clock      → ManualClock (fixed epoch, never reads Date.now()).
 *  - Scheduler  → instantScheduler (no real timers, backoff resolves immediately).
 *  - Random     → createSeededRandom(seed) (Mulberry32).
 *  - IDs        → fixed UUID / idempotency-key literals (no crypto.randomUUID()).
 *  - Concurrency→ GatedGateway holds the first gateway call open on a manual latch, so
 *                 "in flight" is a guaranteed state, not a timing accident.
 *
 * Environment-agnostic: no React / DOM / Next.js / Node-specific imports.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  TelemetryEventSchema,
  SettlementResultSchema,
  type ChaosConfig,
  type GatewayOutcome,
  type GlobalTransactionPayload,
  type RetryPolicy,
  type TelemetryEvent,
  type TransactionPayload,
  type TransactionPayloadInput,
} from '../../../schemas/transaction.schema';
import { IdempotencyConflictError, type Clock } from '../idempotency-engine';
import {
  ChaosGatewaySimulator,
  InMemoryCartLock,
  InMemoryOptimisticLedger,
  TransactionDag,
  createSeededRandom,
  type GatewayAttemptContext,
  type GatewayPort,
  type Scheduler,
} from '../transaction-dag';

/* ═══════════════════════════════════════════════════════════════════════════
 * Deterministic test doubles
 * ═══════════════════════════════════════════════════════════════════════════ */

const FIXED_EPOCH_MS = 1_793_000_000_000;

class ManualClock implements Clock {
  private current: number;

  public constructor(start: number = FIXED_EPOCH_MS) {
    this.current = start;
  }

  public now(): number {
    return this.current;
  }

  public advance(ms: number): void {
    this.current += ms;
  }
}

/** Backoff and simulated latency resolve on the next microtask — no wall-clock time. */
const instantScheduler: Scheduler = {
  sleep: (): Promise<void> => Promise.resolve(),
};

/** Manually released latch. */
interface Latch {
  readonly promise: Promise<void>;
  release(): void;
}

function createLatch(): Latch {
  let release: () => void = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: (): void => release() };
}

/** Records every authorize() call, then delegates. */
class CountingGateway implements GatewayPort {
  public readonly calls: GatewayAttemptContext[] = [];

  public constructor(private readonly inner: GatewayPort) {}

  public authorize(tx: TransactionPayload, context: GatewayAttemptContext): Promise<unknown> {
    this.calls.push(context);
    return this.inner.authorize(tx, context);
  }
}

/**
 * Blocks every authorize() call until `latch.release()` is called, then returns `outcome`.
 * Exposes `entered` so a test can await "the gateway is now in flight".
 */
class GatedGateway implements GatewayPort {
  public readonly latch: Latch = createLatch();
  public callCount = 0;
  private readonly enteredLatch: Latch = createLatch();

  public constructor(private readonly outcome: GatewayOutcome) {}

  public get entered(): Promise<void> {
    return this.enteredLatch.promise;
  }

  public async authorize(_tx: TransactionPayload, _context: GatewayAttemptContext): Promise<unknown> {
    this.callCount += 1;
    this.enteredLatch.release();
    await this.latch.promise;
    return this.outcome;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Fixtures
 * ═══════════════════════════════════════════════════════════════════════════ */

const RETRY_POLICY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2_000 };

const APPROVED_REFERENCE = 'pi_test_approved_0001';
const APPROVED: GatewayOutcome = { ok: true, reference: APPROVED_REFERENCE };

function chaosConfig(overrides: Partial<ChaosConfig> = {}): ChaosConfig {
  return {
    enabled: true,
    seed: 42,
    latency: { baseMs: 100, jitterMs: 50 },
    gatewayTimeoutMs: 5_000,
    gatewayFailureRate: 0,
    hardDeclineRatio: 0,
    networkPartition: false,
    vpnDetected: false,
    smsOtpLatencyMs: 0,
    ...overrides,
  };
}

type IntentOverrides = Partial<Pick<GlobalTransactionPayload, 'transactionId' | 'idempotencyKey'>>;

function globalPayload(overrides: IntentOverrides = {}): GlobalTransactionPayload {
  return {
    transactionId: '11111111-1111-4111-8111-111111111111',
    idempotencyKey: 'intent_global_000000000001',
    cartId: 'cart-global-1',
    customerId: 'cus_global_1',
    amountMinor: 4_999,
    createdAt: FIXED_EPOCH_MS,
    ecosystem: 'GLOBAL_STRIPE',
    currency: 'USD',
    rail: 'STRIPE_CARD',
    region: 'eu-west-1',
    ...overrides,
  };
}

function iranPayload(): TransactionPayloadInput & { readonly transactionId: string } {
  return {
    transactionId: '22222222-2222-4222-8222-222222222222',
    idempotencyKey: 'intent_iran_00000000000001',
    cartId: 'cart-iran-1',
    customerId: 'cus_iran_1',
    amountMinor: 2_500_000,
    createdAt: FIXED_EPOCH_MS,
    ecosystem: 'IRAN_SHAPARAK',
    currency: 'IRT',
    rail: 'SHAPARAK_MELLAT',
    mobile: '+98 ۹۱۲ ۳۴۵ ۶۷۸۹',
    callbackUrl: 'https://shop.example.ir/payment/callback',
  };
}

interface Harness {
  readonly dag: TransactionDag;
  readonly ledger: InMemoryOptimisticLedger;
  readonly events: TelemetryEvent[];
  readonly clock: ManualClock;
}

interface HarnessOptions {
  readonly gateway: GatewayPort;
  readonly vpnDetected?: boolean;
}

function createHarness(options: HarnessOptions): Harness {
  const clock = new ManualClock();
  const ledger = new InMemoryOptimisticLedger();
  // Single source of truth for VPN state, mirroring the single Zustand atom contract.
  const vpnDetected = options.vpnDetected ?? false;

  const dag = new TransactionDag({
    gateway: options.gateway,
    ledger,
    cartLock: new InMemoryCartLock(clock),
    retryPolicy: RETRY_POLICY,
    scheduler: instantScheduler,
    clock,
    random: createSeededRandom(1),
    vpnDetected: (): boolean => vpnDetected,
  });

  const events: TelemetryEvent[] = [];
  dag.subscribe((event: TelemetryEvent): void => {
    // Telemetry is an I/O boundary: every emitted event must satisfy the schema.
    events.push(TelemetryEventSchema.parse(event));
  });

  return { dag, ledger, events, clock };
}

function eventsOfType<TType extends TelemetryEvent['type']>(
  events: readonly TelemetryEvent[],
  type: TType,
): Extract<TelemetryEvent, { type: TType }>[] {
  return events.filter(
    (event): event is Extract<TelemetryEvent, { type: TType }> => event.type === type,
  );
}

function gatewayEntries(events: readonly TelemetryEvent[]): number {
  return eventsOfType(events, 'NODE_ENTERED').filter((event) => event.nodeId === 'GATEWAY').length;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Tests
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('TransactionDag', () => {
  let payload: GlobalTransactionPayload;

  beforeEach(() => {
    payload = globalPayload();
  });

  /* ── 1. Double-click race ─────────────────────────────────────────────── */
  describe('double-click race condition', () => {
    it('coalesces concurrent clicks into exactly one gateway call and one shared result', async () => {
      const gateway = new GatedGateway(APPROVED);
      const { dag, ledger, events } = createHarness({ gateway });

      const firstClick = dag.execute(payload);
      await gateway.entered; // first run is now provably in flight inside GATEWAY
      const secondClick = dag.execute(payload);

      gateway.latch.release();
      const [first, second] = await Promise.all([firstClick, secondClick]);

      expect(gateway.callCount).toBe(1);
      expect(gatewayEntries(events)).toBe(1);

      expect(second).toBe(first); // same object → same settlement, no second money movement
      expect(first.outcome).toBe('COMMITTED');
      expect(first.gatewayReference).toBe(APPROVED_REFERENCE);
      expect(SettlementResultSchema.safeParse(first).success).toBe(true);

      const replays = eventsOfType(events, 'IDEMPOTENCY_REPLAY');
      expect(replays).toHaveLength(1);
      expect(replays[0]?.mode).toBe('COALESCED');
      expect(replays[0]?.idempotencyKey).toBe(payload.idempotencyKey);

      expect(ledger.get(payload.transactionId)?.status).toBe('COMMITTED');
    });

    it('replays the cached result for a click that arrives after settlement', async () => {
      const gateway = new CountingGateway(new ChaosGatewaySimulator(chaosConfig(), instantScheduler));
      const { dag, events } = createHarness({ gateway });

      const first = await dag.execute(payload);
      const late = await dag.execute(payload);

      expect(gateway.calls).toHaveLength(1);
      expect(late).toBe(first);
      expect(eventsOfType(events, 'IDEMPOTENCY_REPLAY').map((event) => event.mode)).toEqual(['REPLAYED']);
    });

    it('emits globally unique telemetry eventIds across duplicate runs', async () => {
      const gateway = new GatedGateway(APPROVED);
      const { dag, events } = createHarness({ gateway });

      const runs = [dag.execute(payload)];
      await gateway.entered;
      runs.push(dag.execute(payload));
      gateway.latch.release();
      await Promise.all(runs);

      const ids = events.map((event) => event.eventId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  /* ── 2. Payload tampering under the same key ──────────────────────────── */
  describe('idempotency conflict', () => {
    it('rejects the same key with a mutated body without touching the gateway again', async () => {
      const gateway = new CountingGateway(new ChaosGatewaySimulator(chaosConfig(), instantScheduler));
      const { dag, ledger } = createHarness({ gateway });

      const original = await dag.execute(payload);
      expect(original.outcome).toBe('COMMITTED');

      const tampered = { ...payload, amountMinor: 1 };
      await expect(dag.execute(tampered)).rejects.toBeInstanceOf(IdempotencyConflictError);

      expect(gateway.calls).toHaveLength(1);
      expect(ledger.get(payload.transactionId)?.amountMinor).toBe(4_999);
    });

    it('rejects a mutated body even while the original run is still in flight', async () => {
      const gateway = new GatedGateway(APPROVED);
      const { dag } = createHarness({ gateway });

      const original = dag.execute(payload);
      await gateway.entered;

      await expect(dag.execute({ ...payload, amountMinor: 1 })).rejects.toBeInstanceOf(
        IdempotencyConflictError,
      );

      gateway.latch.release();
      await expect(original).resolves.toMatchObject({ outcome: 'COMMITTED' });
      expect(gateway.callCount).toBe(1);
    });
  });

  /* ── 3. Network partition ─────────────────────────────────────────────── */
  describe('network partition', () => {
    it('exhausts maxAttempts, dead-letters the transaction and parks the ledger entry', async () => {
      const gateway = new CountingGateway(
        new ChaosGatewaySimulator(chaosConfig({ networkPartition: true }), instantScheduler),
      );
      const { dag, ledger, events } = createHarness({ gateway });

      const result = await dag.execute(payload);

      expect(result.outcome).toBe('DEAD_LETTERED');
      expect(result.attempts).toBe(RETRY_POLICY.maxAttempts);
      expect(result.failure?.code).toBe('RETRIES_EXHAUSTED');
      expect(result.failure?.disposition).toBe('DEAD_LETTER');
      expect(result.compensated).toBe(false); // ambiguous state → never auto-refund

      expect(gateway.calls.map((call) => call.attempt)).toEqual([1, 2, 3]);
      expect(result.nodes.GATEWAY.visits).toBe(RETRY_POLICY.maxAttempts);
      expect(result.nodes.RETRY_BACKOFF.visits).toBe(RETRY_POLICY.maxAttempts - 1);

      const retries = eventsOfType(events, 'RETRY_SCHEDULED');
      expect(retries.map((event) => event.attempt)).toEqual([2, 3]);
      expect(retries.every((event) => event.failureCode === 'NETWORK_PARTITION')).toBe(true);
      // Full-jitter ceiling: base · 2^(n-1), capped at maxDelayMs.
      expect(retries[0]?.delayMs).toBeLessThan(200);
      expect(retries[1]?.delayMs).toBeLessThan(400);

      expect(ledger.get(payload.transactionId)?.status).toBe('PARKED');
    });
  });

  /* ── 4. Iran + VPN ────────────────────────────────────────────────────── */
  describe('Iran ecosystem with VPN active', () => {
    it('warns about VPN, declines with IPG_GEO_BLOCKED and compensates the optimistic entry', async () => {
      const iran = iranPayload();
      const vpnDetected = true;
      const gateway = new CountingGateway(
        new ChaosGatewaySimulator(chaosConfig({ vpnDetected }), instantScheduler),
      );
      const { dag, ledger, events } = createHarness({ gateway, vpnDetected });

      const result = await dag.execute(iran);

      const warnings = eventsOfType(events, 'VPN_WARNING');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.ecosystem).toBe('IRAN_SHAPARAK');

      // Warning must precede the first gateway attempt (user is warned before the SMS OTP).
      const warningSeq = warnings[0]?.sequence ?? Number.POSITIVE_INFINITY;
      const firstGatewayEntry = eventsOfType(events, 'NODE_ENTERED').find((e) => e.nodeId === 'GATEWAY');
      expect(warningSeq).toBeLessThan(firstGatewayEntry?.sequence ?? Number.NEGATIVE_INFINITY);

      expect(result.outcome).toBe('DECLINED');
      expect(result.failure?.code).toBe('IPG_GEO_BLOCKED');
      expect(result.failure?.disposition).toBe('DECLINE');
      expect(result.compensated).toBe(true);
      expect(result.attempts).toBe(1); // hard decline is non-retryable
      expect(gateway.calls).toHaveLength(1);

      expect(ledger.get(iran.transactionId)?.status).toBe('COMPENSATED');
    });

    it('does not emit a VPN warning on the global ecosystem', async () => {
      const gateway = new ChaosGatewaySimulator(chaosConfig({ vpnDetected: true }), instantScheduler);
      const { dag, events } = createHarness({ gateway, vpnDetected: true });

      const result = await dag.execute(payload);

      expect(eventsOfType(events, 'VPN_WARNING')).toHaveLength(0);
      expect(result.outcome).toBe('COMMITTED');
    });
  });

  /* ── 5. Cart contention across intents ────────────────────────────────── */
  describe('cart lock contention', () => {
    it('aborts a second intent (different key) on the same cart with CART_LOCKED', async () => {
      const gateway = new GatedGateway(APPROVED);
      const { dag, ledger } = createHarness({ gateway });

      const firstIntent = dag.execute(payload);
      await gateway.entered; // first intent holds the cart lease

      const secondIntent = globalPayload({
        transactionId: '33333333-3333-4333-8333-333333333333',
        idempotencyKey: 'intent_global_000000000002',
      });
      const contended = await dag.execute(secondIntent);

      expect(contended.outcome).toBe('ABORTED');
      expect(contended.failure?.code).toBe('CART_LOCKED');
      expect(contended.attempts).toBe(0);
      expect(contended.nodes.CART_LOCK.status).toBe('FAILED');
      expect(contended.nodes.IDEMPOTENCY.status).toBe('SKIPPED');
      expect(contended.nodes.GATEWAY.status).toBe('SKIPPED');
      expect(ledger.get(secondIntent.transactionId)).toBeUndefined();

      gateway.latch.release();
      await expect(firstIntent).resolves.toMatchObject({ outcome: 'COMMITTED' });
      expect(gateway.callCount).toBe(1);
    });

    it('releases the cart lease after settlement so a new intent can proceed', async () => {
      const gateway = new ChaosGatewaySimulator(chaosConfig(), instantScheduler);
      const { dag } = createHarness({ gateway });

      await dag.execute(payload);
      const next = await dag.execute(
        globalPayload({
          transactionId: '44444444-4444-4444-8444-444444444444',
          idempotencyKey: 'intent_global_000000000003',
        }),
      );

      expect(next.outcome).toBe('COMMITTED');
    });
  });
});