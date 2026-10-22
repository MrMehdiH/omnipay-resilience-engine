"use client";

import * as React from "react";
import {
  Network,
  ArrowRight,
  KeyRound,
  CreditCard,
  CheckCircle2,
  Lock,
  Layers,
  Database,
  Code2,
  RefreshCw,
  AlertTriangle,
  Play,
  Copy,
  Terminal,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Badge } from "@/components/atoms/Badge";
import { StatusDot } from "@/components/atoms/StatusDot";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";
import { DagNodeId, DagNodeStatus, DAG_NODE_IDS } from "@/schemas/transaction.schema";

interface NodeVisualMeta {
  titleEn: string;
  titleFa: string;
  descEn: string;
  descFa: string;
  icon: React.ComponentType<{ className?: string }>;
  step: string;
}

const NODE_METADATA: Record<DagNodeId, NodeVisualMeta> = {
  CART_LOCK: {
    titleEn: "Cart Lock Lease",
    titleFa: "قفل سبد خرید",
    descEn: "Re-entrant cart lease",
    descFa: "اجاره قفل بدون بن‌بست",
    icon: Lock,
    step: "01",
  },
  IDEMPOTENCY: {
    titleEn: "Idempotency Guard",
    titleFa: "سد یکتایی",
    descEn: "cyrb53 / UUIDv7 check",
    descFa: "بررسی اثر انگشت تراکنش",
    icon: KeyRound,
    step: "02",
  },
  OPTIMISTIC: {
    titleEn: "Optimistic Ledger",
    titleFa: "سند رزرو اولیه",
    descEn: "Instant UI reserve",
    descFa: "رزرو آنی پیش از پرداخت",
    icon: Database,
    step: "03",
  },
  GATEWAY: {
    titleEn: "Payment Gateway",
    titleFa: "سوئیچ درگاه پرداخت",
    descEn: "Stripe / Shaparak Auth",
    descFa: "تراکنش شتاب / شاپرک",
    icon: CreditCard,
    step: "04",
  },
  RETRY_BACKOFF: {
    titleEn: "Retry & Backoff",
    titleFa: "تلاش مجدد و Backoff",
    descEn: "AWS Full Jitter loop",
    descFa: "تاخیر تصادفی نمایی",
    icon: RefreshCw,
    step: "05",
  },
  DLQ_OR_COMMIT: {
    titleEn: "Terminal Settlement",
    titleFa: "تسویه نهایی / صف خطا",
    descEn: "Commit vs DLQ vs Rollback",
    descFa: "تایید قطعی یا ارجاع به DLQ",
    icon: CheckCircle2,
    step: "06",
  },
};

export function DagVisualizer() {
  const {
    currentEcosystem,
    config,
    xRayMode,
    dagNodes,
    telemetryEvents,
    activeTransactionId,
    lastSettlementResult,
    isSimulating,
    executeSimulation,
    resetDagNodes,
    clearTelemetry,
  } = useEcosystemStore();

  const isIran = currentEcosystem === "IRAN_SHAPARAK";
  const [showTelemetryDrawer, setShowTelemetryDrawer] = React.useState(false);
  const [copiedTxId, setCopiedTxId] = React.useState(false);

  const handleCopyTx = () => {
    if (activeTransactionId && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(activeTransactionId);
      setCopiedTxId(true);
      setTimeout(() => setCopiedTxId(false), 2000);
    }
  };

  const handleRunFresh = async () => {
    try {
      await executeSimulation();
    } catch {
      // Handled via DAG visualizer state
    }
  };

  const handleRunReplay = async () => {
    try {
      await executeSimulation({ forceReplay: true });
    } catch {
      // Handled via DAG visualizer state
    }
  };

  const getStatusBadge = (status: DagNodeStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-brand bg-brand-subtle px-1.5 py-0.5 rounded border border-brand-border animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            ACTIVE
          </span>
        );
      case "SUCCEEDED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-status-success bg-status-success/15 px-1.5 py-0.5 rounded border border-status-success/30">
            <CheckCircle2 className="w-2.5 h-2.5" />
            SUCCEEDED
          </span>
        );
      case "FAILED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-status-danger bg-status-danger/15 px-1.5 py-0.5 rounded border border-status-danger/30">
            <XCircle className="w-2.5 h-2.5" />
            FAILED
          </span>
        );
      case "SKIPPED":
        return (
          <span className="flex items-center gap-1 text-[10px] font-mono text-text-muted bg-surface-tertiary px-1.5 py-0.5 rounded border border-border-default">
            SKIPPED
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="text-[10px] font-mono text-text-subtle">
            IDLE
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border-default bg-surface-primary/80 backdrop-blur-sm p-5 shadow-lg relative overflow-hidden transition-all">
      {/* Background ambient pipeline glow */}
      <div
        className={cn(
          "absolute -bottom-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-opacity duration-500",
          isSimulating
            ? "bg-brand/20 opacity-100"
            : lastSettlementResult?.outcome === "COMMITTED"
              ? "bg-emerald-500/15 opacity-80"
              : lastSettlementResult?.outcome === "DEAD_LETTERED"
                ? "bg-amber-500/15 opacity-80"
                : "bg-teal-500/10 opacity-50"
        )}
      />

      {/* Card Header & Live Status */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-500/15 text-teal-400">
              <Network className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-text-primary tracking-tight">
              {isIran
                ? "پایپ‌لاین جریان تراکنش (Transaction DAG)"
                : "Transaction Pipeline DAG Visualizer"}
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            {isIran
              ? `گراف جهت‌دار غیرمدور مراحل اجرای تراکنش روی ${config.primaryGateway}`
              : `Directed Acyclic Graph modeling state transitions for ${config.primaryGateway}`}
          </p>
        </div>

        {/* Live Execution Status Badge */}
        {isSimulating ? (
          <Badge variant="brand" size="sm" className="shrink-0 font-mono">
            <StatusDot status="healthy" pulse />
            EXECUTING DAG...
          </Badge>
        ) : lastSettlementResult ? (
          <Badge
            variant={
              lastSettlementResult.outcome === "COMMITTED"
                ? "success"
                : lastSettlementResult.outcome === "DEAD_LETTERED"
                  ? "warning"
                  : "danger"
            }
            size="sm"
            className="shrink-0 font-mono font-bold"
          >
            {lastSettlementResult.outcome === "COMMITTED" && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {lastSettlementResult.outcome === "DEAD_LETTERED" && <AlertTriangle className="w-3 h-3 mr-1" />}
            {lastSettlementResult.outcome === "DECLINED" && <XCircle className="w-3 h-3 mr-1" />}
            {lastSettlementResult.outcome}
          </Badge>
        ) : (
          <Badge variant="outline" size="sm" className="shrink-0 font-mono text-text-muted">
            <StatusDot status="neutral" pulse={false} />
            PIPELINE READY
          </Badge>
        )}
      </div>

      {/* Recruiter / CTO X-Ray DAG Inspection */}
      {xRayMode && (
        <div className="my-3 p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs font-mono text-purple-200 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <Code2 className="w-3.5 h-3.5 text-purple-400" />
              <span>[CTO ARCHITECTURE: Transaction State Machine & DLQ Guarantees]</span>
            </div>
            <span className="text-[10px] text-purple-300/80">
              Bounded Depth ≤ 4 + 2·maxAttempts
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-purple-200/80">
            Cart lock is acquired before idempotency to eliminate double-submit race conditions.
            The only cycle is <code className="text-white">GATEWAY ⇄ RETRY_BACKOFF</code>.
            Crucially, ambiguous states (timeouts after retries exhausted) transition to{" "}
            <code className="text-amber-300 font-bold">DEAD_LETTERED</code>; the engine{" "}
            <strong>NEVER</strong> automatically refunds ambiguous payments to prevent double-spend vulnerability.
          </p>
        </div>
      )}

      {/* Transaction Intent Header Bar (If Active) */}
      {activeTransactionId && (
        <div className="my-2.5 px-3 py-2 rounded-xl bg-surface-secondary/70 border border-border-subtle flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-text-subtle">TXID:</span>
            <code className="text-text-primary font-bold">
              {activeTransactionId.slice(0, 18)}...
            </code>
            <button
              type="button"
              onClick={handleCopyTx}
              className="p-1 rounded text-text-subtle hover:text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
              title="Copy Full Transaction ID"
            >
              <Copy className="w-3 h-3" />
            </button>
            {copiedTxId && (
              <span className="text-[10px] text-emerald-400">Copied!</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-subtle">Currency:</span>
            <span className="text-brand font-semibold">{config.currency}</span>
            <span className="text-border-strong">•</span>
            <span className="text-text-subtle">Attempts:</span>
            <span className="text-text-primary font-bold">
              {lastSettlementResult?.attempts ?? (isSimulating ? "..." : 0)}
            </span>
          </div>
        </div>
      )}

      {/* Main DAG Node Graph Flow */}
      <div className="my-4 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 relative">
          {DAG_NODE_IDS.map((nodeId, index) => {
            const meta = NODE_METADATA[nodeId];
            const state = dagNodes[nodeId];
            const Icon = meta.icon;
            const isLast = index === DAG_NODE_IDS.length - 1;
            const isRetryNode = nodeId === "RETRY_BACKOFF";

            return (
              <div key={nodeId} className="relative group">
                <div
                  className={cn(
                    "flex flex-col items-center p-3 rounded-xl border text-center h-full justify-between transition-all duration-300 relative",
                    state.status === "ACTIVE"
                      ? "bg-brand-subtle/40 border-brand ring-2 ring-brand/40 shadow-md shadow-brand/20 scale-[1.02]"
                      : state.status === "SUCCEEDED"
                        ? "bg-surface-secondary/90 border-status-success/30 hover:border-status-success/60"
                        : state.status === "FAILED"
                          ? "bg-rose-950/20 border-status-danger/40 hover:border-status-danger/70"
                          : state.status === "SKIPPED"
                            ? "bg-surface-secondary/40 border-border-subtle opacity-70"
                            : "bg-surface-secondary/60 border-border-subtle hover:border-border-default"
                  )}
                >
                  {/* Top: Step & Status */}
                  <div className="w-full flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-text-subtle font-semibold">
                      {meta.step}
                    </span>
                    {getStatusBadge(state.status)}
                  </div>

                  {/* Icon */}
                  <div
                    className={cn(
                      "p-2.5 rounded-lg mb-2 transition-transform group-hover:scale-105",
                      state.status === "ACTIVE"
                        ? "bg-brand text-white shadow-sm"
                        : state.status === "SUCCEEDED"
                          ? "bg-status-success/15 text-status-success"
                          : state.status === "FAILED"
                            ? "bg-status-danger/15 text-status-danger"
                            : "bg-surface-tertiary text-text-secondary"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        state.status === "ACTIVE" && "animate-spin-slow"
                      )}
                    />
                  </div>

                  {/* Node Title & Description */}
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-text-primary leading-snug">
                      {isIran ? meta.titleFa : meta.titleEn}
                    </div>
                    <div className="text-[10px] font-mono text-text-muted">
                      {isIran ? meta.descFa : meta.descEn}
                    </div>
                  </div>

                  {/* Bottom: Visits & Error/Diagnostic info */}
                  <div className="mt-2.5 pt-2 w-full border-t border-border-subtle flex flex-col items-center gap-1 text-[10px] font-mono">
                    <div className="flex items-center justify-between w-full text-text-subtle">
                      <span>{isIran ? "ورود:" : "Visits:"}</span>
                      <span className="text-text-primary font-bold">{state.visits}</span>
                    </div>

                    {state.lastError && (
                      <div
                        className="text-[9px] text-rose-400 truncate max-w-full font-mono bg-rose-950/40 px-1 py-0.5 rounded border border-rose-500/20"
                        title={state.lastError}
                      >
                        {state.lastError.split(":")[0]}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector Arrow (Desktop horizontal flow) */}
                {!isLast && !isRetryNode && (
                  <div className="hidden lg:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-border-strong group-hover:text-brand transition-colors pointer-events-none">
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Outcome Summary Card (When Settled) */}
      {lastSettlementResult && (
        <div
          className={cn(
            "my-2 p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-300",
            lastSettlementResult.outcome === "COMMITTED"
              ? "bg-status-success/10 border-status-success/30 text-status-success"
              : lastSettlementResult.outcome === "DEAD_LETTERED"
                ? "bg-status-warning/10 border-status-warning/30 text-status-warning"
                : "bg-status-danger/10 border-status-danger/30 text-status-danger"
          )}
        >
          <div className="flex items-center gap-2.5">
            {lastSettlementResult.outcome === "COMMITTED" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : lastSettlementResult.outcome === "DEAD_LETTERED" ? (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0" />
            )}
            <div>
              <div className="text-xs font-bold font-mono tracking-wide">
                SETTLEMENT OUTCOME: {lastSettlementResult.outcome}
              </div>
              <div className="text-[11px] opacity-90 leading-tight">
                {lastSettlementResult.outcome === "COMMITTED" &&
                  (isIran
                    ? `تراکنش موفق شاپرک با شناسه پیگیری (RRN): ${lastSettlementResult.gatewayReference}`
                    : `Transaction committed with gateway ref: ${lastSettlementResult.gatewayReference}`)}
                {lastSettlementResult.outcome === "DECLINED" &&
                  (isIran
                    ? `تراکنش توسط صادرکننده رد شد (${lastSettlementResult.failure?.code}). سند اولیه رزرو بازگشت داده شد (Compensated).`
                    : `Declined by issuer (${lastSettlementResult.failure?.code}). Optimistic reserve compensated.`)}
                {lastSettlementResult.outcome === "DEAD_LETTERED" &&
                  (isIran
                    ? "وضعیت مبهم مالی (تایم‌اوت یا اتمام سقف تلاش‌ها). سند برای تطبیق دستی به صف DLQ ارسال شد."
                    : "Ambiguous state (timeout/exhausted retries). Parked in DLQ for manual reconciliation (no blind refund).")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
            <span>Compensated:</span>
            <span className="font-bold">
              {lastSettlementResult.compensated ? "YES" : "NO"}
            </span>
          </div>
        </div>
      )}

      {/* Real-time Telemetry Stream Drawer / Terminal */}
      <div className="my-1.5 border border-border-subtle rounded-xl overflow-hidden bg-surface-canvas/90">
        <button
          type="button"
          onClick={() => setShowTelemetryDrawer((prev) => !prev)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-mono text-text-muted hover:text-text-primary hover:bg-surface-secondary/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-brand" />
            <span>
              {isIran ? "رویدادنگاری زنده تله‌متری (Live Telemetry Stream)" : "Live Telemetry Stream Log"}
            </span>
            <Badge variant="outline" size="sm" className="font-mono text-[10px]">
              {telemetryEvents.length} events
            </Badge>
            {telemetryEvents.length > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  clearTelemetry();
                }}
                className="text-[10px] text-text-subtle hover:text-text-primary underline ml-1 cursor-pointer"
              >
                {isIran ? "پاکسازی" : "Clear"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-subtle">
              {showTelemetryDrawer ? (isIran ? "بستن لاگ" : "Collapse") : (isIran ? "مشاهده لاگ" : "Expand")}
            </span>
            {showTelemetryDrawer ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {showTelemetryDrawer && (
          <div className="p-3 border-t border-border-subtle bg-terminal-bg max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px]">
            {telemetryEvents.length === 0 ? (
              <div className="text-text-subtle text-center py-3">
                {isIran ? "هنوز رویدادی ثبت نشده است. شبیه‌سازی را اجرا کنید." : "No telemetry events yet. Trigger a transaction simulation."}
              </div>
            ) : (
              telemetryEvents.map((evt) => (
                <div
                  key={evt.eventId}
                  className="flex items-start gap-2 text-text-muted hover:text-text-primary transition-colors border-b border-border-subtle/30 pb-1"
                >
                  <span className="text-text-subtle text-[10px] shrink-0">
                    {new Date(evt.timestamp).toISOString().slice(14, 23)}
                  </span>

                  <span
                    className={cn(
                      "px-1 py-0.2 rounded text-[9px] font-bold shrink-0",
                      evt.type === "NODE_ENTERED"
                        ? "bg-indigo-500/20 text-indigo-300"
                        : evt.type === "NODE_EXITED"
                          ? "bg-teal-500/20 text-teal-300"
                          : evt.type === "RETRY_SCHEDULED"
                            ? "bg-amber-500/20 text-amber-300"
                            : evt.type === "IDEMPOTENCY_REPLAY"
                              ? "bg-purple-500/20 text-purple-300"
                              : evt.type === "VPN_WARNING"
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-emerald-500/20 text-emerald-300"
                    )}
                  >
                    {evt.type}
                  </span>

                  <span className="text-[10px] truncate">
                    {"nodeId" in evt && `${evt.nodeId} `}
                    {"status" in evt && `→ ${evt.status} (${evt.durationMs}ms)`}
                    {"delayMs" in evt && `Backoff: ${evt.delayMs}ms (Code: ${evt.failureCode})`}
                    {"mode" in evt && `Mode: ${evt.mode} (Key: ${evt.idempotencyKey.slice(0, 12)}...)`}
                    {"outcome" in evt && `Outcome: ${evt.outcome} (Attempts: ${evt.attempts})`}
                    {"message" in evt && `${evt.message}`}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Interactive Simulation Controls Footer */}
      <div className="pt-3.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-text-muted">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-text-subtle" />
          <span>{isIran ? "درگاه فعال:" : "Active Rail:"}</span>
          <span className="text-brand font-semibold">
            {config.primaryGateway}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetDagNodes}
            className="text-xs font-mono cursor-pointer"
            title="Reset DAG visual nodes to PENDING state"
          >
            <RotateCcw className="w-3 h-3 ml-1 rtl:mr-1" />
            {isIran ? "پاکسازی گراف" : "Reset Nodes"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!activeTransactionId || isSimulating}
            onClick={handleRunReplay}
            className="text-xs font-mono cursor-pointer"
            title="Re-send same idempotency key to test single-flight dedup"
          >
            <KeyRound className="w-3 h-3 ml-1 rtl:mr-1" />
            {isIran ? "تست کلیک دوبل (یکتایی)" : "Test Double-Click (Replay)"}
          </Button>

          <Button
            variant="brand"
            size="sm"
            isLoading={isSimulating}
            onClick={handleRunFresh}
            className="text-xs font-mono cursor-pointer shadow-md shadow-indigo-950/50"
            title="Execute transaction pipeline"
          >
            <Play className="w-3 h-3 ml-1 rtl:mr-1 fill-current" />
            {isIran ? "اجرای شبیه‌سازی تراکنش" : "Simulate Transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
}
