import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingsScreen } from "@/components/market/ListingsScreen";
import { getGameBySegment, getGames } from "@/lib/data/games";
import { countListings } from "@/lib/data/listings";
import { countWantedListings } from "@/lib/data/wanted";
import { capitalize, countLabel } from "@/lib/french";
import { gamePhrases } from "@/lib/labels";
import { listingListMetadata } from "@/lib/metadata";
import { GAME_SEGMENT, routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";

/* Les jeux de GAME_IDS, par le segment de leur adresse, et rien d'autre :
   /foo répond 404 au lieu de rendre une page vide, et aucune route du site
   ne se fait masquer. C'est tout ce que font ces paramètres : la page est
   rendue à chaque requête (le nonce de la CSP), et son image de partage à
   la première demande, puis gardée en cache. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const games = await getGames();
  return games.map((game) => ({ game: GAME_SEGMENT[game.id] }));
}

type PageProps = {
  params: Promise<{ game: string }>;
  searchParams: Promise<SearchParams>;
};

/* Le jeu est le seul critère qui mérite d'être indexé : il a un titre, un
   texte et un public. Ses combinaisons de filtres restent servies, en
   noindex, et robots.txt en écarte l'exploration. */
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const game = await getGameBySegment((await params).game);
  if (!game) return {};

  const [values, listingCount, wantedCount] = await Promise.all([
    searchParams,
    countListings({ gameId: game.id }),
    countWantedListings({ gameId: game.id }),
  ]);
  const cards = gamePhrases(game.id).cards;

  return {
    ...listingListMetadata(`${capitalize(cards)} d'occasion`, routes.game(game.id), values),
    description: `${countLabel(listingCount, "lot")} de ${cards} en vrac, en classeur, en deck ou scellé, et ${countLabel(wantedCount, "acheteur")} qui disent ce qu'ils cherchent. Tout se récupère en main propre entre particuliers.`,
  };
}

export default async function GameListingsPage({ params, searchParams }: PageProps) {
  const game = await getGameBySegment((await params).game);
  if (!game) notFound();

  return <ListingsScreen game={game} rawParams={await searchParams} />;
}
