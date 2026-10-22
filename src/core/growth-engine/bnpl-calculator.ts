/**
 * @file src/core/growth-engine/bnpl-calculator.ts
 * @description Unit economics for BNPL (Klarna / SnappPay) + referral-driven growth:
 *   1. AOV & conversion uplift from BNPL adoption, net of BNPL merchant fees.
 *   2. Discounted customer LTV.
 *   3. Viral K-factor → organic multiplier → blended CAC.
 *   4. LTV:CAC, CAC payback, and the closed-form break-even K for a target LTV:CAC.
 *
 * Money is integer minor units (USD → cents, IRT → whole Toman). Intermediate maths is float;
 * money outputs are rounded once at the boundary (no compounding rounding drift).
 *
 * Every input is an assumption supplied by the caller — no vendor fee or uplift is hardcoded,
 * because Klarna/SnappPay merchant pricing is contract-specific.
 *
 * Environment-agnostic: depends on `zod` and the shared schemas only.
 */
import { z } from 'zod';
import {
  CURRENCY_MINOR_EXPONENT,
  ECOSYSTEM_CURRENCY,
  EcosystemSchema,
  RateSchema,
  type Currency,
  type Ecosystem,
} from '../../schemas/transaction.schema';

/* ═══════════════════════════════════════════════════════════════════════════
 * Errors
 * ═══════════════════════════════════════════════════════════════════════════ */

export class GrowthModelError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Input contract
 * ═══════════════════════════════════════════════════════════════════════════ */

const MoneyMinorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const PositiveMoneyMinorSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const BnplGrowthInputSchema = z
  .strictObject({
    ecosystem: EcosystemSchema,

    /* ── Baseline funnel ── */
    /** Average order value without BNPL, minor units. */
    baselineAovMinor: PositiveMoneyMinorSchema,
    /** Visitor → order conversion without BNPL. */
    baselineConversionRate: RateSchema.refine((r) => r > 0, 'baselineConversionRate must be > 0'),
    /** Gross margin on merchandise (before payment fees). */
    grossMarginRate: RateSchema,
    /** Card / Shaparak PSP fee rate on non-BNPL orders. */
    standardPaymentFeeRate: RateSchema,

    /* ── BNPL effect ── */
    /** Share of orders paid with BNPL once enabled. */
    bnplAdoptionRate: RateSchema,
    /** Relative AOV lift of BNPL orders vs. baseline (0.3 → +30%). Must be > -1. */
    bnplAovUpliftRate: z.number().gt(-1).max(10),
    /** Relative conversion lift for the whole funnel when BNPL is offered. */
    bnplConversionUpliftRate: z.number().gt(-1).max(10),
    /** BNPL merchant discount rate (variable part). */
    bnplMerchantFeeRate: RateSchema,
    /** BNPL fixed fee per order, minor units. */
    bnplFixedFeeMinor: MoneyMinorSchema,

    /* ── Retention / LTV ── */
    /** Orders per customer per year. */
    ordersPerYear: z.number().positive().max(365),
    /** Probability a customer is still active next year. Must be < 1. */
    annualRetentionRate: RateSchema.refine((r) => r < 1, 'annualRetentionRate must be < 1'),
    /**
     * Annual discount rate. Use a NOMINAL rate consistent with nominal prices:
     * for Toman this must reflect Iranian inflation, otherwise LTV is wildly overstated.
     */
    annualDiscountRate: z.number().min(0).max(5),

    /* ── Acquisition & referral loop ── */
    /** Paid CAC per directly-acquired customer, minor units. */
    paidCacMinor: PositiveMoneyMinorSchema,
    /** Invites sent per customer per viral cycle. */
    invitesPerCustomer: z.number().nonnegative().max(1000),
    /** Invite → paying customer conversion. */
    inviteConversionRate: RateSchema,
    /** Total referral reward cost per *referred* customer (two-sided rewards summed). */
    referralRewardMinor: MoneyMinorSchema,
    /** Viral cycles to model. `null` = steady state (requires K < 1). */
    viralCycles: z.number().int().nonnegative().max(100).nullable(),

    /** Target LTV:CAC for the break-even-K solver. Default 3. */
    targetLtvToCac: z.number().positive().max(100).default(3),
  })
  .superRefine((input, ctx) => {
    const k = input.invitesPerCustomer * input.inviteConversionRate;
    if (input.viralCycles === null && k >= 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['viralCycles'],
        message: `K-factor ${k.toFixed(3)} ≥ 1 diverges in steady state; supply a finite viralCycles horizon.`,
      });
    }
  });

export type BnplGrowthInput = z.output<typeof BnplGrowthInputSchema>;
export type BnplGrowthInputRaw = z.input<typeof BnplGrowthInputSchema>;

/* ═══════════════════════════════════════════════════════════════════════════
 * Output contract
 * ═══════════════════════════════════════════════════════════════════════════ */

export type LtvCacHealth = 'UNPROFITABLE' | 'MARGINAL' | 'HEALTHY' | 'UNDER_INVESTING';

export interface AovBreakdown {
  readonly baselineAovMinor: number;
  readonly bnplOrderAovMinor: number;
  readonly blendedAovMinor: number;
  /** blended / baseline − 1 */
  readonly aovLiftRate: number;
  readonly effectiveConversionRate: number;
  readonly baselineRevenuePerVisitorMinor: number;
  readonly revenuePerVisitorMinor: number;
  /** Revenue-per-visitor lift (AOV × conversion), the metric that actually pays the BNPL fee. */
  readonly revenuePerVisitorLiftRate: number;
}

export interface MarginBreakdown {
  /** Contribution per order after COGS and payment fees, BNPL disabled. */
  readonly baselineContributionPerOrderMinor: number;
  /** Contribution per order after COGS and the blended payment-fee mix, BNPL enabled. */
  readonly contributionPerOrderMinor: number;
  readonly effectivePaymentFeeRate: number;
  /** Contribution per visitor (BNPL) − contribution per visitor (baseline). Negative ⇒ BNPL destroys value. */
  readonly contributionPerVisitorDeltaMinor: number;
}

export interface ViralBreakdown {
  readonly kFactor: number;
  /** Customers ultimately acquired per paid customer (≥ 1). */
  readonly viralMultiplier: number;
  readonly referredCustomersPerPaid: number;
  readonly blendedCacMinor: number;
  readonly cacReductionRate: number;
}

export interface LtvCacReport {
  readonly ecosystem: Ecosystem;
  readonly currency: Currency;
  readonly minorUnitExponent: number;
  readonly aov: AovBreakdown;
  readonly margin: MarginBreakdown;
  readonly viral: ViralBreakdown;
  readonly annualContributionPerCustomerMinor: number;
  readonly ltvMinor: number;
  readonly ltvToPaidCac: number;
  readonly ltvToBlendedCac: number;
  /** Months to recoup blended CAC; `null` if contribution ≤ 0 (never pays back). */
  readonly paybackMonths: number | null;
  readonly health: LtvCacHealth;
  /** Minimum K reaching `targetLtvToCac` (steady-state model); `null` if unreachable for K ∈ [0, 1). */
  readonly breakEvenKFactor: number | null;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Pure formulas (exported for unit testing / UI sliders)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** K = i · c */
export function kFactor(invitesPerCustomer: number, inviteConversionRate: number): number {
  assertFinite('invitesPerCustomer', invitesPerCustomer);
  assertFinite('inviteConversionRate', inviteConversionRate);
  return invitesPerCustomer * inviteConversionRate;
}

/**
 * Total customers per seed customer after n cycles: Σ_{t=0..n} K^t = (1 − K^{n+1}) / (1 − K).
 * Steady state (n = ∞, K < 1): 1 / (1 − K).
 */
export function viralMultiplier(k: number, cycles: number | null): number {
  assertFinite('k', k);
  if (k < 0) throw new GrowthModelError(`K-factor must be ≥ 0, received ${k}.`);

  if (cycles === null) {
    if (k >= 1) throw new GrowthModelError(`Steady-state multiplier diverges for K = ${k} ≥ 1.`);
    return 1 / (1 - k);
  }
  if (!Number.isSafeInteger(cycles) || cycles < 0) {
    throw new GrowthModelError(`cycles must be a non-negative integer, received ${cycles}.`);
  }
  if (Math.abs(1 - k) < 1e-12) return cycles + 1; // L'Hôpital limit at K = 1
  const result = (1 - k ** (cycles + 1)) / (1 - k);
  assertFinite('viralMultiplier', result);
  return result;
}

/**
 * Blended CAC: paid spend + referral rewards amortised over every customer acquired.
 *   CAC_blended = (CAC_paid + R · (M − 1)) / M
 * Steady state simplifies to CAC_paid · (1 − K) + R · K.
 */
export function blendedCac(paidCac: number, rewardPerReferred: number, multiplier: number): number {
  assertFinite('paidCac', paidCac);
  assertFinite('rewardPerReferred', rewardPerReferred);
  if (!(multiplier >= 1)) throw new GrowthModelError(`multiplier must be ≥ 1, received ${multiplier}.`);
  return (paidCac + rewardPerReferred * (multiplier - 1)) / multiplier;
}

/**
 * Discounted LTV with first-year contribution realised immediately (Gupta–Lehmann form):
 *   LTV = m · Σ_{t≥0} (r / (1 + d))^t = m · (1 + d) / (1 + d − r)
 * with m = annual contribution, r = annual retention, d = annual discount rate.
 */
export function discountedLtv(annualContribution: number, retentionRate: number, discountRate: number): number {
  assertFinite('annualContribution', annualContribution);
  if (!(retentionRate >= 0 && retentionRate < 1)) {
    throw new GrowthModelError(`retentionRate must be in [0, 1), received ${retentionRate}.`);
  }
  if (!(discountRate >= 0)) throw new GrowthModelError(`discountRate must be ≥ 0, received ${discountRate}.`);
  return (annualContribution * (1 + discountRate)) / (1 + discountRate - retentionRate);
}

/**
 * Closed-form break-even K (steady state). Solve LTV / (C(1 − K) + R·K) = T for K:
 *   K* = (C − LTV/T) / (C − R)
 * Returns 0 if the target is already met at K = 0, `null` if unreachable for K ∈ [0, 1).
 */
export function breakEvenKFactor(
  ltv: number,
  paidCac: number,
  rewardPerReferred: number,
  targetRatio: number,
): number | null {
  assertFinite('ltv', ltv);
  if (!(targetRatio > 0)) throw new GrowthModelError(`targetRatio must be > 0, received ${targetRatio}.`);
  if (ltv <= 0) return null;

  const requiredCac = ltv / targetRatio;
  if (paidCac <= requiredCac) return 0;
  // Referral rewards cost at least as much as paid acquisition → referrals can't lower CAC.
  if (rewardPerReferred >= paidCac) return null;
  // Asymptote as K → 1 is CAC → R; target unreachable if R itself is too expensive.
  if (rewardPerReferred >= requiredCac) return null;

  const k = (paidCac - requiredCac) / (paidCac - rewardPerReferred);
  return k >= 0 && k < 1 ? k : null;
}

export function classifyLtvCac(ratio: number): LtvCacHealth {
  if (ratio < 1) return 'UNPROFITABLE';
  if (ratio < 3) return 'MARGINAL';
  if (ratio <= 5) return 'HEALTHY';
  return 'UNDER_INVESTING';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Composite model
 * ═══════════════════════════════════════════════════════════════════════════ */

export function computeBnplGrowth(rawInput: unknown): LtvCacReport {
  const input = BnplGrowthInputSchema.parse(rawInput);
  const currency = ECOSYSTEM_CURRENCY[input.ecosystem];

  /* ── 1. AOV & funnel ── */
  const baselineAov = input.baselineAovMinor;
  const bnplOrderAov = baselineAov * (1 + input.bnplAovUpliftRate);
  const adoption = input.bnplAdoptionRate;
  // AOV_blended = (1 − a) · AOV_0 + a · AOV_0 · (1 + u) = AOV_0 · (1 + a·u)
  const blendedAov = baselineAov * (1 + adoption * input.bnplAovUpliftRate);
  const effectiveConversion = Math.min(1, input.baselineConversionRate * (1 + input.bnplConversionUpliftRate));

  const baselineRpv = input.baselineConversionRate * baselineAov;
  const rpv = effectiveConversion * blendedAov;

  /* ── 2. Contribution per order (fee mix) ── */
  const baselineContribution = baselineAov * (input.grossMarginRate - input.standardPaymentFeeRate);

  const standardShareRevenue = (1 - adoption) * baselineAov;
  const bnplShareRevenue = adoption * bnplOrderAov;
  const feesPerOrder =
    standardShareRevenue * input.standardPaymentFeeRate +
    bnplShareRevenue * input.bnplMerchantFeeRate +
    adoption * input.bnplFixedFeeMinor;
  const contribution = blendedAov * input.grossMarginRate - feesPerOrder;
  const effectiveFeeRate = blendedAov > 0 ? feesPerOrder / blendedAov : 0;

  const contributionPerVisitorDelta =
    effectiveConversion * contribution - input.baselineConversionRate * baselineContribution;

  /* ── 3. LTV ── */
  const annualContribution = contribution * input.ordersPerYear;
  const ltv = discountedLtv(annualContribution, input.annualRetentionRate, input.annualDiscountRate);

  /* ── 4. Viral loop & CAC ── */
  const k = kFactor(input.invitesPerCustomer, input.inviteConversionRate);
  const multiplier = viralMultiplier(k, input.viralCycles);
  const cacBlended = blendedCac(input.paidCacMinor, input.referralRewardMinor, multiplier);

  const ltvToPaidCac = ltv / input.paidCacMinor;
  const ltvToBlendedCac = cacBlended > 0 ? ltv / cacBlended : Number.POSITIVE_INFINITY;

  const monthlyContribution = annualContribution / 12;
  const paybackMonths = monthlyContribution > 0 ? cacBlended / monthlyContribution : null;

  const report: LtvCacReport = {
    ecosystem: input.ecosystem,
    currency,
    minorUnitExponent: CURRENCY_MINOR_EXPONENT[currency],
    aov: {
      baselineAovMinor: baselineAov,
      bnplOrderAovMinor: toMinor(bnplOrderAov),
      blendedAovMinor: toMinor(blendedAov),
      aovLiftRate: blendedAov / baselineAov - 1,
      effectiveConversionRate: effectiveConversion,
      baselineRevenuePerVisitorMinor: toMinor(baselineRpv),
      revenuePerVisitorMinor: toMinor(rpv),
      revenuePerVisitorLiftRate: rpv / baselineRpv - 1,
    },
    margin: {
      baselineContributionPerOrderMinor: toMinor(baselineContribution),
      contributionPerOrderMinor: toMinor(contribution),
      effectivePaymentFeeRate: effectiveFeeRate,
      contributionPerVisitorDeltaMinor: toMinor(contributionPerVisitorDelta),
    },
    viral: {
      kFactor: k,
      viralMultiplier: multiplier,
      referredCustomersPerPaid: multiplier - 1,
      blendedCacMinor: toMinor(cacBlended),
      cacReductionRate: 1 - cacBlended / input.paidCacMinor,
    },
    annualContributionPerCustomerMinor: toMinor(annualContribution),
    ltvMinor: toMinor(ltv),
    ltvToPaidCac,
    ltvToBlendedCac,
    paybackMonths,
    health: classifyLtvCac(ltvToBlendedCac),
    breakEvenKFactor: breakEvenKFactor(ltv, input.paidCacMinor, input.referralRewardMinor, input.targetLtvToCac),
  };

  assertReportFinite(report);
  return report;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Display helper (locale-aware, no Intl dependency on currency data)
 * ═══════════════════════════════════════════════════════════════════════════ */

export function formatMinor(amountMinor: number, currency: Currency): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new GrowthModelError(`amountMinor must be a safe integer, received ${amountMinor}.`);
  }
  const exponent = CURRENCY_MINOR_EXPONENT[currency];
  const major = amountMinor / 10 ** exponent;
  if (currency === 'IRT') {
    return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(major)} تومان`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(major);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Internals
 * ═══════════════════════════════════════════════════════════════════════════ */

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new GrowthModelError(`${name} must be a finite number, received ${value}.`);
  }
}

/** Single rounding point; half away from zero so negative contributions round symmetrically. */
function toMinor(value: number): number {
  assertFinite('money', value);
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  if (!Number.isSafeInteger(rounded)) {
    throw new GrowthModelError(`Money value ${value} exceeds the safe integer range.`);
  }
  return rounded === 0 ? 0 : rounded; // normalise -0
}

function assertReportFinite(report: LtvCacReport): void {
  const ratios: ReadonlyArray<readonly [string, number]> = [
    ['aov.aovLiftRate', report.aov.aovLiftRate],
    ['aov.revenuePerVisitorLiftRate', report.aov.revenuePerVisitorLiftRate],
    ['margin.effectivePaymentFeeRate', report.margin.effectivePaymentFeeRate],
    ['viral.kFactor', report.viral.kFactor],
    ['viral.viralMultiplier', report.viral.viralMultiplier],
    ['ltvToPaidCac', report.ltvToPaidCac],
  ];
  for (const [name, value] of ratios) assertFinite(name, value);
}