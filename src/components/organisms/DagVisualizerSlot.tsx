"use client";

import * as React from "react";
import {
  Network,
  ArrowRight,
  Shield,
  KeyRound,
  CreditCard,
  CheckCircle2,
  Lock,
  Layers,
  Database,
  Code2,
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";

export function DagVisualizerSlot() {
  const { currentEcosystem, config, xRayMode } = useEcosystemStore();
  const isIran = currentEcosystem === "IRAN_SHAPARAK";

  const nodes = isIran
    ? [
        { id: "idemp", title: "قفل یکتایی (Idempotency)", icon: KeyRound, status: "healthy" as const, desc: "Redis Lock (UUIDv7)" },
        { id: "vpn", title: "بررسی آی‌پی و VPN", icon: Shield, status: "healthy" as const, desc: "Shaparak Geo-Fence" },
        { id: "token", title: "توکن شاپرک (IPG Token)", icon: Lock, status: "healthy" as const, desc: "Saman/Mellat WS" },
        { id: "otp", title: "رمز پویا (SMS OTP)", icon: CreditCard, status: "healthy" as const, desc: "Harim SMS Service" },
        { id: "ledger", title: "تایید و تسویه سند", icon: Database, status: "healthy" as const, desc: "Two-Phase Commit" },
      ]
    : [
        { id: "idemp", title: "Idempotency Guard", icon: KeyRound, status: "healthy" as const, desc: "Distributed Redis Lock" },
        { id: "risk", title: "Radar Fraud Scoring", icon: Shield, status: "healthy" as const, desc: "ML Risk Engine (<25)" },
        { id: "intent", title: "Stripe Intent Create", icon: Lock, status: "healthy" as const, desc: "PaymentIntent API" },
        { id: "3ds", title: "3D Secure 2.0 Check", icon: CreditCard, status: "healthy" as const, desc: "Frictionless Auth" },
        { id: "ledger", title: "Double-Entry Ledger", icon: Database, status: "healthy" as const, desc: "ACID Settlement" },
      ];

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border-default bg-surface-primary/80 backdrop-blur-sm p-5 shadow-lg relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-400">
              <Network className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              {isIran ? "پایپ‌لاین جریان تراکنش (Transaction DAG)" : "Transaction Pipeline DAG Visualizer"}
            </h2>
          </div>
          <p className="text-xs text-text-muted">
            {isIran
              ? `گراف جهت‌دار غیرمدور مراحل اجرای تراکنش روی ${config.primaryGateway}`
              : `Directed Acyclic Graph modeling state transitions for ${config.primaryGateway}`}
          </p>
        </div>

        <Badge variant="brand" size="sm" className="shrink-0 font-mono">
          <StatusDot status="healthy" pulse />
          ASYNC PIPELINE READY
        </Badge>
      </div>

      {/* Recruiter X-Ray Annotation */}
      {xRayMode && (
        <div className="my-3 p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-200">
          <div className="flex items-center gap-1.5 font-bold text-purple-300 mb-1">
            <Code2 className="w-3.5 h-3.5 text-purple-400" />
            [CTO ARCHITECTURE: Distributed Pipeline Graph]
          </div>
          <p className="text-[11px] leading-relaxed text-purple-200/80">
            Node execution order is calculated via topological sorting in <code className="text-white">src/core/dag/</code>. Each step possesses an atomic rollback handler and dead-letter queue (DLQ) guarantee.
          </p>
        </div>
      )}

      {/* DAG Flow Chart */}
      <div className="my-6 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 relative">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isLast = index === nodes.length - 1;

            return (
              <div key={node.id} className="relative group">
                <div className="flex flex-col items-center p-3 rounded-xl bg-surface-secondary/80 border border-border-subtle hover:border-brand-border transition-all text-center h-full justify-between">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-text-subtle">
                      0{index + 1}
                    </span>
                    <StatusDot status={node.status} pulse={false} />
                  </div>

                  <div className="p-2.5 rounded-lg bg-surface-tertiary text-brand mb-2 group-hover:scale-105 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-text-primary leading-snug">
                      {node.title}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted">
                      {node.desc}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 w-full border-t border-border-subtle flex items-center justify-center gap-1 text-[10px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>IDLE</span>
                  </div>
                </div>

                {!isLast && (
                  <div className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-border-strong group-hover:text-brand transition-colors">
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs text-text-muted font-mono">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-text-subtle" />
          <span>Slot 02: Transaction Visualizer Hook Ready</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Payload:</span>
          <span className="text-brand font-semibold">{config.currency}</span>
        </div>
      </div>
    </div>
  );
}
