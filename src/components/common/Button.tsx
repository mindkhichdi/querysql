import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "default" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-[var(--qd-accent)] text-[var(--qd-accent-text)] hover:brightness-110",
  default:
    "bg-[var(--qd-bg-elevated)] text-[var(--qd-text)] border border-[var(--qd-border)] hover:bg-[var(--qd-bg-inset)]",
  ghost: "bg-transparent text-[var(--qd-text-muted)] hover:bg-[var(--qd-bg-inset)] hover:text-[var(--qd-text)]",
  danger: "bg-transparent text-[var(--qd-danger)] hover:bg-[var(--qd-danger)]/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-6 px-2 text-[11px] gap-1",
  md: "h-7 px-3 text-[12px] gap-1.5",
};

export function Button({
  variant = "default",
  size = "md",
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
