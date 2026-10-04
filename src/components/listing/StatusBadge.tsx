import type { ListingStatus } from "@/types/listing";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { EXPIRED_LABEL, STATUS_LABELS } from "@/lib/labels";

/* Les couleurs viennent du groupe « statut » des tokens : c'est le rôle qui
   est nommé ici, pas la teinte. Une annonce expirée prend le gris d'une
   vente : elle n'est plus à prendre. */
const TONES: Record<ListingStatus | "expired", StatusTone> = {
  available: {
    pill: "border-[var(--status-available)] bg-[var(--success-soft)] text-[var(--status-available)]",
    dot: "bg-[var(--status-available)]",
  },
  reserved: {
    pill: "border-[var(--status-reserved)] bg-[var(--notice-soft)] text-[var(--status-reserved)]",
    dot: "bg-[var(--status-reserved)]",
  },
  sold: {
    pill: "border-[var(--status-sold)] bg-[var(--tint)] text-[var(--status-sold)]",
    dot: "bg-[var(--status-sold)]",
  },
  expired: {
    pill: "border-[var(--status-sold)] bg-[var(--tint)] text-[var(--status-sold)]",
    dot: "bg-[var(--status-sold)]",
  },
};

/* Le libellé peut être précisé — « Réservé pour vous » —, jamais la couleur :
   elle reste celle du statut. */
export function StatusBadge({ status, label }: { status: ListingStatus | "expired"; label?: string }) {
  return <StatusPill tone={TONES[status]}>{label ?? (status === "expired" ? EXPIRED_LABEL : STATUS_LABELS[status])}</StatusPill>;
}
