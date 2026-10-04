import type { Game } from "@/types/game";
import type { WantedListing } from "@/types/wanted";
import type { City } from "@/lib/cities";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { WantedGrid } from "@/components/wanted/WantedGrid";
import { atCity } from "@/lib/french";
import { gamePhrases } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* L'onglet « Recherches » d'une page de ville : les demandes dont le rayon
   couvre la commune — « qui viendrait jusqu'ici », pas « qui habite ici ». */
export function CityBuyPanel({ game, city, wantedListings }: { game: Game; city: City; wantedListings: WantedListing[] }) {
  /* Un titre lu et non montré ouvre la grille : les demandes sont des h3, et
     rien ne les séparait du h1 de la page. */
  if (wantedListings.length > 0) {
    return (
      <>
        <h2 className="sr-only">{`Demandes qui viennent jusqu'${atCity(city.name)}`}</h2>
        <WantedGrid wantedListings={wantedListings} />
      </>
    );
  }

  return (
    <EmptyState
      title={`Personne ne vient chercher ${atCity(city.name)}`}
      reason={`Personne ne cherche ${gamePhrases(game.id).some} en acceptant de venir jusqu'ici. Une demande déposée plus loin peut avoir un rayon plus large : la liste complète les montre toutes.`}
      action={
        <ButtonLink href={routes.wantedListings} variant="secondary">
          Toutes les demandes
        </ButtonLink>
      }
    />
  );
}
