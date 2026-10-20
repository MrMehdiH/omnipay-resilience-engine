"use client";

import * as React from "react";
import { Globe, ShieldCheck } from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { cn } from "@/lib/utils";

export function EcosystemSwitcher() {
  const { currentEcosystem, setEcosystem } = useEcosystemStore();

  return (
    <div className="flex items-center p-1 rounded-xl bg-surface-tertiary border border-border-default shadow-inner">
      <button
        type="button"
        onClick={() => setEcosystem("GLOBAL_STRIPE")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
          currentEcosystem === "GLOBAL_STRIPE"
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/50"
            : "text-text-muted hover:text-text-primary hover:bg-surface-elevated/60"
        )}
        title="Switch to Global Fintech Rails (Stripe, Klarna, USD, LTR)"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Global Rails</span>
        <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/15 text-white font-mono">
          USD
        </span>
      </button>

      <button
        type="button"
        onClick={() => setEcosystem("IRAN_SHAPARAK")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer font-sans",
          currentEcosystem === "IRAN_SHAPARAK"
            ? "bg-teal-600 text-white shadow-md shadow-teal-900/50"
            : "text-text-muted hover:text-text-primary hover:bg-surface-elevated/60"
        )}
        title="سوییچ به درگاه پرداخت شاپرک ایران (تومان، اسنپ‌پی، RTL)"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span className="font-medium">شبکه شاپرک</span>
        <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/15 text-white font-mono">
          تومان
        </span>
      </button>
    </div>
  );
}
