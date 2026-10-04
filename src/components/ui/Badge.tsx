import type { ReactNode } from "react";

/* neutral : une information. ink : une information qui doit sauter aux yeux
   — une baisse de prix. warn, success, danger : un état. La mise en avant
   payée n'est pas une pastille : c'est le sceau holographique (.seal). */
export type BadgeTone = "neutral" | "ink" | "warn" | "success" | "danger";

const TONE_STYLE: Record<BadgeTone, string> = {
  neutral: "border-[var(--line-strong)] bg-[var(--card)] text-[var(--ink-soft)]",
  ink: "border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]",
  warn: "border-[var(--status-reserved)] bg-[var(--notice-soft)] text-[var(--status-reserved)]",
  success: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
  danger: "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]",
};

type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={[
        "label inline-flex min-h-[26px] items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] border-[length:var(--border-width)] px-2.5 font-semibold",
        TONE_STYLE[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
