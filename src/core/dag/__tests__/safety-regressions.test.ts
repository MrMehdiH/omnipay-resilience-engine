import { describe, expect, it } from 'vitest';
import { SettlementResultSchema, TelemetryEventSchema, type GlobalTransactionPayload, type TelemetryEvent } from '../../../schemas/transaction.schema';
import { IdempotencyRegistry } from '../idempotency-engine';
import { InMemoryCartLock, InMemoryOptimisticLedger, TransactionDag, type GatewayPort, type OptimisticLedgerPort, type Scheduler } from '../transaction-dag';

const tx: GlobalTransactionPayload = {
  transactionId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: 'intent_safety_regression_001',
  cartId: 'cart-safety', customerId: 'customer-safety', amountMinor: 4500,
  createdAt: 1000, ecosystem: 'GLOBAL_STRIPE', currency: 'USD', rail: 'STRIPE_CARD', region: 'us-east-1',
};

function harness(gateway: GatewayPort, ledger: OptimisticLedgerPort = new InMemoryOptimisticLedger(), scheduler: Scheduler = { sleep: async () => undefined }) {
  const events: TelemetryEvent[] = [];
  const dag = new TransactionDag({ gateway, ledger, scheduler, cartLock: new InMemoryCartLock(),
    clock: { now: () => 1000 }, random: () => 0.5,
    retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
  });
  dag.subscribe((event) => events.push(event));
  return { dag, events };
}

describe('payment safety regressions', () => {
  it('keeps a live idempotency claim when completed results are cleared', async () => {
    const registry = new IdempotencyRegistry<number>();
    let release: (value: number) => void = () => undefined;
    const pending = new Promise<number>((resolve) => { release = resolve; });
    let calls = 0;
    const run = () => { calls += 1; return pending; };
    const first = registry.execute(tx.idempotencyKey, 'fingerprint', run);
    await Promise.resolve();
    registry.clear();
    const duplicate = registry.execute(tx.idempotencyKey, 'fingerprint', run);
    release(42);
    const results = await Promise.all([first, duplicate]);
    expect(calls).toBe(1);
    expect(results.map((result) => result.mode)).toEqual(['EXECUTED', 'COALESCED']);
    expect(registry.lookup(tx.idempotencyKey).state).toBe('COMPLETED');
  });

  it('parks and caches a run when the retry scheduler fails after reservation', async () => {
    const ledger = new InMemoryOptimisticLedger();
    const { dag } = harness({ authorize: async () => ({ ok: false, failure: {
      code: 'RATE_LIMIT', disposition: 'RETRY', message: 'Not sent.',
    } }) }, ledger, { sleep: async () => { throw new Error('scheduler unavailable'); } });
    const result = await dag.execute(tx);
    expect(result.outcome).toBe('DEAD_LETTERED');
    expect(result.compensated).toBe(false);
    expect(ledger.get(tx.transactionId)?.status).toBe('PARKED');
    expect(result.nodes.RETRY_BACKOFF.status).toBe('FAILED');
    expect(await dag.execute(tx)).toBe(result);
    expect(SettlementResultSchema.safeParse(result).success).toBe(true);
  });

  it('reports failed compensation as a dead letter requiring reconciliation', async () => {
    const ledger = new InMemoryOptimisticLedger();
    const { dag } = harness({ authorize: async () => ({ ok: false, failure: {
      code: 'DECLINED', disposition: 'DECLINE', message: 'Definitive refusal.',
    } }) }, {
      reserve: (payload) => ledger.reserve(payload),
      commit: (payload, reference) => ledger.commit(payload, reference),
      compensate: async () => { throw new Error('rollback unavailable'); },
      park: (payload, failure) => ledger.park(payload, failure),
    });
    const result = await dag.execute(tx);
    expect(result).toMatchObject({ outcome: 'DEAD_LETTERED', compensated: false,
      failure: { code: 'LEDGER_COMPENSATION_FAILED', disposition: 'DEAD_LETTER' } });
    expect(ledger.get(tx.transactionId)?.status).toBe('PARKED');
  });

  it('keeps long adapter diagnostics inside the settlement and telemetry schemas', async () => {
    const { dag, events } = harness({ authorize: async () => ({ ok: false, failure: {
      code: 'X'.repeat(64), disposition: 'DECLINE', message: 'x'.repeat(512),
    } }) });
    const result = await dag.execute(tx);
    expect(SettlementResultSchema.safeParse(result).success).toBe(true);
    expect(events.every((event) => TelemetryEventSchema.safeParse(event).success)).toBe(true);
  });
});
