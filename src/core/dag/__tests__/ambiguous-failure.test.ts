/**
 * @file src/core/dag/__tests__/ambiguous-failure.test.ts
 * @description Contract tests for the ambiguous-failure path of the TransactionDag:
 *
 *   An attempt whose response is lost (timeout, socket reset, Stripe 5xx) may already have moved
 *   money. The engine must resolve it with a status inquiry using the same identifiers and must
 *   NEVER (a) re-authorize while the ambiguity is open or (b) compensate a payment that an earlier
 *   ambiguous attempt may have captured.
 *
 * The first test is the regression for the original bug: timeout → retry → decline("51")
 * → compensate, while the first attempt had in fact captured the money.
 *
 * Determinism: ManualClock, instant scheduler, seeded PRNG, scripted gateways. No timers, no I/O.
 * Environment-agnostic: no React / DOM / Next.js / Node-specific imports.
 */
import { describe, expect, it } from 'vitest';

import {
  TelemetryEventSchema,
  TransactionPayloadSchema,
  type ChaosConfig,
  type GatewayOutcome,
  type GlobalTransactionPayload,
  type RetryPolicy,
  type TelemetryEvent,
  type TransactionPayload,
  type TransactionPayloadInput,
} from '../../../schemas/transaction.schema';
import { type Clock } from '../idempotency-engine';
import {
  ChaosGatewaySimulator,
  InMemoryCartLock,
  InMemoryOptimisticLedger,
  TransactionDag,
  createSeededRandom,
  type GatewayAttemptContext,
  type GatewayInquiryContext,
  type GatewayPort,
  type Scheduler,
} from '../transaction-dag';

/* ═══════════════════════════════════════════════════════════════════════════
 * Deterministic doubles
 * ═══════════════════════════════════════════════════════════════════════════ */

const FIXED_EPOCH_MS = 1_793_000_000_000;

class ManualClock implements Clock {
  private current = FIXED_EPOCH_MS;

  public now(): number {
    return this.current;
  }
}

const instantScheduler: Scheduler = {
  sleep: (): Promise<void> => Promise.resolve(),
};

/** One scripted step: a value to return, or an Error to throw. */
type Step = unknown;

function playStep(step: Step | undefined, what: string): Promise<unknown> {
  if (step === undefined) {
    return Promise.reject(new Error(`Test script exhausted for ${what}: the engine called it too often.`));
  }
  return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
}

/** Authorize-only adapter (no inquiry capability). Records every call. */
class ScriptedAuthorizeGateway implements GatewayPort {
  public readonly authorizeCalls: GatewayAttemptContext[] = [];
  private authorizeIndex = 0;

  public constructor(private readonly authorizeScript: readonly Step[]) {}

  public authorize(_tx: TransactionPayload, context: GatewayAttemptContext): Promise<unknown> {
    this.authorizeCalls.push(context);
    const step = this.authorizeScript[this.authorizeIndex];
    this.authorizeIndex += 1;
    return playStep(step, 'authorize');
  }
}

/** Adapter that can also inquire. Records every inquiry. */
class ScriptedInquiringGateway extends ScriptedAuthorizeGateway {
  public readonly inquiryCalls: GatewayInquiryContext[] = [];
  private inquiryIndex = 0;

  public constructor(authorizeScript: readonly Step[], private readonly inquiryScript: readonly Step[]) {
    super(authorizeScript);
  }

  public inquire(_tx: TransactionPayload, context: GatewayInquiryContext): Promise<unknown> {
    this.inquiryCalls.push(context);
    const step = this.inquiryScript[this.inquiryIndex];
    this.inquiryIndex += 1;
    return playStep(step, 'inquire');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Fixtures
 * ═══════════════════════════════════════════════════════════════════════════ */

const RETRY_POLICY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 2_000 };
const INQUIRY_POLICY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1_000 };

const CAPTURED_REF = 'shp_rrn_captured_0001';

const SOCKET_RESET = new Error('ECONNRESET: socket hang up (VPN dropped mid-request)');
const IPG_TIMEOUT: GatewayOutcome = {
  ok: false,
  failure: { code: 'IPG_TIMEOUT', disposition: 'UNKNOWN', message: 'No response within 5000ms.' },
};
const HARD_DECLINE_51: GatewayOutcome = {
  ok: false,
  failure: { code: '51', disposition: 'DECLINE', message: 'Insufficient funds.' },
};
const APPROVED: GatewayOutcome = { ok: true, reference: 'shp_rrn_second_attempt' };

function iranPayload(): TransactionPayloadInput & { readonly transactionId: string } {
  return {
    transactionId: '55555555-5555-4555-8555-555555555555',
    idempotencyKey: 'intent_iran_ambiguous_0001',
    cartId: 'cart-iran-ambiguous',
    customerId: 'cus_iran_ambiguous',
    amountMinor: 4_500_000,
    createdAt: FIXED_EPOCH_MS,
    ecosystem: 'IRAN_SHAPARAK',
    currency: 'IRT',
    rail: 'SHAPARAK_SAMAN',
    mobile: '09121234567',
    callbackUrl: 'https://shop.example.ir/payment/callback',
  };
}

function globalPayload(): GlobalTransactionPayload {
  return {
    transactionId: '66666666-6666-4666-8666-666666666666',
    idempotencyKey: 'intent_global_ambiguous_01',
    cartId: 'cart-global-ambiguous',
    customerId: 'cus_global_ambiguous',
    amountMinor: 4_500,
    createdAt: FIXED_EPOCH_MS,
    ecosystem: 'GLOBAL_STRIPE',
    currency: 'USD',
    rail: 'STRIPE_CARD',
    region: 'eu-west-1',
  };
}

function chaosConfig(overrides: Partial<ChaosConfig> = {}): ChaosConfig {
  return {
    enabled: true,
    seed: 7,
    latency: { baseMs: 100, jitterMs: 50 },
    gatewayTimeoutMs: 5_000,
    gatewayFailureRate: 0,
    hardDeclineRatio: 0,
    networkPartition: false,
    ambiguousCaptureRate: 0,
    vpnDetected: false,
    smsOtpLatencyMs: 0,
    ...overrides,
  };
}

interface Harness {
  readonly dag: TransactionDag;
  readonly ledger: InMemoryOptimisticLedger;
  readonly events: TelemetryEvent[];
}

function createHarness(gateway: GatewayPort): Harness {
  const clock = new ManualClock();
  const ledger = new InMemoryOptimisticLedger();
  const dag = new TransactionDag({
    gateway,
    ledger,
    cartLock: new InMemoryCartLock(clock),
    retryPolicy: RETRY_POLICY,
    inquiryPolicy: INQUIRY_POLICY,
    scheduler: instantScheduler,
    clock,
    random: createSeededRandom(1),
  });
  const events: TelemetryEvent[] = [];
  dag.subscribe((event: TelemetryEvent): void => {
    events.push(TelemetryEventSchema.parse(event)); // every event must honour the telemetry contract
  });
  return { dag, ledger, events };
}

function eventsOfType<TType extends TelemetryEvent['type']>(
  events: readonly TelemetryEvent[],
  type: TType,
): Extract<TelemetryEvent, { type: TType }>[] {
  return events.filter((event): event is Extract<TelemetryEvent, { type: TType }> => event.type === type);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Tests
 * ═══════════════════════════════════════════════════════════════════════════ */

describe('TransactionDag — ambiguous-failure contract', () => {
  it('REGRESSION: a lost response that actually captured money is committed via inquiry, never retried into a decline and refunded', async () => {
    // Attempt 1: socket reset after the PSP captured. A blind retry would hit "51" (money already gone).
    const gateway = new ScriptedInquiringGateway(
      [SOCKET_RESET, HARD_DECLINE_51],
      [{ state: 'CAPTURED', reference: CAPTURED_REF }],
    );
    const { dag, ledger, events } = createHarness(gateway);
    const tx = iranPayload();

    const result = await dag.execute(tx);

    expect(result.outcome).toBe('COMMITTED');
    expect(result.gatewayReference).toBe(CAPTURED_REF);
    expect(result.compensated).toBe(false);
    expect(result.attempts).toBe(1);
    expect(gateway.authorizeCalls).toHaveLength(1); // the second, money-destroying authorize never happens
    expect(gateway.inquiryCalls).toEqual([{ attempt: 1, inquiry: 1 }]);
    expect(eventsOfType(events, 'RETRY_SCHEDULED')).toHaveLength(0);
    expect(ledger.get(tx.transactionId)?.status).toBe('COMMITTED');
  });

  it('dead-letters an ambiguous attempt when the adapter cannot inquire (no retry, no compensation)', async () => {
    const gateway = new ScriptedAuthorizeGateway([IPG_TIMEOUT, HARD_DECLINE_51]);
    const { dag, ledger } = createHarness(gateway);
    const tx = iranPayload();

    const result = await dag.execute(tx);

    expect(result.outcome).toBe('DEAD_LETTERED');
    expect(result.failure?.code).toBe('AMBIGUOUS_NO_INQUIRY');
    expect(result.failure?.disposition).toBe('DEAD_LETTER');
    expect(result.compensated).toBe(false);
    expect(gateway.authorizeCalls).toHaveLength(1);
    expect(ledger.get(tx.transactionId)?.status).toBe('PARKED');
  });

  it('allows a retry only after the inquiry proves the attempt unpaid; a later hard decline is then safely compensated', async () => {
    const gateway = new ScriptedInquiringGateway([IPG_TIMEOUT, HARD_DECLINE_51], [{ state: 'NOT_CAPTURED' }]);
    const { dag, ledger, events } = createHarness(gateway);
    const tx = iranPayload();

    const result = await dag.execute(tx);

    expect(result.outcome).toBe('DECLINED');
    expect(result.failure?.code).toBe('51');
    expect(result.compensated).toBe(true); // definitive: no attempt holds money
    expect(gateway.authorizeCalls.map((call) => call.attempt)).toEqual([1, 2]);
    const retries = eventsOfType(events, 'RETRY_SCHEDULED');
    expect(retries).toHaveLength(1);
    expect(retries[0]?.failureCode).toBe('IPG_TIMEOUT');
    expect(ledger.get(tx.transactionId)?.status).toBe('COMPENSATED');
  });

  it('commits on the retry when the first ambiguous attempt is proven unpaid and the second is approved', async () => {
    const gateway = new ScriptedInquiringGateway([IPG_TIMEOUT, APPROVED], [{ state: 'NOT_CAPTURED' }]);
    const { dag } = createHarness(gateway);

    const result = await dag.execute(iranPayload());

    expect(result.outcome).toBe('COMMITTED');
    expect(result.attempts).toBe(2);
    expect(result.gatewayReference).toBe(APPROVED.ok ? APPROVED.reference : null);
    expect(result.nodes.GATEWAY.visits).toBe(2);
    expect(result.nodes.RETRY_BACKOFF.visits).toBe(1);
  });

  it('dead-letters after the inquiry budget when the gateway keeps answering PENDING', async () => {
    const pending = { state: 'PENDING' };
    const gateway = new ScriptedInquiringGateway([IPG_TIMEOUT], [pending, pending, pending]);
    const { dag, ledger, events } = createHarness(gateway);
    const tx = iranPayload();

    const result = await dag.execute(tx);

    expect(result.outcome).toBe('DEAD_LETTERED');
    expect(result.failure?.code).toBe('AMBIGUOUS_UNRESOLVED');
    expect(result.failure?.message).toContain('PENDING');
    expect(result.compensated).toBe(false);
    expect(gateway.authorizeCalls).toHaveLength(1);
    expect(gateway.inquiryCalls).toHaveLength(INQUIRY_POLICY.maxAttempts);
    expect(eventsOfType(events, 'GATEWAY_INQUIRY').map((event) => event.inquiryResult)).toEqual([
      'PENDING',
      'PENDING',
      'PENDING',
    ]);
    expect(ledger.get(tx.transactionId)?.status).toBe('PARKED');
  });

  it('treats a throwing inquiry as unanswered and keeps inquiring within budget', async () => {
    const gateway = new ScriptedInquiringGateway(
      [IPG_TIMEOUT],
      [new Error('verify endpoint timed out'), { state: 'CAPTURED', reference: CAPTURED_REF }],
    );
    const { dag, events } = createHarness(gateway);

    const result = await dag.execute(iranPayload());

    expect(result.outcome).toBe('COMMITTED');
    expect(result.gatewayReference).toBe(CAPTURED_REF);
    expect(eventsOfType(events, 'GATEWAY_INQUIRY').map((event) => event.inquiryResult)).toEqual([
      'ERROR',
      'CAPTURED',
    ]);
  });

  it('never trusts a malformed inquiry answer (Zod contract) and dead-letters when nothing valid arrives', async () => {
    const malformed = { state: 'CAPTURED' }; // missing reference → contract violation
    const gateway = new ScriptedInquiringGateway([IPG_TIMEOUT], [malformed, malformed, malformed]);
    const { dag } = createHarness(gateway);

    const result = await dag.execute(iranPayload());

    expect(result.outcome).toBe('DEAD_LETTERED');
    expect(result.failure?.code).toBe('AMBIGUOUS_UNRESOLVED');
    expect(result.failure?.message).toContain('INQUIRY_CONTRACT_VIOLATION');
  });

  it('chaos simulator: an IPG timeout that secretly captured is recovered through inquiry (Iran, SMS-OTP latency)', async () => {
    const simulator = new ChaosGatewaySimulator(
      chaosConfig({ gatewayTimeoutMs: 1_000, smsOtpLatencyMs: 2_000, ambiguousCaptureRate: 1 }),
      instantScheduler,
    );
    const { dag, ledger, events } = createHarness(simulator);
    const tx = iranPayload();

    const result = await dag.execute(tx);

    expect(result.outcome).toBe('COMMITTED');
    expect(result.attempts).toBe(1);
    expect(result.gatewayReference?.startsWith('shp_rrn_')).toBe(true);
    expect(eventsOfType(events, 'GATEWAY_INQUIRY').map((event) => event.inquiryResult)).toEqual(['CAPTURED']);
    expect(ledger.get(tx.transactionId)?.status).toBe('COMMITTED');
  });

  it('chaos simulator: timeouts proven unpaid are retried, then dead-lettered on exhaustion — never compensated', async () => {
    const simulator = new ChaosGatewaySimulator(
      chaosConfig({ gatewayTimeoutMs: 1_000, smsOtpLatencyMs: 2_000, ambiguousCaptureRate: 0 }),
      instantScheduler,
    );
    const { dag, ledger, events } = createHarness(simulator);
    const tx = iranPayload();

    const result = await dag.execute(tx);

    expect(result.outcome).toBe('DEAD_LETTERED');
    expect(result.failure?.code).toBe('RETRIES_EXHAUSTED');
    expect(result.attempts).toBe(RETRY_POLICY.maxAttempts);
    expect(result.compensated).toBe(false);
    expect(eventsOfType(events, 'GATEWAY_INQUIRY')).toHaveLength(RETRY_POLICY.maxAttempts);
    expect(eventsOfType(events, 'RETRY_SCHEDULED')).toHaveLength(RETRY_POLICY.maxAttempts - 1);
    expect(ledger.get(tx.transactionId)?.status).toBe('PARKED');
  });

  it('STRESS invariant over 300 seeded chaos runs: if the gateway holds the money, the engine never declines or refunds it', async () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const iran = seed % 2 === 0;
      const simulator = new ChaosGatewaySimulator(
        chaosConfig({
          seed,
          latency: { baseMs: 100, jitterMs: 2_000 },
          gatewayTimeoutMs: 1_200,
          gatewayFailureRate: 0.5,
          hardDeclineRatio: 0.5,
          ambiguousCaptureRate: 0.5,
          smsOtpLatencyMs: iran ? 200 : 0,
        }),
        instantScheduler,
      );
      const { dag, ledger } = createHarness(simulator);
      const tx = TransactionPayloadSchema.parse(iran ? iranPayload() : globalPayload());

      const result = await dag.execute(tx);
      // Ask the gateway's own truth AFTER the run: did money actually move for this transaction?
      const truth = await simulator.inquire(tx);

      if (truth.state === 'CAPTURED') {
        // Money moved at the gateway → the only acceptable outcomes keep it (commit) or freeze it (DLQ).
        expect(['COMMITTED', 'DEAD_LETTERED'], `seed ${seed}`).toContain(result.outcome);
        expect(result.compensated, `seed ${seed}`).toBe(false);
        expect(ledger.get(tx.transactionId)?.status, `seed ${seed}`).not.toBe('COMPENSATED');
      }
      if (result.compensated) {
        expect(truth.state, `seed ${seed}`).toBe('NOT_CAPTURED');
      }
    }
  });
});
