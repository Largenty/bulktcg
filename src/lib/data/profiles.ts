import "server-only";
import { cache } from "react";
import type { SellerProfile } from "@/types/profile";
import type { Review } from "@/types/review";
import { toReview, toSellerProfile } from "@/lib/data/mappers";
import { countActiveListingsBySeller } from "@/lib/data/listings";
import { profileRowById, profileRows, reviewRows } from "@/lib/data/source";

/* Lectures à clé scalaire : mémoïsées sur la durée du rendu. Le profil est
   demandé par les métadonnées puis par la page, et l'en-tête le redemande
   encore pour l'avatar. */
export const getProfileByUsername = cache(
  async (username: string): Promise<SellerProfile | null> => {
    const row = (await profileRows()).find((candidate) => candidate.username === username);
    if (!row) return null;
    return toSellerProfile(row, await countActiveListingsBySeller(row.id));
  },
);

/* Le profil d'un compte par son identifiant — dans les faits, celui de la
   personne connectée : son compte, le dépôt, l'en-tête. Lu à la base et
   jamais dans le cache des pages publiques, où un compte qui vient de
   naître n'entre qu'à l'invalidation : son espace répondait introuvable
   pendant une heure. Le profil public, lui (getProfileByUsername), passe par
   ce cache. */
export const getProfileById = cache(
  async (userId: string): Promise<SellerProfile | null> => {
    const row = await profileRowById(userId);
    if (!row) return null;
    return toSellerProfile(row, await countActiveListingsBySeller(row.id));
  },
);

/* Les avis reçus, comme vendeur et comme acheteur : la note du profil les
   compte tous les deux. */
export const getReviewsForUser = cache(async (userId: string): Promise<Review[]> => {
  return (await reviewRows()).filter((row) => row.reviewed_id === userId)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map(toReview);
});
