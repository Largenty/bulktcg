import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { ListingsScreen } from "@/components/market/ListingsScreen";
import { NAMED_GAME_IDS } from "@/types/game";
import { GAME_LABELS } from "@/lib/labels";
import { QUERY_PARAM, buildListingHref, readGameParam } from "@/lib/listing-query";
import { listingListMetadata } from "@/lib/metadata";
import { routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/* Toutes les annonces, tous jeux confondus. Seule l'adresse nue s'indexe :
   tri, prix, ville et page produisent des milliers de combinaisons qui
   diraient toutes la même chose — servies, mais en noindex. */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return {
    ...listingListMetadata("Toutes les annonces", routes.listings, await searchParams),
    /* La sienne, et non celle du site : l'accueil et cette page portaient
       la même, et un moteur ne savait pas laquelle montrer. */
    description: `Lots, vrac, classeurs, decks et scellé de cartes ${NAMED_GAME_IDS.map((gameId) => GAME_LABELS[gameId]).join(", ")} et d'autres jeux, à récupérer en main propre près de chez vous — entre particuliers et avec les boutiques.`,
  };
}

export default async function ListingsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  /* La page d'un jeu a vécu ici, sous /annonces?jeu=pokemon. Un lien collé
     dans un groupe il y a trois mois doit tomber au bon endroit, filtres
     compris : redirection permanente vers /pokemon. */
  const legacyGame = readGameParam(rawParams);
  if (legacyGame) permanentRedirect(buildListingHref(routes.game(legacyGame), rawParams, { [QUERY_PARAM.game]: null }));

  return <ListingsScreen game={null} rawParams={rawParams} />;
}
