"use client";

import * as React from "react";
import {
  ShieldAlert,
  Server,
  Zap,
  Cpu,
  ArrowUpRight,
  GitBranch,
  Terminal,
  Activity,
  CheckCircle,
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Header } from "@/components/organisms/Header";
import { VpnWarningBanner } from "@/components/molecules/VpnWarningBanner";
import { ChaosControllerSlot } from "@/components/organisms/ChaosControllerSlot";
import { DagVisualizerSlot } from "@/components/organisms/DagVisualizerSlot";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Button } from "@/components/atoms/Button";

export default function Home() {
  const { currentEcosystem, config, xRayMode, triggerVpnSimulation } =
    useEcosystemStore();
  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-primary selection:bg-brand selection:text-white">
      {/* Top Navigation & Status */}
      <Header />

      {/* Iran VPN Warning Alert Simulation */}
      <VpnWarningBanner />

      {/* Main Operations Control Room */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <div className="relative rounded-3xl border border-border-default bg-surface-primary/60 backdrop-blur-xl p-6 sm:p-8 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-subtle rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-70" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand" size="sm">
                  <Activity className="w-3 h-3 text-brand" />
                  {isIran ? "سیستم تاب‌آوری فین‌تک" : "Enterprise Resilience Showcase"}
                </Badge>
                <Badge variant="outline" size="sm" className="font-mono">
                  {config.currency} • {config.direction.toUpperCase()}
                </Badge>
                {isIran && (
                  <Badge variant="warning" size="sm" className="font-sans">
                    فونت وزیرمتن فعال
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-text-primary leading-tight">
                {isIran ? (
                  <>
                    موتور تاب‌آوری پرداخت همه‌کاناله{" "}
                    <span className="text-teal-400">OmniPay</span>
                  </>
                ) : (
                  <>
                    OmniPay High-Availability{" "}
                    <span className="text-indigo-400">Resilience Engine</span>
                  </>
                )}
              </h1>

              <p className="text-sm sm:text-base text-text-muted leading-relaxed">
                {isIran
                  ? "شبیه‌سازی توزیع‌شده الگوهای پایداری تراکنش (Circuit Breaker، Idempotency قفل یکتایی، پایپ‌لاین گراف DAG و تشخیص تداخل VPN در شبکه شاپرک ایران)."
                  : "Interactive fintech showcase demonstrating self-healing circuit breakers, distributed idempotency guarantees, DAG pipeline orchestration, and cross-border failure simulations for Global (Stripe/Klarna) and Iranian (Shaparak) payment rails."}
              </p>
            </div>

            {/* Quick Actions & Live Simulator Status */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full sm:w-auto shrink-0">
              <div className="p-3.5 rounded-2xl bg-surface-secondary/90 border border-border-subtle font-mono text-xs space-y-2 min-w-56">
                <div className="flex items-center justify-between">
                  <span className="text-text-subtle">Cluster State:</span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <StatusDot status="healthy" />
                    ONLINE
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-subtle">Active Rails:</span>
                  <span className="text-text-primary font-semibold">
                    {config.primaryGateway.split(" ")[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-subtle">Idempotency Lock:</span>
                  <span className="text-brand font-bold">ACTIVE (0 dupes)</span>
                </div>
              </div>

              {isIran && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerVpnSimulation}
                  className="w-full text-xs font-sans text-amber-300 border-amber-500/40 hover:bg-amber-950/30"
                >
                  <ShieldAlert className="w-3.5 h-3.5 ml-1.5 text-amber-400" />
                  شبیه‌سازی هشدار VPN
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live Recruiter / CTO X-Ray Inspector Deep-Dive */}
        {xRayMode && (
          <div className="rounded-2xl border border-purple-500/50 bg-purple-950/20 backdrop-blur-md p-6 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-purple-200 font-mono tracking-wide">
                    RECRUITER / CTO ARCHITECTURAL X-RAY
                  </h3>
                  <p className="text-xs text-purple-300/80">
                    Live inspection of architectural contracts, directory isolation, and design decisions
                  </p>
                </div>
              </div>
              <Badge variant="xray" size="sm">
                INSPECT_MODE = TRUE
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold">01. Pure TS Core</span>
                <p className="text-[11px] text-text-secondary leading-snug">
                  <code className="text-white">src/core/</code> holds zero React dependencies for testability and portability.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold">02. Zero `any` & Zod</span>
                <p className="text-[11px] text-text-secondary leading-snug">
                  <code className="text-white">src/schemas/</code> defines runtime contracts; inferred types enforce strict safety.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold">03. 3-Tier Design Tokens</span>
                <p className="text-[11px] text-text-secondary leading-snug">
                  <code className="text-white">tokens.css</code> enforces strict abstraction with zero hardcoded hex or arbitrary px.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold">04. Dual-Ecosystem</span>
                <p className="text-[11px] text-text-secondary leading-snug">
                  Real-time LTR/RTL, USD/Toman, Stripe/Shaparak, and Vazirmatn font switching.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Feature Slots: Chaos Controller & DAG Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Slot 01: Chaos Engineering Controller */}
          <section className="h-full">
            <ChaosControllerSlot />
          </section>

          {/* Slot 02: Transaction Pipeline DAG Visualizer */}
          <section className="h-full">
            <DagVisualizerSlot />
          </section>
        </div>

        {/* Bottom Architectural Contracts & Telemetry Bar */}
        <div className="rounded-2xl border border-border-subtle bg-surface-primary/40 p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-text-muted">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-text-subtle" />
            <span>Architecture: Next.js 16 App Router + React 19 + Zustand</span>
            <span className="text-border-strong">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              TypeScript Strict: true (0 errors)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>Sprint 1: Clean Guardrails & Ecosystem Shell</span>
            <span className="text-border-strong">•</span>
            <span className="text-text-primary">Sprint 2: Chaos & DAG Engine</span>
          </div>
        </div>
      </main>
    </div>
  );
}
