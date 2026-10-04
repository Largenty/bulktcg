"use client";

import type { SellerSummary } from "@/types/profile";
import type { City } from "@/lib/city-label";
import type { Edition } from "@/types/edition";
import { ListingCard } from "@/components/listing/ListingCard";
import {
  buildPreviewListing,
  getDraftPriceLabel,
  getMissingPreviewChoices,
  type DraftPhoto,
  type ListingDraft,
} from "@/lib/listing-draft";

type ListingPreviewProps = {
  draft: ListingDraft;
  photos: DraftPhoto[];
  seller: SellerSummary;
  /* Figée au montage : l'âge affiché (« 1 min ») ne doit pas changer d'un
     rendu à l'autre pendant la frappe. */
  now: string;
  /* La commune choisie dans le champ. */
  city: City | null;
  /* Les séries reçues du serveur : l'aperçu y lit les codes cochés. */
  editions: ReadonlyMap<string, Edition>;
};

/* La vignette telle que les acheteurs la verront, pendant qu'on la remplit —
   dès l'arrivée sur la page, pas seulement une fois quatre choix faits : elle
   attendait le jeu, le format, l'état et la langue, et restait un cadre vide
   pendant toute la première moitié du formulaire. Ce qui n'est pas encore
   choisi s'y dessine en emplacement vide (« Jeu ? », « — »), jamais en
   valeur supposée, et la ligne du dessous dit ce qui reste à choisir.

   C'est le même composant que dans la grille, pas une imitation : ce qui
   s'affiche ici s'affichera là-bas. Inerte — un aperçu ne se clique pas. */
export function ListingPreview({ draft, photos, seller, now, city, editions }: ListingPreviewProps) {
  const missing = getMissingPreviewChoices(draft);

  return (
    <section aria-labelledby="apercu-titre" className="flex flex-col gap-3">
      <h2 id="apercu-titre" className="label text-[var(--muted)]">
        Aperçu de votre vignette
      </h2>
      <div inert className="pointer-events-none select-none">
        <ListingCard listing={buildPreviewListing(draft, photos, seller, now, city, editions)} priceLabel={getDraftPriceLabel(draft)} now={Date.parse(now)} />
      </div>
      {missing.length > 0 ? (
        <p className="text-[length:var(--text-sm)] leading-relaxed text-[var(--ink-soft)]">
          <span className="font-semibold text-[var(--ink)]">Reste à choisir :</span> {missing.join(", ")}.
        </p>
      ) : null}
      <p className="text-[length:var(--text-sm)] leading-relaxed text-[var(--muted)]">
        Un titre qui dit le volume et le jeu, une photo nette de l&apos;ensemble, un prix rond : c&apos;est
        ce qui fait cliquer.
      </p>
    </section>
  );
}
