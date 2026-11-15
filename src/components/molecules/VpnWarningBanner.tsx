"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { X, ShieldAlert } from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { Button } from "@/components/atoms/Button";

export function VpnWarningBanner() {
  const { currentEcosystem, vpnWarningActive, dismissVpnWarning } = useEcosystemStore(useShallow((state) => ({
    currentEcosystem: state.currentEcosystem,
    vpnWarningActive: state.vpnWarningActive,
    dismissVpnWarning: state.dismissVpnWarning,
  })));

  if (currentEcosystem !== "IRAN_SHAPARAK" || !vpnWarningActive) {
    return null;
  }

  return (
    <div
      role="alert"
      className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-amber-950/70 border-b border-amber-500/40 text-amber-200 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-amber-300">
              شبیه‌سازی فعال: خطای اتصال با VPN
            </span>
            <span className="px-1.5 py-0.5 rounded text-caption bg-amber-400/20 text-amber-300 font-mono">
              IPG Callback Security
            </span>
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed">
            این سناریو فقط خطای فرضی آی‌پی غیربومی را شبیه‌سازی می‌کند؛ آی‌پی یا VPN شما بررسی نمی‌شود. برای خاموش کردن خطا، گزینهٔ VPN را در کنترل آشوب غیرفعال کنید. بستن این پیام، سناریو را تغییر نمی‌دهد.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
        <Button
          variant="outline"
          size="sm"
          onClick={dismissVpnWarning}
          className="border-amber-500/30 text-amber-200 hover:bg-amber-900/40 text-xs"
        >
          <X className="w-3.5 h-3.5 ml-1" />
          متوجه شدم (بستن)
        </Button>
      </div>
    </div>
  );
}
