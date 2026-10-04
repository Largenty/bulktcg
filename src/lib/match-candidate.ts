import type { Listing } from "@/types/listing";
import type { MatchableListing } from "@/lib/matching";

/* Ce qu'un composant client reçoit d'une annonce pour la croiser avec une
   demande en cours de saisie : la forme minimale du croisement, plus de quoi
   afficher le lot trouvé. Rien d'autre ne part au navigateur. Le dépôt d'une
   recherche sérialisait des annonces entières, et « réservé pour
   theo_yugi » se lisait dans le HTML — avec les vues, les options payées et
   l'identifiant de chaque vendeur (audit du front, M2).

   Les lots du compte lui-même sont écartés ici, côté serveur : le croisement
   n'a plus besoin de l'identifiant du vendeur pour ne jamais proposer à
   quelqu'un sa propre annonce. */
export type MatchCandidate = Omit<MatchableListing, "seller" | "status"> &
  Pick<Listing, "id" | "slug" | "title" | "city" | "status"> & {
    sellerUsername: string;
  };

export function toMatchCandidates(listings: Listing[], viewerId: string): MatchCandidate[] {
  return listings
    .filter((listing) => listing.seller.id !== viewerId)
    .map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      city: listing.city,
      status: listing.status,
      gameId: listing.gameId,
      lotType: listing.lotType,
      cardCount: listing.cardCount,
      priceCents: listing.priceCents,
      latitude: listing.latitude,
      longitude: listing.longitude,
      sellerUsername: listing.seller.username,
    }));
}
