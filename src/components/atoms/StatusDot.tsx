import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: "healthy" | "degraded" | "broken" | "neutral";
  pulse?: boolean;
}

export function StatusDot({
  className,
  status = "healthy",
  pulse = true,
  ...props
}: StatusDotProps) {
  const statusColors = {
    healthy: "bg-emerald-400",
    degraded: "bg-amber-400",
    broken: "bg-rose-400",
    neutral: "bg-slate-400",
  };

  const pulseColors = {
    healthy: "bg-emerald-400/40",
    degraded: "bg-amber-400/40",
    broken: "bg-rose-400/40",
    neutral: "bg-slate-400/40",
  };

  return (
    <span className={cn("relative flex h-2.5 w-2.5 items-center justify-center", className)} {...props}>
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            pulseColors[status]
          )}
        />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", statusColors[status])} />
    </span>
  );
}
