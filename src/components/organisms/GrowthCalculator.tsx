"use client";

import * as React from "react";
import {
  TrendingUp,
  Percent,
  Users,
  HelpCircle,
  Cpu,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import {
  computeBnplGrowth,
  formatMinor,
  type BnplGrowthInputRaw,
  type LtvCacReport,
  type LtvCacHealth,
} from "@/core/growth-engine/bnpl-calculator";

export function GrowthCalculator() {
  const { currentEcosystem, config, xRayMode } = useEcosystemStore();
  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  // Active tooltip state for CTO X-Ray math explanations
  const [activeTooltip, setActiveTooltip] = React.useState<string | null>(null);

  // Ecosystem-specific default state
  const defaultInputs = React.useMemo<BnplGrowthInputRaw>(() => {
    if (isIran) {
      return {
        ecosystem: "IRAN_SHAPARAK",
        baselineAovMinor: 850000, // 850,000 Toman
        baselineConversionRate: 0.02, // 2%
        grossMarginRate: 0.45, // 45%
        standardPaymentFeeRate: 0.01, // 1% Shaparak
        bnplAdoptionRate: 0.28, // 28% SnappPay
        bnplAovUpliftRate: 0.4, // +40%
        bnplConversionUpliftRate: 0.22, // +22%
        bnplMerchantFeeRate: 0.045, // 4.5% SnappPay fee
        bnplFixedFeeMinor: 0,
        ordersPerYear: 3.2,
        annualRetentionRate: 0.55,
        annualDiscountRate: 0.35, // 35% nominal discount rate (inflation)
        paidCacMinor: 240000, // 240,000 Toman
        invitesPerCustomer: 3.2,
        inviteConversionRate: 0.12, // K = 0.384
        referralRewardMinor: 35000, // 35,000 Toman
        viralCycles: null, // Steady state
        targetLtvToCac: 3.0,
      };
    }
    return {
      ecosystem: "GLOBAL_STRIPE",
      baselineAovMinor: 8500, // $85.00
      baselineConversionRate: 0.025, // 2.5%
      grossMarginRate: 0.65, // 65%
      standardPaymentFeeRate: 0.029, // 2.9% Stripe
      bnplAdoptionRate: 0.25, // 25% Klarna
      bnplAovUpliftRate: 0.35, // +35%
      bnplConversionUpliftRate: 0.2, // +20%
      bnplMerchantFeeRate: 0.055, // 5.5% Klarna
      bnplFixedFeeMinor: 30, // $0.30
      ordersPerYear: 2.5,
      annualRetentionRate: 0.6,
      annualDiscountRate: 0.1, // 10%
      paidCacMinor: 4500, // $45.00
      invitesPerCustomer: 2.8,
      inviteConversionRate: 0.15, // K = 0.42
      referralRewardMinor: 1000, // $10.00
      viralCycles: null, // Steady state
      targetLtvToCac: 3.0,
    };
  }, [isIran]);

  const [prevEcosystem, setPrevEcosystem] = React.useState(currentEcosystem);
  const [overrides, setOverrides] = React.useState<Partial<BnplGrowthInputRaw>>({});

  if (prevEcosystem !== currentEcosystem) {
    setPrevEcosystem(currentEcosystem);
    setOverrides({});
  }

  const inputs: BnplGrowthInputRaw = React.useMemo(
    () => ({
      ...defaultInputs,
      ...overrides,
    }),
    [defaultInputs, overrides]
  );

  // Safely compute the report
  const report = React.useMemo<LtvCacReport | null>(() => {
    try {
      return computeBnplGrowth(inputs);
    } catch {
      return null;
    }
  }, [inputs]);

  const updateInput = <K extends keyof BnplGrowthInputRaw>(
    key: K,
    value: BnplGrowthInputRaw[K]
  ) => {
    setOverrides((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const getHealthBadge = (health: LtvCacHealth, ratio: number) => {
    switch (health) {
      case "HEALTHY":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-success/15 border border-status-success/30 text-status-success font-mono font-bold text-xs">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>HEALTHY ({ratio.toFixed(2)}x)</span>
          </div>
        );
      case "MARGINAL":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-warning/15 border border-status-warning/30 text-status-warning font-mono font-bold text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>MARGINAL ({ratio.toFixed(2)}x)</span>
          </div>
        );
      case "UNPROFITABLE":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-danger/15 border border-status-danger/30 text-status-danger font-mono font-bold text-xs">
            <XCircle className="w-3.5 h-3.5" />
            <span>UNPROFITABLE ({ratio.toFixed(2)}x)</span>
          </div>
        );
      case "UNDER_INVESTING":
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-info/15 border border-status-info/30 text-status-info font-mono font-bold text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>UNDER-INVESTING ({ratio.toFixed(2)}x)</span>
          </div>
        );
    }
  };

  const kValue = inputs.invitesPerCustomer * inputs.inviteConversionRate;

  return (
    <div className="flex flex-col h-full rounded-3xl border border-border-default bg-surface-primary/80 backdrop-blur-sm p-6 shadow-xl relative overflow-hidden transition-all">
      {/* Background ambient glow */}
      <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-status-success/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border-subtle relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-subtle text-brand">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-text-primary tracking-tight">
              {isIran
                ? "موتور محاسبات رشد فین‌تک و BNPL (Growth & Unit Economics)"
                : "Fintech Growth Engine & BNPL Unit Economics"}
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            {isIran
              ? `شبیه‌سازی اثر اقساط خرد ${config.bnplProvider} و حلقه ارجاع ویروسی (Viral Loop) بر LTV:CAC و بازگشت سرمایه`
              : `Interactive simulation of ${config.bnplProvider} adoption and viral referral loops on LTV:CAC and payback.`}
          </p>
        </div>

        {/* LTV:CAC Health Pill */}
        {report && (
          <div className="flex items-center gap-2 shrink-0">
            {getHealthBadge(report.health, report.ltvToBlendedCac)}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOverrides({})}
              className="font-mono text-xs cursor-pointer"
              title="Reset baseline growth parameters"
            >
              <RotateCcw className="w-3 h-3 ml-1 rtl:mr-1" />
              {isIran ? "پیش‌فرض" : "Reset"}
            </Button>
          </div>
        )}
      </div>

      {/* Recruiter / CTO X-Ray Mathematical Formulation Box */}
      {xRayMode && (
        <div className="my-4 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-200 animate-in fade-in duration-200 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-purple-300">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>[CTO ARCHITECTURE: Unit Economics & Viral Growth Dynamics]</span>
            </div>
            <Badge variant="xray" size="sm">
              CLOSED-FORM SOLVER
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed text-purple-200/90 pt-1">
            <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20">
              <span className="font-bold text-purple-300 block mb-1">
                1. Viral Multiplier (M):
              </span>
              <code>M = 1 / (1 - K)</code> where <code>K = i · c</code>. As long as{" "}
              <code>K &lt; 1</code>, customer acquisition compounds via infinite geometric progression.
            </div>
            <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20">
              <span className="font-bold text-purple-300 block mb-1">
                2. Blended CAC Amortization:
              </span>
              <code>CAC_blended = (CAC_paid + R·(M-1)) / M</code>. Referral rewards (R) dilute paid acquisition cost.
            </div>
            <div className="p-2.5 rounded-xl bg-purple-900/30 border border-purple-500/20">
              <span className="font-bold text-purple-300 block mb-1">
                3. Gupta–Lehmann Discounted LTV:
              </span>
              <code>LTV = m · (1 + d) / (1 + d - r)</code>. Nominal discount rate (d) reflects cost of capital & inflation.
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout: Left Inputs, Right KPI Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-4 flex-1 relative z-10">
        {/* Left Column: Interactive Input Controls (7 Columns) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Section 1: Baseline Checkout & BNPL Adoption */}
          <div className="p-4 rounded-2xl bg-surface-secondary/70 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle/60">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-brand" />
                {isIran ? "سبد خرید و نفوذ اقساطی (BNPL)" : "Checkout Funnel & BNPL Uplift"}
              </span>
              <span className="text-[11px] font-mono text-brand font-semibold">
                {config.bnplProvider}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Baseline AOV */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "میانگین سبد (AOV):" : "Baseline AOV:"}</span>
                  <span className="text-text-primary font-bold">
                    {formatMinor(inputs.baselineAovMinor, config.currency === "TOMAN" ? "IRT" : "USD")}
                  </span>
                </div>
                <input
                  type="range"
                  min={isIran ? 100000 : 1000}
                  max={isIran ? 3000000 : 30000}
                  step={isIran ? 50000 : 500}
                  value={inputs.baselineAovMinor}
                  onChange={(e) => updateInput("baselineAovMinor", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* BNPL Adoption Rate */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "سهم پرداخت اقساطی:" : "BNPL Share of Orders:"}</span>
                  <span className="text-text-primary font-bold">
                    {Math.round(inputs.bnplAdoptionRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.02"
                  value={inputs.bnplAdoptionRate}
                  onChange={(e) => updateInput("bnplAdoptionRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* BNPL AOV Uplift */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "رشد مبلغ سبد با BNPL:" : "BNPL AOV Lift Rate:"}</span>
                  <span className="text-emerald-400 font-bold">
                    +{Math.round(inputs.bnplAovUpliftRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={inputs.bnplAovUpliftRate}
                  onChange={(e) => updateInput("bnplAovUpliftRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* BNPL Conversion Uplift */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "رشد نرخ تبدیل (Conversion):" : "Conversion Lift:"}</span>
                  <span className="text-emerald-400 font-bold">
                    +{Math.round(inputs.bnplConversionUpliftRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.02"
                  value={inputs.bnplConversionUpliftRate}
                  onChange={(e) => updateInput("bnplConversionUpliftRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Gross Margin */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "حاشیه سود ناخالص:" : "Gross Margin:"}</span>
                  <span className="text-text-primary font-bold">
                    {Math.round(inputs.grossMarginRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={inputs.grossMarginRate}
                  onChange={(e) => updateInput("grossMarginRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* BNPL Merchant Fee Rate */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "کارمزد پذیرنده BNPL:" : "BNPL Merchant Fee:"}</span>
                  <span className="text-rose-400 font-bold">
                    {(inputs.bnplMerchantFeeRate * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.1"
                  step="0.005"
                  value={inputs.bnplMerchantFeeRate}
                  onChange={(e) => updateInput("bnplMerchantFeeRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-rose-400"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Acquisition & Viral Referral Loop */}
          <div className="p-4 rounded-2xl bg-surface-secondary/70 border border-border-subtle space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle/60">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand" />
                {isIran ? "حلقه ارجاع ویروسی و جذب مشتری (Viral Loop & CAC)" : "Acquisition & Viral Growth Loop"}
              </span>
              <span className="text-[11px] font-mono text-text-subtle">
                K-Factor = {kValue.toFixed(3)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Paid CAC */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "هزینه جذب مستقیم (Paid CAC):" : "Direct Paid CAC:"}</span>
                  <span className="text-text-primary font-bold">
                    {formatMinor(inputs.paidCacMinor, config.currency === "TOMAN" ? "IRT" : "USD")}
                  </span>
                </div>
                <input
                  type="range"
                  min={isIran ? 50000 : 1000}
                  max={isIran ? 1000000 : 15000}
                  step={isIran ? 25000 : 250}
                  value={inputs.paidCacMinor}
                  onChange={(e) => updateInput("paidCacMinor", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* Referral Reward */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "پاداش دعوت (Referral Reward):" : "Referral Reward Cost:"}</span>
                  <span className="text-text-primary font-bold">
                    {formatMinor(inputs.referralRewardMinor, config.currency === "TOMAN" ? "IRT" : "USD")}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={isIran ? 200000 : 3500}
                  step={isIran ? 5000 : 100}
                  value={inputs.referralRewardMinor}
                  onChange={(e) => updateInput("referralRewardMinor", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* Invites Per Customer */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "دعوت‌های ارسالی هر کاربر:" : "Invites per Customer:"}</span>
                  <span className="text-text-primary font-bold">
                    {inputs.invitesPerCustomer.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.2"
                  value={inputs.invitesPerCustomer}
                  onChange={(e) => updateInput("invitesPerCustomer", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* Invite Conversion */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "نرخ پذیرش دعوت:" : "Invite Conversion:"}</span>
                  <span className="text-text-primary font-bold">
                    {(inputs.inviteConversionRate * 100).toFixed(1)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.3"
                  step="0.01"
                  value={inputs.inviteConversionRate}
                  onChange={(e) => updateInput("inviteConversionRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* Retention Rate */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "ماندگاری سالانه مشتری:" : "Annual Retention Rate:"}</span>
                  <span className="text-text-primary font-bold">
                    {Math.round(inputs.annualRetentionRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.9"
                  step="0.05"
                  value={inputs.annualRetentionRate}
                  onChange={(e) => updateInput("annualRetentionRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>

              {/* Annual Discount Rate */}
              <div>
                <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                  <span>{isIran ? "نرخ تنزیل (تورم):" : "Discount Rate:"}</span>
                  <span className="text-text-primary font-bold">
                    {Math.round(inputs.annualDiscountRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.6"
                  step="0.05"
                  value={inputs.annualDiscountRate}
                  onChange={(e) => updateInput("annualDiscountRate", Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Executive KPI Board (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          {report ? (
            <div className="space-y-3">
              {/* Top Highlight: LTV vs Blended CAC Primary Card */}
              <div className="p-4 rounded-2xl bg-surface-secondary/90 border border-brand/30 shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
                    {isIran ? "ارزش چرخه عمر به هزینه جذب" : "Executive Ratio"}
                  </span>
                  <Badge variant="brand" size="sm" className="font-mono text-xs font-bold">
                    Target: {inputs.targetLtvToCac}x
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <div className="space-y-0.5">
                    <span className="text-xs text-text-subtle font-mono">LTV:CAC (Blended)</span>
                    <div className="text-3xl font-extrabold text-brand font-mono">
                      {report.ltvToBlendedCac.toFixed(2)}x
                    </div>
                  </div>

                  <div className="text-end space-y-0.5">
                    <span className="text-xs text-text-subtle font-mono">Paid LTV:CAC</span>
                    <div className="text-lg font-bold text-text-secondary font-mono">
                      {report.ltvToPaidCac.toFixed(2)}x
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
                  <span>{isIran ? "دوره بازگشت سرمایه:" : "Payback Horizon:"}</span>
                  <span className="text-text-primary font-bold">
                    {report.paybackMonths !== null
                      ? `${report.paybackMonths.toFixed(1)} ${isIran ? "ماه" : "months"}`
                      : "Unprofitable"}
                  </span>
                </div>
              </div>

              {/* 4-Cell Metric Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Metric 1: Blended LTV */}
                <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                  <span className="text-[11px] font-mono text-text-subtle block">
                    {isIran ? "ارزش چرخه عمر (LTV):" : "Discounted LTV:"}
                  </span>
                  <div className="text-sm font-bold text-text-primary font-mono truncate">
                    {formatMinor(report.ltvMinor, report.currency)}
                  </div>
                  <span className="text-[10px] text-text-muted block">
                    {report.annualContributionPerCustomerMinor > 0 ? (
                      <span className="text-emerald-400">
                        {isIran ? "سودآور در دوره نگه‌داشت" : "Positive margin"}
                      </span>
                    ) : (
                      <span className="text-rose-400">Negative contribution</span>
                    )}
                  </span>
                </div>

                {/* Metric 2: Blended CAC */}
                <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                  <span className="text-[11px] font-mono text-text-subtle block">
                    {isIran ? "هزینه جذب رقیق‌شده:" : "Blended CAC:"}
                  </span>
                  <div className="text-sm font-bold text-text-primary font-mono truncate">
                    {formatMinor(report.viral.blendedCacMinor, report.currency)}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono block">
                    -{(report.viral.cacReductionRate * 100).toFixed(1)}% via Viral Loop
                  </span>
                </div>

                {/* Metric 3: Viral Multiplier */}
                <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-text-subtle">
                      {isIran ? "ضریب ویروسی (M):" : "Viral Multiplier:"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTooltip(activeTooltip === "viral" ? null : "viral")
                      }
                      className="text-text-subtle hover:text-text-primary cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-brand font-mono">
                    {report.viral.viralMultiplier.toFixed(2)}x
                  </div>
                  <span className="text-[10px] text-text-muted font-mono block">
                    K = {report.viral.kFactor.toFixed(3)}
                  </span>
                </div>

                {/* Metric 4: Revenue Per Visitor */}
                <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-text-subtle">
                      {isIran ? "درآمد به ازای بازدید:" : "Rev / Visitor (RPV):"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTooltip(activeTooltip === "rpv" ? null : "rpv")
                      }
                      className="text-text-subtle hover:text-text-primary cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm font-bold text-text-primary font-mono truncate">
                    {formatMinor(report.aov.revenuePerVisitorMinor, report.currency)}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono block">
                    +{(report.aov.revenuePerVisitorLiftRate * 100).toFixed(1)}% Net Lift
                  </span>
                </div>
              </div>

              {/* Tooltip Expansion Modal/Card */}
              {activeTooltip && (
                <div className="p-3 rounded-xl bg-surface-tertiary border border-border-default text-xs font-mono text-text-secondary space-y-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-text-primary font-bold">
                    <span>
                      {activeTooltip === "viral"
                        ? "Geometric Viral Multiplier (M)"
                        : "Revenue Per Visitor (RPV)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTooltip(null)}
                      className="text-text-subtle hover:text-text-primary cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    {activeTooltip === "viral"
                      ? "Calculated as M = 1 / (1 - K). Every customer brings K = i · c referred customers. Since K < 1, the series converges, yielding M customers for every 1 paid customer."
                      : "AOV lift alone can be misleading if conversion falls. RPV = Conversion × AOV. A positive RPV lift is the definitive condition for BNPL fee profitability."}
                  </p>
                </div>
              )}

              {/* Break-even K-Factor Target Indicator */}
              <div className="p-3 rounded-xl bg-surface-secondary/50 border border-border-subtle flex items-center justify-between text-xs font-mono">
                <span className="text-text-subtle">
                  {isIran ? "ضریب K سربه‌سر برای هدف ۳x:" : "Break-Even K for 3x LTV:CAC:"}
                </span>
                <span className="font-bold text-text-primary">
                  {report.breakEvenKFactor !== null
                    ? report.breakEvenKFactor === 0
                      ? isIran ? "بدون نیاز به ویروسی (محقق شد)" : "Met organically (K=0)"
                      : `K* = ${report.breakEvenKFactor.toFixed(3)}`
                    : isIran ? "غیرقابل دسترس با پاداش فعلی" : "Unreachable (Rewards too high)"}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-surface-secondary/50 border border-border-subtle text-center text-xs font-mono text-text-subtle">
              Input validation in progress...
            </div>
          )}

          {/* Bottom Card Summary Pill */}
          <div className="p-3 rounded-xl bg-surface-secondary/40 border border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              {isIran ? "واحد پول محاسبات:" : "Settlement Unit:"}{" "}
              <strong className="text-text-primary">{config.currency}</strong>
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Zero Rounding Drift
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
