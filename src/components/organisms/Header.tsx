"use client";

import * as React from "react";
import {
  Layers,
  Activity,
  Cpu,
  Shield,
  Zap,
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { EcosystemSwitcher } from "@/components/molecules/EcosystemSwitcher";
import { XRayToggle } from "@/components/molecules/XRayToggle";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";

export function Header() {
  const { currentEcosystem, config, xRayMode } = useEcosystemStore();
  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border-subtle bg-surface-primary/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-17 flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Active Rail */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-indigo-500/20 via-surface-secondary to-teal-500/20 border border-border-default shadow-sm group">
            <Layers className="w-5 h-5 text-text-primary transition-transform group-hover:scale-110" />
            <div className="absolute -bottom-1 -right-1">
              <StatusDot status="healthy" pulse />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-text-primary">
                OmniPay
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-surface-tertiary border border-border-default text-text-muted">
                v1.0-alpha
              </span>
              <Badge variant="brand" size="sm" className="hidden md:inline-flex">
                Resilience Engine
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-text-subtle" />
                {config.primaryGateway}
              </span>
              <span className="text-border-strong">•</span>
              <span className="text-text-subtle">{config.bnplProvider}</span>
            </div>
          </div>
        </div>

        {/* Center / Right: Interactive Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Cluster Telemetry Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-canvas/60 border border-border-subtle font-mono text-xs">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-text-muted">SLA:</span>
            <span className="text-emerald-400 font-bold">99.999%</span>
            <span className="text-border-strong">•</span>
            <span className="text-text-muted">P99:</span>
            <span className="text-text-primary">138ms</span>
          </div>

          {/* 1-Click Ecosystem Switcher */}
          <EcosystemSwitcher />

          {/* Recruiter / CTO X-Ray Toggle */}
          <XRayToggle />
        </div>
      </div>

      {/* Recruiter X-Ray Inspector Sub-Bar (When Active) */}
      {xRayMode && (
        <div className="border-t border-purple-500/30 bg-purple-950/40 px-4 py-2 animate-in slide-in-from-top-1 duration-200">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-purple-200">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold text-purple-300">
                [X-RAY INSPECTOR ACTIVE]:
              </span>
              <span>
                Isolated Domain: <code className="text-white">src/core/</code>{" "}
                (Pure TS, zero React)
              </span>
              <span className="text-purple-400">•</span>
              <span>
                Zod Contracts: <code className="text-white">src/schemas/</code>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-300">Active Pipeline:</span>
              <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-200 font-bold">
                {isIran ? "IRAN_SHAPARAK (RTL / Toman)" : "GLOBAL_STRIPE (LTR / USD)"}
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
