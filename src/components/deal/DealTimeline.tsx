import type { Deal } from "@/types/deal";
import { formatDate } from "@/lib/format";
import type { DealPerspective } from "@/lib/deal-display";

type Step = { label: string; date: string | null };

/* Les étapes de la vente, de la mise en ligne aux deux avis. Une étape à
   venir s'écrit sans date — elle n'en a pas encore —, jamais avec une date
   inventée. */
export function DealTimeline({ deal, perspective }: { deal: Deal; perspective: DealPerspective }) {
  const { other, myReview, theirReview } = perspective;
  const steps: Step[] = [
    { label: "Annonce mise en ligne", date: deal.listing.createdAt },
    { label: "Premier message", date: deal.startedAt },
    {
      label: deal.kind === "trade" ? "Échange conclu, clôturé par le vendeur" : "Vente conclue, clôturée par le vendeur",
      date: deal.closedAt,
    },
    { label: "Votre avis", date: myReview?.createdAt ?? null },
    { label: `L'avis de ${other.username}`, date: theirReview?.createdAt ?? null },
  ];

  return (
    <ol className="timeline">
      {steps.map((step) => (
        <li key={step.label} className="timeline-step" data-done={step.date ? "" : undefined}>
          <span className="text-[length:var(--text-md)] font-semibold">{step.label}</span>
          <span className="mono text-[length:var(--text-sm)] text-[var(--muted)]">
            {step.date ? <time dateTime={step.date}>{formatDate(step.date)}</time> : "À venir"}
          </span>
        </li>
      ))}
    </ol>
  );
}
