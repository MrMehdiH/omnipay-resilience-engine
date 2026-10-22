"use client";

import * as React from "react";
import {
  ShieldAlert,
  Server,
  Cpu,
  Activity,
  CheckCircle,
  Layers,
  Sparkles,
  Mail,
  ExternalLink,
  Award,
  Workflow,
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Header } from "@/components/organisms/Header";
import { VpnWarningBanner } from "@/components/molecules/VpnWarningBanner";
import { ChaosController } from "@/components/organisms/ChaosController";
import { DagVisualizer } from "@/components/organisms/DagVisualizer";
import { GrowthCalculator } from "@/components/organisms/GrowthCalculator";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Button } from "@/components/atoms/Button";

export default function Home() {
  const { currentEcosystem, config, xRayMode, triggerVpnSimulation } =
    useEcosystemStore();
  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-primary selection:bg-brand selection:text-white">
      {/* Sleek Navigation Header with Real-Time Ecosystem & X-Ray Switchers */}
      <Header />

      {/* Iran IPG VPN Geo-Fence Warning Banner Simulation */}
      <VpnWarningBanner />

      {/* Main Operations & Resilience Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* CTO Target Audience Hero Section */}
        <div className="relative rounded-3xl border border-border-default bg-surface-primary/70 backdrop-blur-xl p-6 sm:p-8 overflow-hidden shadow-2xl">
          {/* Ambient Glow Orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-subtle rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-70" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none opacity-50" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand" size="sm">
                  <Activity className="w-3 h-3 text-brand" />
                  {isIran ? "سیستم تاب‌آوری فین‌تک" : "Enterprise Resilience Showcase"}
                </Badge>
                <Badge variant="outline" size="sm" className="font-mono">
                  {config.currency} • {config.direction.toUpperCase()}
                </Badge>
                {isIran ? (
                  <Badge variant="warning" size="sm" className="font-sans">
                    فونت وزیرمتن فعال
                  </Badge>
                ) : (
                  <Badge variant="outline" size="sm" className="font-mono">
                    Inter & JetBrains Mono
                  </Badge>
                )}
                <Badge variant="xray" size="sm">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  CTO & VP ENG SHOWCASE
                </Badge>
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

              {/* Exact Mission Phrasing Required */}
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed font-normal">
                {isIran ? (
                  <>
                    <strong className="text-text-primary font-semibold">
                      Zero-Auth Interactive Sandbox demonstrating Idempotency, DAG-based transaction state machines, and Growth Loop economics.
                    </strong>{" "}
                    محیط آزمایشی تعاملی و بدون نیاز به لاگین جهت نمایش الگوهای پیشرفته تاب‌آوری توزیع‌شده فین‌تک: قفل یکتایی Idempotency، پایپ‌لاین گراف DAG، مهندسی آشوب زنده و مدل‌سازی رشد اقتصادی BNPL اسنپ‌پی و شبکه شاپرک.
                  </>
                ) : (
                  <>
                    <strong className="text-text-primary font-semibold">
                      Zero-Auth Interactive Sandbox demonstrating Idempotency, DAG-based transaction state machines, and Growth Loop economics.
                    </strong>{" "}
                    Built for Global and Iranian CTOs, VPs of Engineering, and Tech Recruiters to demonstrate production-grade distributed resilience patterns across Stripe, Klarna, Shaparak, and SnappPay payment rails.
                  </>
                )}
              </p>
            </div>

            {/* Quick Actions & Live Simulator Status Strip */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 w-full sm:w-auto shrink-0">
              <div className="p-3.5 rounded-2xl bg-surface-secondary/90 border border-border-subtle font-mono text-xs space-y-2 min-w-56 shadow-sm">
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
                <div className="flex items-center justify-between">
                  <span className="text-text-subtle">DAG Depth:</span>
                  <span className="text-text-primary">≤ 4 + 2·maxAttempts</span>
                </div>
              </div>

              {isIran && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={triggerVpnSimulation}
                  className="w-full text-xs font-sans text-amber-300 border-amber-500/40 hover:bg-amber-950/30 cursor-pointer"
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
          <div className="rounded-2xl border border-purple-500/50 bg-purple-950/20 backdrop-blur-md p-6 space-y-4 animate-in fade-in duration-300 shadow-xl">
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
                <span className="text-purple-400 font-semibold block">01. Pure TS Core</span>
                <p className="text-xs text-text-secondary leading-snug">
                  <code className="text-white">src/core/</code> holds zero React dependencies for testability, deterministic state, and portability.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold block">02. Zero `any` & Zod</span>
                <p className="text-xs text-text-secondary leading-snug">
                  <code className="text-white">src/schemas/</code> defines runtime contracts; inferred types enforce strict end-to-end safety.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold block">03. 3-Tier Design Tokens</span>
                <p className="text-xs text-text-secondary leading-snug">
                  <code className="text-white">tokens.css</code> enforces strict abstraction with zero hardcoded hex or arbitrary px.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-primary/70 border border-purple-500/20 space-y-1">
                <span className="text-purple-400 font-semibold block">04. Dual-Ecosystem</span>
                <p className="text-xs text-text-secondary leading-snug">
                  Real-time LTR/RTL, USD/Toman, Stripe/Shaparak, Klarna/SnappPay, and Vazirmatn font switching.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Clean Modern Dashboard Grid Layout */}
        <div className="space-y-8">
          {/* Top Row: Chaos Engineering Controller & Transaction DAG Visualizer */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Slot 01: Interactive Chaos Engineering Controller */}
            <section className="h-full">
              <ChaosController />
            </section>

            {/* Slot 02: Transaction Pipeline DAG Visualizer */}
            <section className="h-full">
              <DagVisualizer />
            </section>
          </div>

          {/* Bottom Row: Fintech Growth Engine & BNPL Unit Economics Calculator */}
          <section className="w-full">
            <GrowthCalculator />
          </section>
        </div>

        {/* Principal Architect Signature, LinkedIn Profile Showcase & Multi-Agent Orchestration */}
        <footer className="rounded-3xl border border-border-default bg-surface-primary/80 backdrop-blur-xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-border-subtle">
            {/* Architect Profile & LinkedIn Card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-secondary border border-border-default flex items-center justify-center font-mono text-xl font-extrabold text-brand shrink-0 shadow-md">
                MH
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-text-primary">
                    {isIran
                      ? "مهدی حیدری | Mehdi (Willam) Heydari"
                      : "Mehdi (Willam) Heydari | مهدی حیدری"}
                  </h2>
                  <Badge variant="brand" size="sm">
                    <Award className="w-3 h-3 text-brand" />
                    {isIran ? "مغز متفکر و معمار اصلی پروژه" : "Mastermind & Principal Architect"}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-text-secondary max-w-2xl leading-relaxed">
                  {isIran
                    ? "طراح سیستم، ایده‌پرداز و رهبر ارکستریشن هوش مصنوعی در پروژه OmniPay. هدایت و یکپارچه‌سازی چند ایجنت هوشمند برای خلق معماری توزیع‌شده و بدون خطا."
                    : "System Designer, Visionary & Multi-Agent AI Orchestrator. Directed the end-to-end architecture, domain modeling, and deterministic resilience engineering of OmniPay."}
                </p>
                {/* Featured LinkedIn Interactive Preview Bar */}
                <a
                  href="https://www.linkedin.com/in/mehdi-heydari-7b70b9291"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors pt-1"
                >
                  <span className="underline underline-offset-4">
                    linkedin.com/in/mehdi-heydari-7b70b9291
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Direct Interactive Contact & Social Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* LinkedIn Button */}
              <a
                href="https://www.linkedin.com/in/mehdi-heydari-7b70b9291"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-primary border border-border-default hover:border-brand text-xs font-semibold text-text-primary transition-all shadow-sm"
              >
                <svg className="w-4 h-4 text-indigo-400 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
                <span>LinkedIn</span>
                <ExternalLink className="w-3 h-3 text-text-subtle" />
              </a>

              {/* GitHub Button */}
              <a
                href="https://github.com/MrMehdiH"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-primary border border-border-default hover:border-brand text-xs font-semibold text-text-primary transition-all shadow-sm"
              >
                <svg className="w-4 h-4 text-text-primary fill-current" viewBox="0 0 24 24">
                  <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                </svg>
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3 text-text-subtle" />
              </a>

              {/* Telegram Button */}
              <a
                href="https://t.me/Build_Second_Brain_Owner"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-primary border border-border-default hover:border-brand text-xs font-semibold text-text-primary transition-all shadow-sm"
              >
                <svg className="w-4 h-4 text-teal-400 fill-current" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <span>Telegram</span>
                <ExternalLink className="w-3 h-3 text-text-subtle" />
              </a>

              {/* Email Button */}
              <a
                href="mailto:mr.mhd.2000p@gmail.com"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-secondary hover:bg-surface-primary border border-border-default hover:border-brand text-xs font-semibold text-text-primary transition-all shadow-sm"
              >
                <Mail className="w-4 h-4 text-amber-400" />
                <span>mr.mhd.2000p@gmail.com</span>
              </a>
            </div>
          </div>

          {/* Multi-Agent AI Collaboration Credits */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-text-subtle">
              <Workflow className="w-4 h-4 text-brand" />
              <span className="font-semibold text-text-primary">
                {isIran
                  ? "معماری مبتنی بر رهبری چند ایجنت هوشمند (Multi-Agent AI Orchestration):"
                  : "Multi-Agent AI Engineering & Orchestration:"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                <span className="font-bold text-brand block">
                  1. Mehdi (Willam) Heydari
                </span>
                <p className="text-text-secondary">
                  {isIran
                    ? "مغز متفکر، صاحب محصول، هدایتگر معماری و تصمیم‌گیرنده نهایی."
                    : "Mastermind, Product Owner & Principal System Architect."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                <span className="font-bold text-indigo-400 block">
                  2. Google Gemini
                </span>
                <p className="text-text-secondary">
                  {isIran
                    ? "همفکر استراتژیک، طراحی کلان سیستم و مهندسی پرامپت‌های اجرایی."
                    : "Co-Architect, System Strategy & Execution Orchestration."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                <span className="font-bold text-amber-400 block">
                  3. Anthropic Claude
                </span>
                <p className="text-text-secondary">
                  {isIran
                    ? "پیاده‌سازی هسته Pure TypeScript، ماشین حالت DAG و تست‌های Vitest."
                    : "Pure TypeScript Core Logic, DAG Engine & Deterministic Vitest Suite."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-surface-secondary/70 border border-border-subtle space-y-1">
                <span className="font-bold text-teal-400 block">
                  4. Antigravity IDE
                </span>
                <p className="text-text-secondary">
                  {isIran
                    ? "توسعه رابط کاربری واکنش‌گرا، سیستم توکن‌های ۳ لایه و داشبورد."
                    : "Reactive UI Integration, 3-Tier Design Tokens & Dashboard Assembly."}
                </p>
              </div>
            </div>
          </div>
        </footer>

        {/* Bottom Architectural Contracts & Telemetry Bar */}
        <div className="rounded-2xl border border-border-subtle bg-surface-primary/40 p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-text-muted">
          <div className="flex items-center gap-3">
            <Server className="w-4 h-4 text-text-subtle" />
            <span>Architecture: Next.js 16 App Router + React 19 + Zustand</span>
            <span className="text-border-strong">•</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              TypeScript Strict: true (0 any)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-brand" />
              Pure TS Core Isolated
            </span>
            <span className="text-border-strong">•</span>
            <span className="text-text-primary">Phase 4 Complete: Dashboard & Growth Engine</span>
          </div>
        </div>
      </main>
    </div>
  );
}