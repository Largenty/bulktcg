import type { ListingInput } from "@/lib/mock/listings/listing-input";
import { daysAgo } from "@/lib/mock/seed";

/* Les annonces Lorcana de la démonstration. */
export const LORCANA_LISTINGS: ListingInput[] = [
  /* Lorcana, sans photo : aucune n'a encore été regardée et vérifiée. */
  {
    id: "l-38",
    sellerId: "u-05",
    gameId: "lorcana",
    title: "Vrac Disney Lorcana, 350 cartes des deux premiers chapitres",
    description:
      "Trois cent cinquante cartes Disney Lorcana ouvertes depuis les deux premiers chapitres, triées par couleur d'encre. Une vingtaine de brillantes, aucune enchantée. Je suis passée à un autre jeu.\n\nRemise en main propre à Orange, en semaine après 18 h.",
    lotType: "bulk",
    cardCount: 350,
    weightKg: null,
    condition: "EX",
    language: "VF",
    priceCents: 4000,
    status: "available",
    viewCount: 38,
    photoCount: 0,
    editions: ["lorcana-ch1", "lorcana-ch2"],
    tags: [],
    createdAt: daysAgo(2),
  },
];
