import type { GameId } from "@/types/game";
import { AdSlot } from "@/components/ads/AdSlot";
import { HouseAd } from "@/components/ads/HouseAd";
import { ListingBrowser } from "@/components/search/ListingBrowser";
import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";

type ListingsSellPanelProps = {
  searchParams: SearchParams;
  /* /annonces ou /pokemon : filtres, pastilles et pagination y restent. */
  basePath: string;
  gameId?: GameId;
};

/* L'onglet « Ventes » de la liste : les annonces filtrées, leurs encarts en
   fin de liste, et l'état vide qui propose d'effacer les filtres — sans
   quitter le jeu, qui porte le titre de la page — ou de déposer. */
export function ListingsSellPanel({ searchParams, basePath, gameId }: ListingsSellPanelProps) {
  return (
    <ListingBrowser
      searchParams={searchParams}
      basePath={basePath}
      gameId={gameId}
      midAdSlotId="annonces-milieu"
      asides={
        <>
          <AdSlot format="rectangle" slotId="annonces-colonne" />
          <HouseAd />
        </>
      }
      emptyAction={
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={routes.listingsFor(gameId)} variant="secondary">
            Effacer les filtres
          </ButtonLink>
          <ButtonLink href={routes.deposit}>Déposer la vôtre</ButtonLink>
        </div>
      }
    />
  );
}
