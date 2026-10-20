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
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Button } from "@/components/atoms/Button";

export function ChaosControllerSlot() {
  const { currentEcosystem, xRayMode } = useEcosystemStore();
  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border-default bg-surface-primary/80 backdrop-blur-sm p-5 shadow-lg relative overflow-hidden">
      {/* Background glowing gradient */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              {isIran ? "کنترلر مهندسی آشوب (Chaos Controller)" : "Chaos Engineering Controller"}
            </h2>
          </div>
          <p className="text-xs text-text-muted">
            {isIran
              ? "تزریق اختلال زنده در اتصالات بانکی شاپرک، سناریوهای تاخیر شبکه و قطعی گیت‌وی"
              : "Live fault injection: simulated network partitions, Stripe downtime, and latency jitter."}
          </p>
        </div>

        <Badge variant="warning" size="sm" className="shrink-0 font-mono">
          <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
          SIMULATION IDLE
        </Badge>
      </div>

      {/* Recruiter X-Ray Annotation */}
      {xRayMode && (
        <div className="my-3 p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-200">
          <div className="flex items-center gap-1.5 font-bold text-purple-300 mb-1">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            [CTO ARCHITECTURE: Circuit Breaker Pattern]
          </div>
          <p className="text-[11px] leading-relaxed text-purple-200/80">
            Engine uses a 3-state finite state machine (<code className="text-white">CLOSED</code> → <code className="text-white">OPEN</code> → <code className="text-white">HALF-OPEN</code>) with leaky-bucket rate limiting and jittered exponential backoff.
          </p>
        </div>
      )}

      {/* Main Chaos Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 flex-1">
        {/* Latency Injector */}
        <div className="p-4 rounded-xl bg-surface-secondary/70 border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-text-subtle" />
              {isIran ? "تاخیر ساختگی شبکه (Jitter/Lag)" : "Simulated Latency Spikes"}
            </span>
            <span className="text-xs font-mono font-bold text-brand">45ms (Baseline)</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-surface-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-linear-to-r from-emerald-500 to-amber-500 w-[15%]" />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-text-subtle">
              <span>0ms</span>
              <span>1500ms</span>
              <span>3000ms</span>
            </div>
          </div>
        </div>

        {/* Gateway Fault Mode */}
        <div className="p-4 rounded-xl bg-surface-secondary/70 border border-border-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              {isIran ? "شبیه‌سازی خطای درگاه" : "Gateway Failure Rate"}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400">0% (Healthy)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-subtle font-mono">Circuit State:</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold">
              <StatusDot status="healthy" pulse={false} />
              CLOSED (NORMAL)
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <Sliders className="w-3.5 h-3.5 text-text-subtle" />
          <span>Slot 01: Ready for Resilience Hooking</span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-mono text-xs">
            <RefreshCw className="w-3 h-3 ml-1" />
            Reset Baseline
          </Button>
          <Button variant="danger" size="sm" className="font-mono text-xs">
            Inject Chaos Scenario
          </Button>
        </div>
      </div>
    </div>
  );
}
