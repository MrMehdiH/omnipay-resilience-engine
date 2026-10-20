import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "brand";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none active:scale-[0.98]";

    const variantStyles = {
      primary:
        "bg-text-primary text-surface-canvas hover:bg-white shadow-sm",
      secondary:
        "bg-surface-tertiary text-text-primary hover:bg-surface-elevated border border-border-default",
      brand:
        "bg-brand text-white hover:brightness-110 border border-brand-border shadow-sm",
      outline:
        "border border-border-default bg-transparent text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
      ghost:
        "bg-transparent text-text-secondary hover:bg-surface-tertiary hover:text-text-primary",
      danger:
        "bg-status-danger text-white hover:brightness-110 border border-rose-500/50 shadow-sm",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-(--primitive-radius-md) gap-1.5",
      md: "h-9 px-4 text-sm rounded-(--primitive-radius-lg) gap-2",
      lg: "h-11 px-6 text-base rounded-(--primitive-radius-lg) gap-2.5",
      icon: "h-9 w-9 rounded-(--primitive-radius-lg) p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
