import type { WantedStatus } from "@/types/wanted";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { WANTED_STATUS_LABELS } from "@/lib/labels";

const TONES: Record<WantedStatus, StatusTone> = {
  open: { pill: "border-[var(--ink)] bg-[var(--card)] text-[var(--ink)]", dot: "bg-[var(--ink)]" },
  /* « Trouvé » est la fin heureuse : la couleur du succès, pas l'encre, qui
     reste réservée à l'état courant. */
  fulfilled: {
    pill: "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]",
    dot: "bg-[var(--success)]",
  },
  closed: { pill: "border-[var(--muted)] bg-[var(--tint)] text-[var(--muted)]", dot: "bg-[var(--muted)]" },
};

export function WantedStatusBadge({ status }: { status: WantedStatus }) {
  return <StatusPill tone={TONES[status]}>{WANTED_STATUS_LABELS[status]}</StatusPill>;
}
