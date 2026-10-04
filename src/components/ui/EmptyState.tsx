import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  /* Ce qui manque et pourquoi. Jamais « aucun résultat » tout seul. */
  reason: string;
  action?: ReactNode;
  level?: "h2" | "h3";
};

/* L'état vide est un écran à part entière : un carton ouvert, vide, en
   miroir du logo qui en montre un plein. Il dit ce qui manque, pourquoi, et
   propose de quoi repartir. */
export function EmptyState({ title, reason, action, level = "h2" }: EmptyStateProps) {
  const Heading = level;

  return (
    <div className="flex flex-col items-start gap-5 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] bg-[var(--card)] p-6 sm:flex-row sm:items-center sm:gap-8 sm:p-9">
      <EmptyBox />
      <div className="flex min-w-0 flex-col items-start gap-4">
        <div>
          <Heading className="display display-h3">{title}</Heading>
          <p className="mt-2 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
            {reason}
          </p>
        </div>
        {action}
      </div>
    </div>
  );
}

function EmptyBox() {
  return (
    <svg width="92" height="76" viewBox="0 0 92 76" aria-hidden="true" focusable="false" className="shrink-0">
      <path d="M14 30 46 18l32 12v34L46 74 14 64z" fill="var(--tint)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 30l32 12 32-12M46 42v32" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 30 4 20l32-12 10 10M78 30l10-10-32-12-10 10" fill="var(--card)" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 52l8 3M54 55l8-3" stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
