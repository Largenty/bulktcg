/* Ce que le marché décide et qu'aucune API ne dit : l'ordre des blocs dans
   la liste de dépôt, les blocs entiers et les époques qu'un vendeur de vrac
   coche au lieu de vingt extensions, les années que l'API de One Piece ne
   donne pas, et les corrections faites à la main. Écrit à la main, lu par
   scripts/editions-update.mjs ; les séries elles-mêmes viennent des API
   (sources.mjs), et les 98 de la migration 2 restent telles qu'elles sont. */

/* L'ordre des blocs dans la liste de dépôt, par jeu : le plus récent en
   tête, parce que c'est celui qu'on coche le plus. Un bloc absent d'ici
   passerait en fin de liste — le test du référentiel le refuse. */
export const BLOCK_ORDER = {
  pokemon: ["Méga-Évolution", "Écarlate & Violet", "Épée & Bouclier", "Séries anciennes"],
  magic: ["Extensions récentes", "Extensions 2017–2021", "Suppléments", "Séries anciennes"],
  onepiece: ["Extensions", "Suppléments"],
  lorcana: ["Chapitres"],
  yugioh: ["Extensions récentes", "Époques"],
  riftbound: ["Extensions", "Coffret d'initiation"],
  naruto: ["Kayou"],
};

/* Les blocs entiers et les époques ajoutés depuis la migration 2. Ils ne
   viennent d'aucune API : un « Bloc HeartGold SoulSilver » n'est pas une
   extension, c'est la façon dont le vrac se décrit. */
export const CURATED_ENTRIES = [
  { gameId: "pokemon", code: "ME", name: "Bloc Méga-Évolution (toutes séries)", year: 2025, block: "Méga-Évolution" },
  { gameId: "pokemon", code: "HGSS", name: "Bloc HeartGold SoulSilver", year: 2010, block: "Séries anciennes" },
  { gameId: "pokemon", code: "PL", name: "Bloc Platine", year: 2009, block: "Séries anciennes" },
  { gameId: "pokemon", code: "ECARD", name: "Bloc e-Card", year: 2002, block: "Séries anciennes" },
  { gameId: "pokemon", code: "BASE", name: "Bloc Base (Set de Base, Jungle, Fossile, Team Rocket, Gym)", year: 1999, block: "Séries anciennes" },
  { gameId: "yugioh", code: "LINK", name: "Ère Link", year: 2017, block: "Époques" },
  { gameId: "yugioh", code: "PENDULE", name: "Ère Pendule", year: 2014, block: "Époques" },
];

/* Les corrections d'une ligne de la migration 2. L'identifiant ne change
   jamais — des annonces le citent — mais le code affiché peut être faux :
   « Destinées Radieuses » est sortie entre EB04 et EB05 (swsh4.5 chez TCGdex,
   19 février 2021), pas après EB07. Le chargeur de la base refuse tout autre
   changement de code. */
export const CORRECTIONS = {
  "pokemon-eb07-5": { code: "EB04.5" },
};

/* Une série de l'API qui correspond à une ligne existante sous un autre
   code : l'identifiant de la ligne l'emporte. */
export const ALIASES = {
  pokemon: { cel25: "pokemon-eb06-5", "swsh4.5": "pokemon-eb07-5" },
  magic: { "block:isd": "magic-inn", "block:zen": "magic-zen", "block:rav": "magic-rav" },
};

/* Ce que les filtres laisseraient passer et qui n'est pas un booster. */
export const EXCLUDED = {
  magic: ["plst"],
};

/* L'API de One Piece ne date pas ses séries : l'année de sortie anglaise,
   écrite ici. Une série absente de cette table n'est pas proposée, et le
   script le dit — mieux vaut une série de retard qu'une année inventée. */
export const ONE_PIECE_YEARS = {
  "OP-01": 2022,
  "OP-02": 2023,
  "OP-03": 2023,
  "OP-04": 2023,
  "OP-05": 2023,
  "OP-06": 2024,
  "OP-07": 2024,
  "OP-08": 2024,
  "OP-09": 2024,
  "OP-10": 2025,
  "OP-11": 2025,
  "OP-12": 2025,
  "OP-13": 2025,
  "OP-14": 2026,
  "OP-15": 2026,
  "OP-16": 2026,
  "OP-17": 2026,
  "EB-01": 2024,
  "EB-02": 2025,
  "EB-03": 2026,
  "PRB-01": 2024,
  "PRB-02": 2025,
};
