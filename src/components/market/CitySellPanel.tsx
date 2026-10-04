import type { Game } from "@/types/game";
import type { Listing } from "@/types/listing";
import type { City } from "@/lib/cities";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IntentLink } from "@/components/ui/IntentLink";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { atCity, capitalize, countLabel } from "@/lib/french";
import { gamePhrases, withGame } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { CITY_PAGE_NEARBY_KM } from "@/lib/seo";

type CitySellPanelProps = {
  game: Game;
  city: City;
  listings: Listing[];
  nearbyListings: Listing[];
  distances: Map<string, number>;
};

/* L'onglet « Ventes » d'une page de ville : les lots de la commune, puis
   ceux d'à côté — sans eux, la page de Carpentras annonçait « rien à
   vendre » avec dix lots à vingt minutes —, et l'état vide quand il n'y a
   ni l'un ni l'autre. */
export function CitySellPanel({ game, city, listings, nearbyListings, distances }: CitySellPanelProps) {
  const isEmpty = listings.length + nearbyListings.length === 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Un titre pour les lecteurs d'écran : la grille de la commune venait
          sans titre avant celle des communes voisines, qui en a un. */}
      {listings.length > 0 ? (
        <section>
          <h2 className="sr-only">{`Lots ${atCity(city.name)}`}</h2>
          <ListingGrid listings={listings} />
        </section>
      ) : null}
      {nearbyListings.length > 0 ? (
        <section>
          <SectionHeader
            size="md"
            level="h2"
            title={`À moins de ${CITY_PAGE_NEARBY_KM} km`}
            description={
              listings.length === 0
                ? `Rien ${atCity(city.name)} même pour l'instant, mais ${countLabel(nearbyListings.length, "lot")} à côté.`
                : `${countLabel(nearbyListings.length, "autre lot", "autres lots")} dans les communes voisines.`
            }
          />
          <ListingGrid listings={nearbyListings} distanceByListingId={distances} priorityCount={0} />
        </section>
      ) : null}
      {isEmpty ? (
        <EmptyState
          title={`Rien à vendre ${atCity(city.name)} pour l'instant`}
          reason={`${withGame("Aucune carte", game.id)} n'est proposée ici ni à moins de ${CITY_PAGE_NEARBY_KM} km. Le premier lot déposé apparaîtra sur cette page.`}
          action={
            /* Préchargés à l'intention seulement : 875 des 896 pages de ville
               sont vides, et chacune téléchargeait le formulaire de dépôt et
               la page du jeu à l'affichage. */
            <div className="flex flex-wrap gap-3">
              <IntentLink href={routes.deposit} className={buttonClassName()}>
                Déposer la première
              </IntentLink>
              <IntentLink href={routes.game(game.id)} className={buttonClassName("secondary")}>
                {capitalize(gamePhrases(game.id).all)}
              </IntentLink>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
