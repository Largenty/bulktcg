"use client";

import type { MatchCandidate } from "@/lib/match-candidate";
import type { SellerSummary } from "@/types/profile";
import type { City } from "@/lib/city-label";
import { WantedCard } from "@/components/wanted/WantedCard";
import { countLabel } from "@/lib/french";
import { matchesWantedCriteria } from "@/lib/matching";
import { buildWantedPreview, canMatchDraft, type WantedDraft } from "@/lib/wanted-draft";

type WantedPreviewProps = {
  draft: WantedDraft;
  buyer: SellerSummary;
  /* Les lots en ligne, déjà passés au formulaire pour le croisement de la
     validation : on les compte ici pendant la saisie. */
  activeListings: MatchCandidate[];
  now: string;
  /* La commune choisie dans le champ : le centre du rayon. */
  city: City | null;
};

/* La demande telle que les vendeurs la verront, pendant qu'on l'écrit, et ce
   qui y répond déjà. Le compte suit chaque critère : un budget relevé, un
   rayon élargi, et l'acheteur voit tout de suite ce que ça change. Le détail
   des lots arrive à la validation. */
export function WantedPreview({ draft, buyer, activeListings, now, city }: WantedPreviewProps) {
  const preview = buildWantedPreview(draft, buyer, now, city);
  const outcomes = canMatchDraft(preview)
    ? activeListings.flatMap((listing) => {
        const outcome = matchesWantedCriteria(listing, preview);
        return outcome ? [outcome] : [];
      })
    : null;
  const toCheck = outcomes?.filter((outcome) => outcome.certainty === "probable").length ?? 0;

  return (
    <section aria-labelledby="apercu-demande" className="flex flex-col gap-3">
      <h2 id="apercu-demande" className="label text-[var(--muted)]">
        Aperçu de votre demande
      </h2>
      <div inert className="pointer-events-none select-none">
        <WantedCard wanted={preview} now={Date.parse(now)} />
      </div>
      <p aria-live="polite" className="notice text-[length:var(--text-md)]">
        {outcomes === null ? (
          "Choisissez le jeu et la commune : on vous dira ce qui est déjà en ligne pour vous."
        ) : outcomes.length === 0 ? (
          "Aucun lot en ligne ne répond encore à ces critères. Les vendeurs de votre secteur verront la demande en publiant."
        ) : (
          <>
            <strong className="font-semibold">
              {countLabel(outcomes.length, "lot")} {outcomes.length > 1 ? "correspondent" : "correspond"} déjà
            </strong>
            {toCheck > 0 ? `, dont ${toCheck} à vérifier` : ""}. Vous les verrez à la validation.
          </>
        )}
      </p>
    </section>
  );
}
