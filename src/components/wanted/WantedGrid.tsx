import type { WantedListing } from "@/types/wanted";
import { cardGridClassName, type GridDensity } from "@/components/listing/card-grid";
import { WantedCard } from "@/components/wanted/WantedCard";

type WantedGridProps = {
  wantedListings: WantedListing[];
  /* Distances pré-calculées par la page. La grille ne fait que les relayer. */
  distanceByWantedId?: Map<string, number>;
  /* Une rangée pleine sur l'accueil (styles/base/page.css, .listing-rows). */
  rows?: 1 | 2;
  /* Colonnes plus étroites quand la grille partage la largeur avec un
     panneau de filtres. */
  density?: GridDensity;
};

export function WantedGrid({ wantedListings, distanceByWantedId, rows, density = "comfortable" }: WantedGridProps) {
  /* Composant serveur : l'heure se lit ici, une fois pour toute la grille. */
  const now = Date.now();
  if (rows) {
    return (
      <ul className="listing-rows" data-rows={rows}>
        {wantedListings.map((wanted) => (
          <li key={wanted.id}>
            <WantedCard wanted={wanted} distanceKm={distanceByWantedId?.get(wanted.id) ?? null} now={now} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cardGridClassName(density)}>
      {wantedListings.map((wanted) => (
        <li key={wanted.id} className="flex">
          <WantedCard wanted={wanted} distanceKm={distanceByWantedId?.get(wanted.id) ?? null} now={now} />
        </li>
      ))}
    </ul>
  );
}
