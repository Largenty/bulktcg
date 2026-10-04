import "server-only";
import { revalidatePath, updateTag } from "next/cache";
import { CACHE_TAGS, type CacheTag } from "@/lib/data/cache-tags";
import { communePagePath } from "@/lib/cities";
import { routes } from "@/lib/routes";
import type { GameId } from "@/types/game";

/* Ce qu'une écriture réellement enregistrée doit rafraîchir. Dans la
   démonstration rien n'est enregistré et ces fonctions ne sont jamais
   appelées ; avec la base, sans elles, une fiche passée en « Vendu »
   resterait « Disponible » jusqu'à une heure — la durée du cache des
   lectures, les pages étant rendues à chaque requête (supabase/README.md,
   § 7) — et le lien permanent mentirait exactement sur ce qu'il promet de
   dire.

   Des chemins concrets, jamais un motif (« /a/[slug] ») ni la racine en
   mode « layout » : une écriture ordinaire rendait périmées toutes les
   fiches, ou les quelque mille pages du site (audit de sécurité, M5).

   Les pages des communes voisines — une page de ville montre aussi les lots
   à moins de trente kilomètres — et celles que couvre le rayon d'une
   demande ne sont pas nommées : elles relisent les mêmes lignes, que
   l'étiquette du cache des lectures invalide d'un coup (updateCachedReads).
   Ces fonctions ne s'appellent que depuis une action serveur, seul endroit
   où updateTag est permis. */

/* Les lectures publiques que l'écriture a changées, dans le cache de
   données (lib/data/cache-tags.ts) : la requête suivante attend les lignes
   fraîches — l'auteur voit sa propre écriture, pas l'ancienne. */
export function updateCachedReads(...tags: CacheTag[]) {
  for (const tag of new Set(tags)) updateTag(tag);
}

/* Où un lot ou une demande s'affiche : la page de son jeu, et celle de sa
   commune pour ce jeu — retrouvée par le couple commune et code postal,
   jamais par le nom seul (lib/cities, communePagePath). */
export type Placement = { gameId: GameId; city: string; postalCode: string };

export function placementPaths(placements: Placement[]): string[] {
  return placements.flatMap((placement) => {
    const communePath = communePagePath(placement.gameId, placement);
    return [routes.game(placement.gameId), ...(communePath ? [communePath] : [])];
  });
}

function revalidateAll(paths: string[]) {
  for (const path of new Set(paths)) revalidatePath(path);
}

/* `placements` : où le lot se trouve, et où il se trouvait quand une
   modification l'a changé de jeu ou de commune — il doit quitter l'ancienne
   page aussi vite qu'il arrive sur la nouvelle. */
export function revalidateListingPaths(listingPath: string, placements: Placement[]) {
  updateCachedReads(CACHE_TAGS.listings);
  revalidateAll([listingPath, ...placementPaths(placements), routes.listings, "/"]);
  revalidatePath(routes.account, "layout");
}

/* L'accueil montre aussi les dernières demandes. */
export function revalidateWantedPaths(wantedPath: string, placements: Placement[]) {
  updateCachedReads(CACHE_TAGS.wanted);
  revalidateAll([wantedPath, ...placementPaths(placements), routes.wantedListings, "/"]);
  revalidatePath(routes.account, "layout");
}

export function revalidateMessagePaths(conversationId: string | null) {
  revalidatePath(routes.inbox);
  if (conversationId) revalidatePath(routes.conversation(conversationId));
}

/* Une vente clôturée ou un avis laissé : le suivi du compte, la ligne de la
   conversation, et le profil des personnes dont la note ou l'historique de
   ventes a bougé — elles seules. Les lectures qui montrent une note portent
   l'étiquette des profils, vignettes comprises ; le lot vendu, lui, passe
   par revalidateListingPaths. */
export function revalidateDealPaths(usernames: string[]) {
  updateCachedReads(CACHE_TAGS.profiles);
  revalidateAll(usernames.map((username) => routes.profile(username)));
  revalidatePath(routes.account, "layout");
  revalidatePath(routes.inbox, "layout");
}
