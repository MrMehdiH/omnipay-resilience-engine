"use client";

import * as React from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useEcosystemStore } from "@/store/useEcosystemStore";
import { cn } from "@/lib/utils";

export function XRayToggle() {
  const { xRayMode, toggleXRayMode } = useEcosystemStore();

  return (
    <button
      type="button"
      onClick={toggleXRayMode}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
        xRayMode
          ? "bg-purple-950/60 border-purple-500 text-purple-300 shadow-md shadow-purple-950/80 ring-1 ring-purple-500/50"
          : "bg-surface-tertiary border-border-default text-text-muted hover:text-text-primary hover:border-border-strong"
      )}
      title="Toggle Recruiter / CTO X-Ray Mode: Inspect internal architecture, state machine, and resilience guarantees"
    >
      <div className="relative">
        {xRayMode ? (
          <Eye className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 text-text-subtle group-hover:text-text-muted" />
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide">
          Recruiter X-Ray
        </span>
        <span
          className={cn(
            "text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold tracking-wider",
            xRayMode
              ? "bg-purple-500 text-purple-950"
              : "bg-surface-elevated text-text-subtle"
          )}
        >
          {xRayMode ? "ON" : "OFF"}
        </span>
      </div>

      <Sparkles
        className={cn(
          "w-3 h-3 transition-opacity",
          xRayMode ? "opacity-100 text-purple-400" : "opacity-0"
        )}
      />
    </button>
  );
}
