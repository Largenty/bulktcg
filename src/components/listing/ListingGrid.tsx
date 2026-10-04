import { Fragment, type ReactNode } from "react";
import type { Listing } from "@/types/listing";
import { ListingCard } from "@/components/listing/ListingCard";
import { cardGridClassName, type GridDensity } from "@/components/listing/card-grid";

type ListingGridProps = {
  listings: Listing[];
  /* Les premières vignettes, celles du premier écran, se chargent d'emblée
     et en priorité haute : deux par défaut, au-delà on retarderait le
     contenu réellement au-dessus de la ligne. Zéro quand la grille commence
     sous la ligne de flottaison. */
  priorityCount?: number;
  /* Distances pré-calculées par la page. La grille ne fait que les relayer. */
  distanceByListingId?: Map<string, number>;
  /* Colonnes plus étroites quand la grille partage la largeur avec un
     panneau de filtres. */
  density?: GridDensity;
  /* Sur l'accueil : une ou deux rangées pleines, quelle que soit la largeur
     — les vignettes en trop se retirent (styles/base/page.css,
     .listing-rows). */
  rows?: 1 | 2;
  /* Un encart pleine largeur dans la grille — la bannière publicitaire. Sa
     place visible est une rangée, pas un rang dans la liste : voir
     .grid-insert dans styles/base/account.css. */
  insert?: { after: number; node: ReactNode };
};

/* Une liste sur téléphone — les vignettes y sont horizontales — puis une
   grille dont le nombre de colonnes suit la largeur disponible. */
export function ListingGrid({
  listings,
  priorityCount = 2,
  distanceByListingId,
  density = "comfortable",
  rows,
  insert,
}: ListingGridProps) {
  /* Composant serveur : l'heure se lit ici, une fois pour toute la grille. */
  const now = Date.now();
  if (rows) {
    return (
      <ul className="listing-rows" data-rows={rows}>
        {listings.map((listing, index) => (
          <li key={listing.id}>
            <ListingCard
              listing={listing}
              isPriority={index < priorityCount}
              distanceKm={distanceByListingId?.get(listing.id) ?? null}
              now={now}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cardGridClassName(density)}>
      {listings.map((listing, index) => (
        <Fragment key={listing.id}>
          <li className="flex">
            <ListingCard
              listing={listing}
              isPriority={index < priorityCount}
              distanceKm={distanceByListingId?.get(listing.id) ?? null}
              now={now}
            />
          </li>
          {insert && index === insert.after - 1 ? <li className="grid-insert">{insert.node}</li> : null}
        </Fragment>
      ))}
    </ul>
  );
}
