"use client";

import * as React from "react";
import {
  Flame,
  Radio,
  Sliders,
  AlertOctagon,
  Timer,
  RefreshCw,
  Cpu,
  WifiOff,
  ShieldAlert,
  Dice5,
  Play,
  RotateCcw,
  Zap,
} from "lucide-react";
import {
  useEcosystemStore,
  ChaosPreset,
  CHAOS_PRESETS,
} from "@/store/useEcosystemStore";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";

export function ChaosController() {
  const {
    currentEcosystem,
    xRayMode,
    chaosConfig,
    updateChaosConfig,
    resetChaosConfig,
    applyChaosPreset,
    executeSimulation,
    isSimulating,
  } = useEcosystemStore();

  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  // Quick preset detector to highlight active preset if match
  const activePreset = React.useMemo<ChaosPreset | null>(() => {
    const keys = Object.keys(CHAOS_PRESETS) as ChaosPreset[];
    for (const key of keys) {
      const p = CHAOS_PRESETS[key];
      const match =
        (p.networkPartition === undefined || p.networkPartition === chaosConfig.networkPartition) &&
        (p.vpnDetected === undefined || p.vpnDetected === chaosConfig.vpnDetected) &&
        (p.gatewayFailureRate === undefined || Math.abs(p.gatewayFailureRate - chaosConfig.gatewayFailureRate) < 0.01) &&
        (p.hardDeclineRatio === undefined || Math.abs(p.hardDeclineRatio - chaosConfig.hardDeclineRatio) < 0.01);
      if (match) return key;
    }
    return null;
  }, [chaosConfig]);

  const handleRerollSeed = () => {
    const nextSeed = Math.floor(Math.random() * 0xffffffff);
    updateChaosConfig({ seed: nextSeed });
  };

  const handleExecute = async () => {
    try {
      await executeSimulation();
    } catch {
      // Handled via DAG visualizer state
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border-default bg-surface-primary/80 backdrop-blur-sm p-5 shadow-lg relative overflow-hidden transition-all">
      {/* Background ambient fault glow */}
      <div
        className={cn(
          "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-opacity duration-500",
          chaosConfig.networkPartition
            ? "bg-rose-500/20 opacity-100"
            : chaosConfig.enabled
              ? "bg-rose-500/10 opacity-70"
              : "bg-surface-tertiary opacity-20"
        )}
      />

      {/* Card Header & Master Killswitch */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                chaosConfig.enabled
                  ? "bg-rose-500/15 text-rose-400"
                  : "bg-surface-tertiary text-text-muted"
              )}
            >
              <Flame className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              {isIran
                ? "کنترلر مهندسی آشوب (Chaos Controller)"
                : "Chaos Engineering Controller"}
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            {isIran
              ? "تزریق اختلال زنده در اتصالات بانکی شاپرک، سناریوهای تاخیر شبکه، قطعی سوئیچ و تداخل VPN"
              : "Live fault injection: simulated network partitions, Stripe downtime, and latency jitter."}
          </p>
        </div>

        {/* Master Enabled / Disabled Toggle */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => updateChaosConfig({ enabled: !chaosConfig.enabled })}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold transition-all border cursor-pointer",
              chaosConfig.enabled
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 shadow-sm shadow-rose-950"
                : "bg-surface-tertiary border-border-default text-text-muted"
            )}
            title="Toggle Master Chaos Injection Engine"
          >
            <Radio
              className={cn(
                "w-3 h-3",
                chaosConfig.enabled
                  ? "text-rose-400 animate-pulse"
                  : "text-text-subtle"
              )}
            />
            <span>{chaosConfig.enabled ? "CHAOS ARMED" : "BYPASS (OFF)"}</span>
          </button>
          <span className="text-[10px] font-mono text-text-subtle">
            PRNG: #{chaosConfig.seed.toString(16).slice(0, 6)}
          </span>
        </div>
      </div>

      {/* Recruiter / CTO X-Ray Architecture Note */}
      {xRayMode && (
        <div className="my-3 p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-200 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>[CTO ARCHITECTURE: Circuit Breaker & Chaos Simulator]</span>
            </div>
            <span className="text-[10px] text-purple-300/80">
              Deterministic Mulberry32
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-purple-200/80">
            Simulates distributed failure topologies with bounded recovery cycles:
            <code className="text-white mx-1">CLOSED</code> (normal) →
            <code className="text-white mx-1">OPEN</code> (fast-fail) →
            <code className="text-white mx-1">HALF-OPEN</code> (probe trial).
            Retries employ AWS Full Jitter:
            <code className="text-white ml-1">U(0, min(cap, base · 2^(attempt-1)))</code>.
          </p>
        </div>
      )}

      {/* Preset Quick Actions Bar */}
      <div className="my-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-text-subtle">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-brand" />
            {isIran ? "سناریوهای از پیش تنظیم شده:" : "Quick Fault Scenarios:"}
          </span>
          <button
            type="button"
            onClick={resetChaosConfig}
            className="flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>{isIran ? "بازنشانی" : "Reset"}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => applyChaosPreset("baseline")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer",
              activePreset === "baseline"
                ? "bg-status-success/15 border-status-success/40 text-status-success"
                : "bg-surface-secondary border-border-subtle text-text-secondary hover:bg-surface-tertiary"
            )}
          >
            <span>{isIran ? "شبکه پایدار (عادی)" : "Healthy Baseline"}</span>
            <StatusDot status="healthy" pulse={false} />
          </button>

          <button
            type="button"
            onClick={() => applyChaosPreset("highLatency")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer",
              activePreset === "highLatency"
                ? "bg-status-warning/15 border-status-warning/40 text-status-warning"
                : "bg-surface-secondary border-border-subtle text-text-secondary hover:bg-surface-tertiary"
            )}
          >
            <span>{isIran ? "تاخیر و نوسان بالا" : "Latency Jitter"}</span>
            <Timer className="w-3 h-3 text-status-warning" />
          </button>

          <button
            type="button"
            onClick={() => applyChaosPreset("retryStorm")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer",
              activePreset === "retryStorm"
                ? "bg-brand-subtle border-brand-border text-brand"
                : "bg-surface-secondary border-border-subtle text-text-secondary hover:bg-surface-tertiary"
            )}
          >
            <span>{isIran ? "طوفان تلاش مجدد (91)" : "Retry Storm (500s)"}</span>
            <RefreshCw className="w-3 h-3 text-brand" />
          </button>

          <button
            type="button"
            onClick={() => applyChaosPreset("hardDecline")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer",
              activePreset === "hardDecline"
                ? "bg-status-danger/15 border-status-danger/40 text-status-danger"
                : "bg-surface-secondary border-border-subtle text-text-secondary hover:bg-surface-tertiary"
            )}
          >
            <span>{isIran ? "خطای قطعی (برگشت سند)" : "Hard Declines (Rollback)"}</span>
            <AlertOctagon className="w-3 h-3 text-status-danger" />
          </button>

          <button
            type="button"
            onClick={() => applyChaosPreset("networkPartition")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer",
              activePreset === "networkPartition"
                ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                : "bg-surface-secondary border-border-subtle text-text-secondary hover:bg-surface-tertiary"
            )}
          >
            <span>{isIran ? "قطع کامل شبکه" : "Network Partition"}</span>
            <WifiOff className="w-3 h-3 text-rose-400" />
          </button>

          {isIran ? (
            <button
              type="button"
              onClick={() => applyChaosPreset("vpnGeoBlock")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer",
                activePreset === "vpnGeoBlock"
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                  : "bg-surface-secondary border-border-subtle text-text-secondary hover:bg-surface-tertiary"
              )}
            >
              <span>بلاک امنیتی VPN</span>
              <ShieldAlert className="w-3 h-3 text-amber-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRerollSeed}
              className="px-2.5 py-1.5 rounded-lg border border-border-subtle bg-surface-secondary hover:bg-surface-tertiary text-text-secondary text-xs font-medium transition-all text-start flex items-center justify-between cursor-pointer"
            >
              <span>Re-roll Seed</span>
              <Dice5 className="w-3 h-3 text-text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-2 flex-1">
        {/* Control Box 1: Latency & Jitter */}
        <div className="p-3.5 rounded-xl bg-surface-secondary/70 border border-border-subtle flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-text-subtle" />
              {isIran ? "تاخیر و نوسان شبکه (Latency & Jitter)" : "Simulated Latency & Jitter"}
            </span>
            <span className="text-xs font-mono font-bold text-brand">
              {chaosConfig.latency.baseMs}ms + {chaosConfig.latency.jitterMs}ms
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                <span>{isIran ? "تاخیر پایه:" : "Base Latency:"}</span>
                <span className="text-text-primary">{chaosConfig.latency.baseMs}ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={chaosConfig.latency.baseMs}
                onChange={(e) =>
                  updateChaosConfig({
                    latency: {
                      ...chaosConfig.latency,
                      baseMs: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                <span>{isIran ? "نوسان تصادفی (Jitter):" : "Random Jitter:"}</span>
                <span className="text-text-primary">{chaosConfig.latency.jitterMs}ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="2500"
                step="50"
                value={chaosConfig.latency.jitterMs}
                onChange={(e) =>
                  updateChaosConfig({
                    latency: {
                      ...chaosConfig.latency,
                      jitterMs: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
              />
            </div>

            {/* Iranian dynamic password OTP latency or Gateway Timeout in Global */}
            {isIran ? (
              <div className="pt-1.5 border-t border-border-subtle/60">
                <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                  <span className="text-amber-300">تاخیر پیامک رمز پویا (هریم):</span>
                  <span className="text-amber-300 font-bold">{chaosConfig.smsOtpLatencyMs}ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={chaosConfig.smsOtpLatencyMs}
                  onChange={(e) =>
                    updateChaosConfig({ smsOtpLatencyMs: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            ) : (
              <div className="pt-1.5 border-t border-border-subtle/60">
                <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                  <span>3DS / Gateway Timeout:</span>
                  <span className="text-text-primary font-bold">
                    {chaosConfig.gatewayTimeoutMs}ms
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="500"
                  value={chaosConfig.gatewayTimeoutMs}
                  onChange={(e) =>
                    updateChaosConfig({ gatewayTimeoutMs: Number(e.target.value) })
                  }
                  className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-brand"
                />
              </div>
            )}
          </div>
        </div>

        {/* Control Box 2: Failure Rates & Declines */}
        <div className="p-3.5 rounded-xl bg-surface-secondary/70 border border-border-subtle flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              {isIran ? "نرخ خرابی درگاه و برگشت" : "Gateway Failure & Decline Rate"}
            </span>
            <span
              className={cn(
                "text-xs font-mono font-bold",
                chaosConfig.gatewayFailureRate > 0.5
                  ? "text-rose-400"
                  : chaosConfig.gatewayFailureRate > 0
                    ? "text-amber-400"
                    : "text-emerald-400"
              )}
            >
              {Math.round(chaosConfig.gatewayFailureRate * 100)}%
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                <span>{isIran ? "نرخ عدم موفقیت تلاش:" : "Gateway Failure Rate:"}</span>
                <span className="text-text-primary">
                  {Math.round(chaosConfig.gatewayFailureRate * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={chaosConfig.gatewayFailureRate}
                onChange={(e) =>
                  updateChaosConfig({ gatewayFailureRate: Number(e.target.value) })
                }
                className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-rose-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-mono text-text-muted mb-1">
                <span>{isIran ? "سهم خطای قطعی (Hard Decline):" : "Hard Decline Share:"}</span>
                <span className="text-text-primary">
                  {Math.round(chaosConfig.hardDeclineRatio * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={chaosConfig.hardDeclineRatio}
                onChange={(e) =>
                  updateChaosConfig({ hardDeclineRatio: Number(e.target.value) })
                }
                className="w-full h-1.5 bg-surface-tertiary rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Error Catalogue Snippet */}
            <div className="pt-1.5 border-t border-border-subtle/60 flex items-center justify-between text-[10px] font-mono text-text-subtle">
              <span>{isIran ? "کدهای خطای شاپرک:" : "Simulated Codes:"}</span>
              <span className="text-text-muted">
                {isIran ? "14, 41, 51, 54, 55 (قطعی) / 91 (تلاش)" : "do_not_honor, 500, 429, 3ds_timeout"}
              </span>
            </div>
          </div>
        </div>

        {/* Control Box 3: Network Partition Toggle */}
        <div
          className={cn(
            "p-3.5 rounded-xl border flex items-center justify-between transition-colors",
            chaosConfig.networkPartition
              ? "bg-rose-950/40 border-rose-500/50"
              : "bg-surface-secondary/70 border-border-subtle"
          )}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <WifiOff
                className={cn(
                  "w-4 h-4",
                  chaosConfig.networkPartition ? "text-rose-400" : "text-text-subtle"
                )}
              />
              <span className="text-xs font-bold text-text-primary">
                {isIran ? "قطع کامل ارتباط (Partition)" : "Network Partition"}
              </span>
            </div>
            <p className="text-[11px] text-text-muted">
              {isIran
                ? "قطع فیزیکی ارتباط با مرکز شاپرک (سوئیچ بانکی در دسترس نیست)"
                : "Simulates socket drops & packet loss to Stripe API Edge."}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              updateChaosConfig({ networkPartition: !chaosConfig.networkPartition })
            }
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              chaosConfig.networkPartition ? "bg-rose-500" : "bg-surface-tertiary"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                chaosConfig.networkPartition ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Control Box 4: VPN Detection (Single-Atom Synced) */}
        <div
          className={cn(
            "p-3.5 rounded-xl border flex items-center justify-between transition-colors",
            chaosConfig.vpnDetected
              ? "bg-amber-950/40 border-amber-500/50"
              : "bg-surface-secondary/70 border-border-subtle"
          )}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <ShieldAlert
                className={cn(
                  "w-4 h-4",
                  chaosConfig.vpnDetected ? "text-amber-400" : "text-text-subtle"
                )}
              />
              <span className="text-xs font-bold text-text-primary">
                {isIran ? "آی‌پی غیرایران / فیلترشکن" : "VPN / Geo-Block Filter"}
              </span>
              {isIran && (
                <Badge variant="warning" size="sm" className="font-mono text-[9px]">
                  شاپرک
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              {isIran
                ? "بلاک امنیتی تراکنش در صورت اتصال فیلترشکن (Callback Geo-Fence)"
                : "Simulate non-domestic egress routing & callback security."}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              updateChaosConfig({ vpnDetected: !chaosConfig.vpnDetected })
            }
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              chaosConfig.vpnDetected ? "bg-amber-500" : "bg-surface-tertiary"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                chaosConfig.vpnDetected ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <Sliders className="w-3.5 h-3.5 text-text-subtle" />
          <span>
            {isIran ? "وضعیت تزریق:" : "Fault Injector:"}{" "}
            <strong className={chaosConfig.enabled ? "text-rose-400" : "text-text-muted"}>
              {chaosConfig.enabled ? "ARMED" : "DISABLED"}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetChaosConfig}
            className="font-mono text-xs"
          >
            <RefreshCw className="w-3 h-3 ml-1 rtl:mr-1" />
            {isIran ? "بازنشانی تنظیمات" : "Reset Baseline"}
          </Button>

          <Button
            variant="danger"
            size="sm"
            isLoading={isSimulating}
            onClick={handleExecute}
            className="font-mono text-xs cursor-pointer shadow-md shadow-rose-950/50"
          >
            <Play className="w-3 h-3 ml-1 rtl:mr-1 fill-current" />
            {isIran ? "اجرای سناریوی آشوب در DAG" : "Inject Chaos into DAG"}
          </Button>
        </div>
      </div>
    </div>
  );
}
