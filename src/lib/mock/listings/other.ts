import type { ListingInput } from "@/lib/mock/listings/listing-input";
import { daysAgo } from "@/lib/mock/seed";

/* Les annonces « Autre » de la démonstration. */
export const OTHER_LISTINGS: ListingInput[] = [
  /* « Autre » : les jeux sans intercalaire. Pas de série à déclarer — le
     titre et la description nomment le jeu —, et pas de photo : aucune ne
     représente honnêtement un lot dont on ne connaît pas le jeu d'avance. */
  {
    id: "l-39",
    sellerId: "u-12",
    gameId: "other",
    title: "Deux decks Star Wars Unlimited montés, sous protège-cartes",
    description:
      "Deux decks Star Wars: Unlimited de 50 cartes, chacun avec son leader et sa base, montés pour jouer entre amis. Sous protège-cartes depuis l'ouverture, les protège-cartes partent avec.\n\nÀ Pertuis, le week-end de préférence.",
    lotType: "deck",
    cardCount: 104,
    weightKg: null,
    condition: "NM",
    language: "VF",
    priceCents: 6000,
    status: "available",
    viewCount: 12,
    photoCount: 0,
    tags: ["sleeves"],
    createdAt: daysAgo(6),
  },
];
