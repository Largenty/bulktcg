/* Ce que la police Science Gothic doit savoir faire sur BulkTCG, et rien de
   plus. Lu par subset-science-gothic.mjs, qui fabrique le fichier servi, et
   par tests/fonts.test.mjs, qui vérifie que ce fichier suffit.

   Science Gothic ne compose que des capitales : les libellés (.label,
   .eyebrow, .seal, .stamp, .urgent-flag, .want-specs dt, le logotype) sont
   tous en text-transform: uppercase, et les deux classes qui ne le sont pas
   n'écrivent que des chiffres — .price : « 1 200 € », « ≤ 80 € », « — » — ou
   « PRO » (.credit-pro). Les minuscules, le cyrillique et le vietnamien de
   la police complète ne servaient à rien : 94 Ko préchargés sur chaque page,
   pour du texte qui n'en affiche que le tiers. */

/* La source : la police variable du dépôt google/fonts, figée à un commit
   et vérifiée par son empreinte — deux exécutions donnent le même fichier. */
export const SOURCE = {
  url: "https://raw.githubusercontent.com/google/fonts/2c5cc65841a5cde120f954e9e7a5a905cd1bf923/ofl/sciencegothic/ScienceGothic%5BCTRS%2Cslnt%2Cwdth%2Cwght%5D.ttf",
  sha256: "246e4d33a6fcb3846094e5c4c034616f83e9ae10100316df32e2436362deab3d",
  licenseUrl: "https://raw.githubusercontent.com/google/fonts/2c5cc65841a5cde120f954e9e7a5a905cd1bf923/ofl/sciencegothic/OFL.txt",
};

export const OUTPUT = "src/app/fonts/science-gothic-caps.woff2";
export const LICENSE_OUTPUT = "src/app/fonts/science-gothic-OFL.txt";

/* Les capitales du français — et de l'espagnol, de l'allemand, des pays
   nordiques : une ville ou un pseudo passé en capitales garde sa police —,
   les chiffres, la ponctuation et les signes que les prix et les libellés
   écrivent, « ≤ » des budgets compris, que le fichier de Google n'avait pas.
   L'espace fine insécable (U+202F) et « ✓ » n'existent pas dans la police :
   le navigateur les prend dans la police de repli, comme il le faisait. */
export const CHARACTERS = [
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞŒŸ",
  "0123456789",
  "   ",
  "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
  "«»‘’“”–—…·•€×≤≥°²³←↑→↓",
].join("");

/* Les axes, bornés à l'usage réel : les graisses 380 (« TCG » du logo) à 800,
   les largeurs 54 à 118 (--logo-width sur grand écran). Le contraste (CTRS)
   et l'inclinaison (slnt) restent à leur valeur par défaut, comme dans le
   fichier que servait Google. tests/fonts.test.mjs relit les feuilles de
   style : une graisse ou une largeur hors de ces bornes le fait échouer. */
export const AXES = {
  CTRS: 0,
  slnt: 0,
  wght: { min: 350, max: 800, default: 400 },
  wdth: { min: 50, max: 120, default: 100 },
};

/* Les fonctionnalités que le navigateur applique d'office, plus les chiffres
   tabulaires : .label et .price les demandent (font-variant-numeric), pour
   que les prix d'une rangée s'alignent. Garder toutes celles de la police
   ramenait par fermeture 30 Ko de variantes que rien ne demande. */
export const FEATURES = ["calt", "ccmp", "clig", "kern", "liga", "locl", "mark", "mkmk", "rlig", "rvrn", "tnum"];

/* Copyright, nom de la famille et licence : l'OFL veut qu'ils suivent la
   police. */
export const NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 13, 14];
