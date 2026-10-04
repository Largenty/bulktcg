import type { WantedMatch } from "@/lib/matching";
import { IntentLink } from "@/components/ui/IntentLink";
import { CrossingPanel } from "@/components/wanted/CrossingPanel";
import { formatDistance, formatPrice } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { routes } from "@/lib/routes";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type MatchingWantedProps = {
  matches: WantedMatch[];
  totalCount: number;
  /* « ce lot » après publication, « ce que vous décrivez » pendant le dépôt. */
  subject?: string;
  /* Ce que ces acheteurs en apprennent : une notification à la publication
     (lib/data/listing-mutations, notifyStoredListing), rien de nouveau à une
     modification, et rien du tout en démonstration. */
  alert: MatchAlert;
};

export type MatchAlert = "sent" | "edited" | "demo";

const ALERT_NOTES: Record<MatchAlert, string> = {
  sent: "Chacune l'apprend dans ses notifications — pour un lot réservé aux pros, les boutiques au forfait seulement. Vous pouvez aussi ouvrir une demande et écrire à l'acheteur.",
  edited: "Une modification ne prévient personne : ouvrez une demande pour écrire à l'acheteur.",
  demo: `Personne n'est prévenu : ${DEMO_MODE_REASON}. Ouvrez une demande pour écrire à l'acheteur.`,
};

/* Ce que voit un vendeur : qui cherche déjà son lot, et à quelle distance.
   C'est la seule raison d'exister des demandes de recherche — sans ce
   croisement, elles ne seraient qu'un panneau d'affichage. */
export function MatchingWanted({ matches, totalCount, subject = "ce lot", alert }: MatchingWantedProps) {
  const certainCount = matches.filter((match) => match.certainty === "certain").length;
  const toVerifyCount = matches.length - certainCount;
  const hidden = totalCount - matches.length;

  return (
    <CrossingPanel
      eyebrow="Demandes de recherche"
      title={
        <>
          {countLabel(totalCount, "personne")} {totalCount > 1 ? "cherchent" : "cherche"} {subject}
        </>
      }
      note={
        toVerifyCount > 0
          ? certainCount > 0
            ? `${certainCount} correspond${certainCount > 1 ? "ent" : ""} à coup sûr, ${toVerifyCount} ${toVerifyCount > 1 ? "sont" : "est"} à vérifier.`
            : `${toVerifyCount} ${toVerifyCount > 1 ? "sont" : "est"} à vérifier : un critère de l'acheteur ne peut pas être contrôlé automatiquement.`
          : undefined
      }
      items={matches.map((match) => (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[length:var(--text-lg)] font-semibold">
              <IntentLink href={routes.wanted(match.wanted.slug)} className="text-[var(--chalk)] underline-offset-4 hover:underline">
                {match.wanted.title}
              </IntentLink>
            </h3>
            <span className="label text-[var(--chalk-muted)]">
              {match.wanted.buyer.username} · à {formatDistance(match.distanceKm)}
            </span>
          </div>

          <p className="mono mt-2 text-[length:var(--text-xs)] text-[var(--chalk-soft)]">
            {match.wanted.maxPriceCents === null
              ? "Sans budget annoncé"
              : `Budget jusqu'à ${formatPrice(match.wanted.maxPriceCents)}`}
            {" · "}
            se déplace à {match.wanted.maxDistanceKm} km
          </p>

          {match.unverified ? (
            <p className="mt-2 text-[length:var(--text-sm)] leading-snug text-[var(--chalk-muted)]">
              À vérifier : {match.unverified}.
            </p>
          ) : null}
        </>
      ))}
      footer={
        <>
          {hidden > 0 ? (
            <p className="label mt-4 text-[var(--chalk-muted)]">
              et {countLabel(hidden, "autre", "autres")}
            </p>
          ) : null}
          <p className="mt-5 text-[length:var(--text-sm)] leading-relaxed text-[var(--chalk-soft)]">{ALERT_NOTES[alert]}</p>
        </>
      }
    />
  );
}
