import { describe, expect, it } from 'vitest';
import { blendedCac, breakEvenKFactor, computeBnplGrowth, discountedLtv, formatMinor, viralMultiplier, type BnplGrowthInputRaw } from '../bnpl-calculator';

const input: BnplGrowthInputRaw = {
  ecosystem: 'GLOBAL_STRIPE', baselineAovMinor: 10000, baselineConversionRate: 0.02,
  grossMarginRate: 0.5, standardPaymentFeeRate: 0.02,
  bnplAdoptionRate: 0, bnplAovUpliftRate: 0, bnplConversionUpliftRate: 0,
  bnplMerchantFeeRate: 0.05, bnplFixedFeeMinor: 0, ordersPerYear: 2,
  annualRetentionRate: 0, annualDiscountRate: 0, paidCacMinor: 3000,
  invitesPerCustomer: 0, inviteConversionRate: 0, referralRewardMinor: 0,
  viralCycles: null,
};

describe('growth model assumptions and boundaries', () => {
  it('reduces to baseline unit economics without BNPL, retention or referrals', () => {
    expect(computeBnplGrowth(input)).toMatchObject({
      currency: 'USD', minorUnitExponent: 2, ltvMinor: 9600,
      ltvToBlendedCac: 3.2, paybackMonths: 3.75,
      viral: { kFactor: 0, viralMultiplier: 1, blendedCacMinor: 3000 },
      margin: { contributionPerOrderMinor: 4800, contributionPerVisitorDeltaMinor: 0 },
    });
  });
  it('includes referral rewards in blended acquisition cost', () => {
    expect(blendedCac(100, 20, viralMultiplier(0.5, null))).toBe(60);
  });
  it('bounds a viral loop at K = 1 when a finite horizon is supplied', () => {
    expect(viralMultiplier(1, 4)).toBe(5);
    expect(() => viralMultiplier(1, null)).toThrow(/diverges/);
  });
  it('rejects a divergent steady state at the model boundary', () => {
    expect(() => computeBnplGrowth({ ...input, invitesPerCustomer: 2, inviteConversionRate: 0.5 })).toThrow();
  });
  it('keeps losses visible and reports that acquisition never pays back', () => {
    const report = computeBnplGrowth({ ...input, grossMarginRate: 0.01, standardPaymentFeeRate: 0.1 });
    expect(report.ltvMinor).toBeLessThan(0);
    expect(report.paybackMonths).toBeNull();
    expect(report.health).toBe('UNPROFITABLE');
  });
  it('discounts future retained contribution', () => {
    expect(discountedLtv(100, 0.5, 0)).toBe(200);
    expect(discountedLtv(100, 0.5, 0.5)).toBe(150);
  });
  it('identifies unreachable and already achieved acquisition targets', () => {
    expect(breakEvenKFactor(300, 100, 20, 3)).toBe(0);
    expect(breakEvenKFactor(30, 100, 20, 3)).toBeNull();
    expect(breakEvenKFactor(180, 100, 20, 3)).toBe(0.5);
  });
  it('keeps whole Toman separate from USD cents', () => {
    expect(formatMinor(4500, 'USD')).toBe('$45.00');
    const report = computeBnplGrowth({ ...input, ecosystem: 'IRAN_SHAPARAK' });
    expect(report).toMatchObject({ currency: 'IRT', minorUnitExponent: 0 });
    expect(formatMinor(4500, 'IRT')).toContain('تومان');
  });
});
