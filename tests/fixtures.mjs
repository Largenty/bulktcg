/* Les données de test partagées (pas de suffixe .test : le lanceur ne
   l'exécute pas). Le vendeur, le brouillon vide et les lignes de base
   étaient recopiés d'un fichier de test à l'autre. */

/* L'instant figé des aperçus : jamais l'horloge, qui changerait d'un rendu
   à l'autre. */
export const NOW = "2026-09-29T10:00:00.000Z";

/* Le compte de démonstration u-01, tel qu'une vignette le résume. */
export const SELLER = {
  id: "u-01",
  username: "lecomptoirdukado",
  city: "Avignon",
  postalCode: "84000",
  avatarInitials: "LE",
  ratingAvg: 4.9,
  ratingCount: 156,
};

/* Le brouillon d'une annonce au montage du formulaire de dépôt : rien n'est
   encore choisi. */
export const EMPTY_LISTING_DRAFT = {
  title: "",
  gameId: "",
  lotType: "",
  condition: "",
  language: "",
  cardCount: "",
  weightKg: "",
  priceEuros: "",
  city: "",
  audience: "everyone",
  isFeatured: "",
  isUrgent: "",
  openToTrade: "",
  extraPhotos: "",
  editions: [],
  tags: [],
};

/* Une ligne de profil et une ligne d'annonce, au format de la base. */
export const PROFILE_ROW = {
  id: "u-99",
  username: "vendeuse_test",
  city: "Avignon",
  postal_code: "84000",
  avatar_initials: "VE",
  bio: null,
  rating_avg: 4.6,
  rating_count: 12,
  punctuality_avg: 4.8,
  responsiveness_avg: 4.3,
  reliability_avg: 4.7,
  sold_listing_count: 18,
  account_type: "individual",
  company_name: null,
  pro_until: null,
  siret: null,
  shop_address: null,
  shop_hours: null,
  shop_website: null,
  legal_name: null,
  pro_verified_at: null,
  cardmarket_url: null,
  cardnexus_url: null,
  created_at: "2025-01-04T09:00:00.000Z",
};

export const LISTING_ROW = {
  id: "l-99",
  slug: "lot-test-avignon-99",
  seller_id: "u-99",
  game_id: "magic",
  title: "Lot de test",
  description: "Description de test.",
  lot_type: "binder",
  card_count: 120,
  weight_kg: null,
  condition: "NM",
  language: "EN",
  price_cents: 4250,
  previous_price_cents: 5000,
  city: "Avignon",
  postal_code: "84000",
  department_code: "84",
  latitude: 43.9493,
  longitude: 4.8055,
  status: "available",
  audience: "everyone",
  featured_until: null,
  urgent_until: null,
  extra_photos: false,
  bump_started_at: null,
  bump_until: null,
  renewed_at: "2025-02-02T10:00:00.000Z",
  view_count: 42,
  created_at: "2025-02-01T10:00:00.000Z",
  updated_at: "2025-02-02T10:00:00.000Z",
  sold_at: null,
  seller: PROFILE_ROW,
  photos: [
    { id: "l-99-p2", listing_id: "l-99", storage_path: null, position: 1 },
    { id: "l-99-p1", listing_id: "l-99", storage_path: "lots/l-99/1.webp", position: 0 },
  ],
  editions: [
    { listing_id: "l-99", edition_id: "magic-mh2", position: 1 },
    { listing_id: "l-99", edition_id: "magic-mh3", position: 0 },
  ],
  tags: [{ listing_id: "l-99", tag: "binder-included" }],
};

/* Un dépôt valide, tel que le schéma le rend à la couche données. */
export const LISTING_VALUES = {
  title: "Vrac 400 cartes Pokémon",
  gameId: "pokemon",
  lotType: "bulk",
  condition: "mixed",
  language: "VF",
  cardCount: 400,
  weightKg: 1.1,
  priceEuros: 35,
  city: "Avignon",
  postalCode: "84000",
  description: "Quatre cents cartes des séries récentes, remise en main propre à Avignon.",
  editions: [],
  tags: [],
  photos: ["local:abc"],
  extraPhotos: false,
  audience: "everyone",
  openToTrade: false,
  tradeNote: "",
  /* u-01, le compte de démonstration, est un particulier : il le déclare. */
  privateSeller: true,
};

/* Des photos restées sur l'appareil, pas encore téléversées. */
export const photoRefs = (count) => Array.from({ length: count }, (_, index) => `local:photo-${index + 1}`);
