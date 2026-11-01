/**
 * @file src/schemas/transaction.schema.ts
 * @description Single source of truth for every transactional contract that crosses an
 * I/O boundary (UI ⇄ store ⇄ core ⇄ telemetry sinks ⇄ gateway adapters).
 *
 * Environment-agnostic: depends on `zod` only. No React / DOM / Next.js imports.
 */
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. Shared primitives
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Unix epoch in milliseconds. */
export const TimestampMsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export type TimestampMs = z.infer<typeof TimestampMsSchema>;

/** Probability / ratio in the closed interval [0, 1]. */
export const RateSchema = z.number().min(0).max(1);
export type Rate = z.infer<typeof RateSchema>;

/** Max length for human-readable diagnostic strings carried in state/telemetry. */
export const MAX_DIAGNOSTIC_LENGTH = 512;
const DiagnosticStringSchema = z.string().max(MAX_DIAGNOSTIC_LENGTH);

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. Dual-ecosystem contract
 * ═══════════════════════════════════════════════════════════════════════════ */

export const EcosystemSchema = z.enum(['GLOBAL_STRIPE', 'IRAN_SHAPARAK']);
export type Ecosystem = z.infer<typeof EcosystemSchema>;

/** USD for the global rail, Iranian Toman (IRT) for the Shaparak rail. */
export const CurrencySchema = z.enum(['USD', 'IRT']);
export type Currency = z.infer<typeof CurrencySchema>;

export const ECOSYSTEM_CURRENCY = {
  GLOBAL_STRIPE: 'USD',
  IRAN_SHAPARAK: 'IRT',
} as const satisfies Readonly<Record<Ecosystem, Currency>>;

/** Decimal exponent of the smallest transactable unit. Toman is settled in whole units. */
export const CURRENCY_MINOR_EXPONENT = {
  USD: 2,
  IRT: 0,
} as const satisfies Readonly<Record<Currency, number>>;

export const GlobalRailSchema = z.enum(['STRIPE_CARD', 'KLARNA_BNPL']);
export const IranRailSchema = z.enum([
  'SHAPARAK_SAMAN',
  'SHAPARAK_MELLAT',
  'SHAPARAK_PARSIAN',
  'SNAPPPAY_BNPL',
]);
export const PaymentRailSchema = z.union([GlobalRailSchema, IranRailSchema]);
export type PaymentRail = z.infer<typeof PaymentRailSchema>;

export const GlobalRegionSchema = z.enum(['us-east-1', 'eu-west-1', 'ap-southeast-1']);
export type GlobalRegion = z.infer<typeof GlobalRegionSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. Identifiers & money
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Client-generated key, minted once per checkout *intent* (not per click).
 * A UUID from `crypto.randomUUID()` satisfies this contract.
 */
export const IdempotencyKeySchema = z
  .string()
  .min(16, 'Idempotency key must be at least 16 characters')
  .max(255, 'Idempotency key must be at most 255 characters')
  .regex(/^[A-Za-z0-9_-]+$/, 'Idempotency key may only contain [A-Za-z0-9_-]');
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const TransactionIdSchema = z.uuid();
export type TransactionId = z.infer<typeof TransactionIdSchema>;

/**
 * Integer amount in the currency's minor unit (USD → cents, IRT → whole Toman).
 * Integers only: floating-point money is a correctness bug, not a rounding detail.
 */
export const MinorUnitAmountSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export type MinorUnitAmount = z.infer<typeof MinorUnitAmountSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. Iranian locale normalisation (Persian/Arabic-Indic digits → ASCII)
 * ═══════════════════════════════════════════════════════════════════════════ */

const LOCALIZED_DIGIT_PATTERN = /[\u06F0-\u06F9\u0660-\u0669]/g;
const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;

export function normalizeLocalizedDigits(input: string): string {
  return input.replace(LOCALIZED_DIGIT_PATTERN, (char: string): string => {
    const code = char.charCodeAt(0);
    return String(code >= PERSIAN_ZERO ? code - PERSIAN_ZERO : code - ARABIC_INDIC_ZERO);
  });
}

export function normalizeIranMobile(input: string): string {
  const digits = normalizeLocalizedDigits(input).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+98')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  return digits;
}

export const IranMobileSchema = z
  .string()
  .max(32)
  .transform(normalizeIranMobile)
  .pipe(z.string().regex(/^09\d{9}$/, 'Iranian mobile must match 09XXXXXXXXX'));

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. Chaos & retry configuration
 * ═══════════════════════════════════════════════════════════════════════════ */

export const ChaosConfigSchema = z.strictObject({
  enabled: z.boolean(),
  /** Seed for the deterministic PRNG → reproducible chaos runs. */
  seed: z.number().int().nonnegative().max(0xffffffff),
  latency: z.strictObject({
    baseMs: z.number().int().min(0).max(60_000),
    jitterMs: z.number().int().min(0).max(60_000),
  }),
  /** Gateway call is cut after this budget (3DS / IPG redirect timeout). */
  gatewayTimeoutMs: z.number().int().min(100).max(120_000),
  /** Probability that a gateway attempt fails. */
  gatewayFailureRate: RateSchema,
  /** Of the failures, the share that are hard declines (non-retryable). */
  hardDeclineRatio: RateSchema,
  /**
   * Every gateway request is lost BEFORE reaching the gateway while true (connection refused,
   * DNS failure). Nothing was sent, so no money can have moved → safely retryable.
   */
  networkPartition: z.boolean(),
  /**
   * Of the attempts whose response is lost (timeout, Stripe 5xx), the share where the gateway
   * had in fact captured the money. This is hidden truth: the engine can only learn it through
   * a status inquiry (Stripe: retrieve the PaymentIntent; Shaparak: idempotent verify/inquiry).
   */
  ambiguousCaptureRate: RateSchema,
  /** Iran only: client egress IP is outside Iran → IPG callback is geo-blocked. */
  vpnDetected: z.boolean(),
  /** Iran only: dynamic-password (رمز پویا) SMS delivery latency added to each attempt. */
  smsOtpLatencyMs: z.number().int().min(0).max(300_000),
});
export type ChaosConfig = z.infer<typeof ChaosConfigSchema>;

export const RetryPolicySchema = z
  .strictObject({
    maxAttempts: z.number().int().min(1).max(10),
    baseDelayMs: z.number().int().min(1).max(60_000),
    maxDelayMs: z.number().int().min(1).max(300_000),
  })
  .refine((policy) => policy.maxDelayMs >= policy.baseDelayMs, {
    message: 'maxDelayMs must be greater than or equal to baseDelayMs',
    path: ['maxDelayMs'],
  });
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. DAG node state
 * ═══════════════════════════════════════════════════════════════════════════ */

export const DAG_NODE_IDS = [
  'CART_LOCK',
  'IDEMPOTENCY',
  'OPTIMISTIC',
  'GATEWAY',
  'RETRY_BACKOFF',
  'DLQ_OR_COMMIT',
] as const;
export const DagNodeIdSchema = z.enum(DAG_NODE_IDS);
export type DagNodeId = z.infer<typeof DagNodeIdSchema>;

export const DagNodeStatusSchema = z.enum(['PENDING', 'ACTIVE', 'SUCCEEDED', 'FAILED', 'SKIPPED']);
export type DagNodeStatus = z.infer<typeof DagNodeStatusSchema>;

export const DagNodeStateSchema = z.strictObject({
  nodeId: DagNodeIdSchema,
  status: DagNodeStatusSchema,
  /** How many times the node was entered (GATEWAY / RETRY_BACKOFF can be > 1). */
  visits: z.number().int().nonnegative(),
  enteredAt: TimestampMsSchema.nullable(),
  exitedAt: TimestampMsSchema.nullable(),
  lastError: DiagnosticStringSchema.nullable(),
});
export type DagNodeState = z.infer<typeof DagNodeStateSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. Gateway outcome (adapter boundary)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * RETRY       → the gateway answered "not approved, try later" OR the request provably never
 *               reached it (connection refused, HTTP 429). No money moved → safe to retry.
 * UNKNOWN     → the response was lost after the request may have been processed (timeout,
 *               socket reset, Stripe 5xx — which Stripe itself calls indeterminate). Money MAY
 *               have moved. Never re-authorize blindly: resolve with a status inquiry first.
 * DECLINE     → definitive refusal that needs user action (do_not_honor, expired card, geo-block).
 * DEAD_LETTER → money state cannot be determined automatically: park for manual reconciliation.
 *
 * Gateway result codes are PSP-specific, not a global code space: the same number means
 * different things per PSP (Mellat 11 = invalid card number, SEP callback 11 = TokenRequired,
 * Mellat 51 = duplicate transaction). Each adapter owns its own code → disposition mapping.
 */
export const FailureDispositionSchema = z.enum(['RETRY', 'UNKNOWN', 'DECLINE', 'DEAD_LETTER']);
export type FailureDisposition = z.infer<typeof FailureDispositionSchema>;

export const GatewayFailureSchema = z.strictObject({
  code: z.string().min(1).max(64),
  disposition: FailureDispositionSchema,
  message: DiagnosticStringSchema,
});
export type GatewayFailure = z.infer<typeof GatewayFailureSchema>;

export const GatewayOutcomeSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), reference: z.string().min(1).max(128) }),
  z.strictObject({ ok: z.literal(false), failure: GatewayFailureSchema }),
]);
export type GatewayOutcome = z.infer<typeof GatewayOutcomeSchema>;

/**
 * Result of a read-only status inquiry for an attempt whose outcome is UNKNOWN.
 *  CAPTURED     → the gateway holds the money; commit with this reference.
 *  NOT_CAPTURED → the gateway definitively has no successful payment for this attempt.
 *  PENDING      → the gateway cannot tell yet (still processing, OTP not entered…): ask again later.
 */
export const GatewayInquiryStateSchema = z.enum(['CAPTURED', 'NOT_CAPTURED', 'PENDING']);
export type GatewayInquiryState = z.infer<typeof GatewayInquiryStateSchema>;

export const GatewayInquirySchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('CAPTURED'), reference: z.string().min(1).max(128) }),
  z.strictObject({ state: z.literal('NOT_CAPTURED') }),
  z.strictObject({ state: z.literal('PENDING') }),
]);
export type GatewayInquiry = z.infer<typeof GatewayInquirySchema>;

export const SettlementOutcomeSchema = z.enum(['COMMITTED', 'DECLINED', 'DEAD_LETTERED', 'ABORTED']);
export type SettlementOutcome = z.infer<typeof SettlementOutcomeSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. Transaction payload (discriminated by ecosystem)
 * ═══════════════════════════════════════════════════════════════════════════ */

const TransactionBaseSchema = z.strictObject({
  transactionId: TransactionIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  cartId: z.string().min(1).max(128),
  customerId: z.string().min(1).max(128),
  amountMinor: MinorUnitAmountSchema,
  createdAt: TimestampMsSchema,
});

export const GlobalTransactionPayloadSchema = TransactionBaseSchema.extend({
  ecosystem: z.literal('GLOBAL_STRIPE'),
  currency: z.literal('USD'),
  rail: GlobalRailSchema,
  region: GlobalRegionSchema,
});
export type GlobalTransactionPayload = z.infer<typeof GlobalTransactionPayloadSchema>;

export const IranTransactionPayloadSchema = TransactionBaseSchema.extend({
  ecosystem: z.literal('IRAN_SHAPARAK'),
  currency: z.literal('IRT'),
  rail: IranRailSchema,
  mobile: IranMobileSchema,
  callbackUrl: z
    .url()
    .refine((url) => url.startsWith('https://'), 'IPG callbackUrl must use HTTPS'),
});
export type IranTransactionPayload = z.infer<typeof IranTransactionPayloadSchema>;

export const TransactionPayloadSchema = z.discriminatedUnion('ecosystem', [
  GlobalTransactionPayloadSchema,
  IranTransactionPayloadSchema,
]);
export type TransactionPayload = z.infer<typeof TransactionPayloadSchema>;
export type TransactionPayloadInput = z.input<typeof TransactionPayloadSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. Settlement result (core → UI/store)
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SettlementResultSchema = z.strictObject({
  transactionId: TransactionIdSchema,
  ecosystem: EcosystemSchema,
  outcome: SettlementOutcomeSchema,
  /** Number of gateway attempts actually made. */
  attempts: z.number().int().nonnegative(),
  gatewayReference: z.string().min(1).max(128).nullable(),
  failure: GatewayFailureSchema.nullable(),
  /** True when an optimistic ledger entry was rolled back. */
  compensated: z.boolean(),
  nodes: z.record(DagNodeIdSchema, DagNodeStateSchema),
  settledAt: TimestampMsSchema,
});
export type SettlementResult = z.infer<typeof SettlementResultSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. Telemetry events (core → observability sinks / DAG visualizer)
 * ═══════════════════════════════════════════════════════════════════════════ */

const TelemetryBaseSchema = z.strictObject({
  /** `${transactionId}:${sequence}` — deterministic, unique per run, no crypto dependency. */
  eventId: z.string().min(1).max(160),
  transactionId: TransactionIdSchema,
  ecosystem: EcosystemSchema,
  /** Monotonic per transaction run → total ordering for the visualizer. */
  sequence: z.number().int().nonnegative(),
  timestamp: TimestampMsSchema,
});

export const TelemetryEventSchema = z.discriminatedUnion('type', [
  TelemetryBaseSchema.extend({
    type: z.literal('NODE_ENTERED'),
    nodeId: DagNodeIdSchema,
    attempt: z.number().int().nonnegative(),
  }),
  TelemetryBaseSchema.extend({
    type: z.literal('NODE_EXITED'),
    nodeId: DagNodeIdSchema,
    status: DagNodeStatusSchema,
    durationMs: z.number().int().nonnegative(),
  }),
  TelemetryBaseSchema.extend({
    type: z.literal('RETRY_SCHEDULED'),
    attempt: z.number().int().positive(),
    delayMs: z.number().int().nonnegative(),
    failureCode: z.string().min(1).max(64),
  }),
  TelemetryBaseSchema.extend({
    type: z.literal('GATEWAY_INQUIRY'),
    /** Gateway attempt whose UNKNOWN outcome is being resolved. */
    gatewayAttempt: z.number().int().positive(),
    /** 1-based inquiry number for that attempt. */
    inquiry: z.number().int().positive(),
    /** ERROR = the inquiry itself threw or broke the adapter contract. */
    inquiryResult: z.enum(['CAPTURED', 'NOT_CAPTURED', 'PENDING', 'ERROR']),
  }),
  TelemetryBaseSchema.extend({
    type: z.literal('IDEMPOTENCY_REPLAY'),
    idempotencyKey: IdempotencyKeySchema,
    mode: z.enum(['COALESCED', 'REPLAYED']),
  }),
  TelemetryBaseSchema.extend({
    type: z.literal('VPN_WARNING'),
    message: DiagnosticStringSchema,
  }),
  TelemetryBaseSchema.extend({
    type: z.literal('SETTLED'),
    outcome: SettlementOutcomeSchema,
    attempts: z.number().int().nonnegative(),
    compensated: z.boolean(),
  }),
]);
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type TelemetryEventType = TelemetryEvent['type'];