import type { GameId } from "@/types/game";
import type { LotType } from "@/types/listing";
import type { WantedStatus } from "@/types/wanted";
import type { WantedRowWithRelations } from "@/lib/data/rows";
import { buildSlug } from "@/lib/slug";
import { toLocationColumns } from "@/lib/data/mappers";
import { mockHomeCity, mockProfileRow } from "@/lib/mock/profiles.mock";
import { daysAgo, hoursAgo } from "@/lib/mock/seed";

type WantedInput = {
  id: string;
  buyerId: string;
  gameId: GameId;
  title: string;
  description: string;
  lotType: LotType | null;
  maxPriceCents: number | null;
  minCardCount: number | null;
  maxDistanceKm: number;
  status: WantedStatus;
  createdAt: string;
  fulfilledAt?: string;
};

/* Dix-huit demandes, dont une qui ne croise rien, une trouvée et une
   abandonnée : sans ces trois cas, l'écran ne montrerait que le chemin
   heureux et les états dégradés resteraient invisibles. */
const WANTED_INPUTS: WantedInput[] = [
  {
    id: "w-01",
    buyerId: "u-01",
    gameId: "pokemon",
    title: "Cherche vrac Pokémon, 300 cartes minimum",
    description:
      "Je récupère du vrac pour approvisionner ma boutique en ligne. Peu importe l'état, du moment que ce n'est pas moisi. Je me déplace dans un rayon de 30 km autour d'Avignon et je paie en espèces sur place.",
    lotType: "bulk",
    maxPriceCents: 6000,
    minCardCount: 300,
    maxDistanceKm: 30,
    status: "open",
    createdAt: hoursAgo(5),
  },
  {
    id: "w-02",
    buyerId: "u-04",
    gameId: "magic",
    title: "Recherche gros lot Magic pour un cube",
    description:
      "Je monte un cube et j'ai besoin de volume, quel que soit le format : vrac, classeur, decks démontés. Les communes et peu communes m'intéressent autant que les rares.",
    lotType: null,
    maxPriceCents: 8000,
    minCardCount: null,
    maxDistanceKm: 40,
    status: "open",
    createdAt: daysAgo(2),
  },
  {
    id: "w-03",
    buyerId: "u-02",
    gameId: "pokemon",
    title: "Cherche classeur Pokémon trié, séries récentes",
    description:
      "Pour ma fille qui débute. Je préfère un classeur déjà rangé à du vrac : elle veut pouvoir feuilleter. Séries Épée & Bouclier ou plus récentes de préférence.",
    lotType: "binder",
    maxPriceCents: 10000,
    minCardCount: null,
    maxDistanceKm: 25,
    status: "open",
    createdAt: daysAgo(4),
  },
  {
    id: "w-04",
    buyerId: "u-12",
    gameId: "yugioh",
    title: "Recherche cartes Yu-Gi-Oh ère Synchro",
    description:
      "Je reconstitue les decks de mon adolescence. Ère Synchro uniquement, 2008-2012. L'état m'importe peu, ces cartes ont vécu et c'est très bien comme ça.",
    lotType: null,
    maxPriceCents: 5000,
    minCardCount: null,
    maxDistanceKm: 50,
    status: "open",
    createdAt: daysAgo(6),
  },
  {
    id: "w-05",
    buyerId: "u-08",
    gameId: "onepiece",
    title: "Cherche lots One Piece, budget large",
    description:
      "Je me lance sur One Piece et je prends à peu près tout : vrac, classeur, scellé. J'ai de la place et du budget, dites-moi ce que vous avez.",
    lotType: null,
    /* Pas de budget chiffré — « budget large ». Sans une demande comme
       celle-ci, le chemin « sans budget annoncé » ne serait jamais exercé. */
    maxPriceCents: null,
    minCardCount: null,
    maxDistanceKm: 30,
    status: "open",
    createdAt: hoursAgo(20),
  },
  {
    id: "w-06",
    buyerId: "u-06",
    gameId: "naruto",
    title: "Recherche cartes Naruto Kayou tous tiers",
    description:
      "Je complète une collection Kayou et il me manque encore beaucoup de tiers 2 et 3. Vrac ou classeur, les deux me vont.",
    lotType: null,
    maxPriceCents: 6000,
    minCardCount: null,
    maxDistanceKm: 40,
    status: "open",
    createdAt: daysAgo(9),
  },
  {
    id: "w-07",
    buyerId: "u-07",
    gameId: "pokemon",
    title: "Cherche display Pokémon scellé, séries 2021-2023",
    description:
      "Uniquement du scellé d'époque, film d'usine intact. Je vérifie les soudures sur place et je paie sans discuter si c'est propre.",
    lotType: "sealed",
    maxPriceCents: 20000,
    minCardCount: null,
    maxDistanceKm: 60,
    status: "open",
    createdAt: daysAgo(11),
  },
  {
    id: "w-08",
    buyerId: "u-09",
    gameId: "magic",
    title: "Recherche classeur Modern Horizons",
    description: "Je cherchais un classeur MH2 ou MH3 pour compléter mes decks Modern.",
    lotType: "binder",
    maxPriceCents: 25000,
    minCardCount: null,
    maxDistanceKm: 50,
    status: "fulfilled",
    createdAt: daysAgo(24),
    fulfilledAt: daysAgo(13),
  },
  {
    id: "w-09",
    buyerId: "u-05",
    gameId: "pokemon",
    title: "Cherche petit lot Pokémon pas cher",
    description:
      "Petit budget, je cherche de quoi occuper deux enfants un dimanche pluvieux. Peu importe l'état ni la série.",
    lotType: null,
    maxPriceCents: 4000,
    minCardCount: 100,
    maxDistanceKm: 25,
    status: "open",
    createdAt: daysAgo(3),
  },
  {
    id: "w-10",
    buyerId: "u-04",
    gameId: "yugioh",
    title: "Recherche carton de vrac Yu-Gi-Oh à trier",
    description:
      "J'aime fouiller, donc plus c'est brut mieux c'est. Non trié de préférence, et je viens le chercher avec un break.",
    lotType: "bulk",
    maxPriceCents: 5000,
    minCardCount: null,
    maxDistanceKm: 30,
    status: "open",
    createdAt: daysAgo(7),
  },
  {
    id: "w-11",
    buyerId: "u-01",
    gameId: "magic",
    title: "Cherche vrac Magic pour terrains et communes",
    description:
      "Besoin de volume pour dépanner des joueurs débutants au club. Les communes et les terrains de base m'intéressent en premier.",
    lotType: null,
    maxPriceCents: 3000,
    minCardCount: null,
    maxDistanceKm: 25,
    status: "open",
    createdAt: daysAgo(1),
  },
  {
    id: "w-12",
    buyerId: "u-03",
    gameId: "onepiece",
    title: "Recherche boosters One Piece scellés",
    description: "Je cherchais des boosters OP-09 scellés. J'ai finalement acheté en boutique.",
    lotType: "sealed",
    maxPriceCents: 6000,
    minCardCount: null,
    maxDistanceKm: 30,
    status: "closed",
    createdAt: daysAgo(30),
  },
  {
    id: "w-13",
    buyerId: "u-05",
    gameId: "riftbound",
    title: "Recherche vrac Riftbound pour débuter à deux",
    description:
      "Mon fils et moi voulons découvrir Riftbound sans acheter des boosters à l'aveugle. Du vrac en français ou en anglais, peu importe, du moment qu'il y a de quoi monter deux decks.",
    lotType: "bulk",
    maxPriceCents: 4000,
    minCardCount: 300,
    maxDistanceKm: 30,
    status: "open",
    createdAt: daysAgo(1),
  },
  {
    id: "w-14",
    buyerId: "u-10",
    gameId: "riftbound",
    title: "Cherche display Riftbound scellée, VF ou VO",
    description:
      "Une display scellée, n'importe quelle extension, en français ou en anglais. Je la paie le prix boutique, pas le prix de spéculation, et je vérifie le film sur place.",
    lotType: "sealed",
    maxPriceCents: 15000,
    minCardCount: null,
    maxDistanceKm: 50,
    status: "open",
    createdAt: daysAgo(3),
  },
  /* Une boutique cherche aussi : c'est le rachat de vrac, son métier. */
  {
    id: "w-15",
    buyerId: "u-14",
    gameId: "pokemon",
    title: "Rachat de vrac Pokémon au kilo, paiement comptant",
    description:
      "Boutique à Valence : nous rachetons le vrac Pokémon au kilo, toutes séries, paiement comptant sur place. Nous nous déplaçons jusqu'à une heure de route pour un gros volume.",
    lotType: "bulk",
    maxPriceCents: 30000,
    minCardCount: 1000,
    maxDistanceKm: 100,
    status: "open",
    createdAt: hoursAgo(30),
  },
  {
    id: "w-16",
    buyerId: "u-06",
    gameId: "lorcana",
    title: "Cherche du Disney Lorcana pour débuter, tous chapitres",
    description:
      "Ma fille commence Disney Lorcana : je cherche du vrac ou un classeur, peu importe les chapitres, pour lui monter ses premiers decks. Je me déplace jusqu'à 50 km autour de Cavaillon.",
    lotType: null,
    maxPriceCents: 5000,
    minCardCount: null,
    maxDistanceKm: 50,
    status: "open",
    createdAt: daysAgo(1),
  },
  /* Une demande « Autre » : le croisement ne peut pas savoir si le lot
     proposé est bien du Star Wars Unlimited. Il le montre, marqué « à
     vérifier ». */
  {
    id: "w-17",
    buyerId: "u-10",
    gameId: "other",
    title: "Cherche decks Star Wars Unlimited montés",
    description:
      "Je découvre Star Wars Unlimited et je cherche un ou deux decks déjà montés pour jouer tout de suite, avec leur leader et leur base. Je me déplace jusqu'à 30 km autour d'Apt.",
    lotType: "deck",
    maxPriceCents: 7000,
    minCardCount: null,
    maxDistanceKm: 30,
    status: "open",
    createdAt: hoursAgo(20),
  },
  /* Une boutique au forfait échu cherche encore : son statut ne dépend pas
     du forfait, et le filtre « Boutiques pro » la range avec les boutiques,
     comme son badge PRO. Le classer d'après le forfait en faisait un
     particulier. */
  {
    id: "w-18",
    buyerId: "u-15",
    gameId: "lorcana",
    title: "Rachat de scellé Disney Lorcana, boosters et coffrets",
    description:
      "Boutique à Orange : nous rachetons le scellé Disney Lorcana, boosters, displays et coffrets, tous chapitres. Paiement comptant au retrait, jusqu'à 60 km autour d'Orange.",
    lotType: "sealed",
    maxPriceCents: 40000,
    minCardCount: null,
    maxDistanceKm: 60,
    status: "open",
    createdAt: daysAgo(3),
  },
];

function toWantedRow(input: WantedInput): WantedRowWithRelations {
  const buyer = mockProfileRow(input.buyerId);
  const city = mockHomeCity(buyer);

  return {
    id: input.id,
    slug: buildSlug(input.title, city.name, input.id.replace("w-", "")),
    buyer_id: buyer.id,
    game_id: input.gameId,
    title: input.title,
    description: input.description,
    lot_type: input.lotType,
    max_price_cents: input.maxPriceCents,
    min_card_count: input.minCardCount,
    ...toLocationColumns(city),
    max_distance_km: input.maxDistanceKm,
    status: input.status,
    created_at: input.createdAt,
    updated_at: input.fulfilledAt ?? input.createdAt,
    fulfilled_at: input.fulfilledAt ?? null,
    buyer,
  };
}

export const MOCK_WANTED_ROWS: WantedRowWithRelations[] = WANTED_INPUTS.map(toWantedRow);
