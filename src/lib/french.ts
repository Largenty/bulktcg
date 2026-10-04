/* Petite grammaire française, pour que les phrases composées à partir des
   données restent du français. Deux fautes sont passées en production avant
   ce fichier : « à moins de 50 km d'Valence » et « les 1 critères
   sélectionnés ». Toutes deux venaient d'une chaîne recollée à la main dans
   un composant ; les règles vivent maintenant ici, et
   tests/french.test.mjs les tient. */

/* Voyelles, accentuées comprises : devant elles, « de » s'élide en « d' ». */
const STARTS_WITH_VOWEL = /^[aeiouyàâäéèêëîïôöùûüœæ]/i;

/* Le h muet s'élide (« d'Hyères »), le h aspiré non (« de Haguenau »). Rien
   ne les distingue à l'écrit : les h aspirés connus sont listés, et tout
   autre h est traité comme muet, ce qui est le cas le plus courant. */
const H_ASPIRATE = new Set(["haguenau", "hazebrouck", "hautmont", "hayange", "hem", "halluin", "haubourdin"]);

function elides(word: string): boolean {
  if (STARTS_WITH_VOWEL.test(word)) return true;
  if (!/^h/i.test(word)) return false;
  return !H_ASPIRATE.has(word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[\s-]/)[0] ?? "");
}

/* « Le Havre », « Les Angles », « La Rochelle », « L'Isle-sur-la-Sorgue » :
   l'article fait partie du nom, mais il se contracte avec la préposition.
   Il n'est un article que suivi du reste du nom : « Lens » n'en porte pas. */
const ARTICLES = [
  { article: "le", prefix: /^Le\s+(?=.+$)/ },
  { article: "les", prefix: /^Les\s+(?=.+$)/ },
  { article: "la", prefix: /^La\s+(?=.+$)/ },
  { article: "l'", prefix: /^L'(?=.+$)/ },
] as const;

type Article = (typeof ARTICLES)[number]["article"];

function splitArticle(name: string): { article: Article | null; rest: string } {
  for (const { article, prefix } of ARTICLES) {
    const matched = name.match(prefix)?.[0];
    if (matched !== undefined) return { article, rest: name.slice(matched.length) };
  }
  return { article: null, rest: name };
}

/* « à Avignon », « au Havre », « aux Angles », « à La Rochelle ». */
export function atCity(name: string): string {
  const { article, rest } = splitArticle(name);
  if (article === "le") return `au ${rest}`;
  if (article === "les") return `aux ${rest}`;
  return `à ${name}`;
}

/* « d'Avignon », « de Valence », « du Havre », « des Angles », « de La Rochelle ». */
export function fromCity(name: string): string {
  const { article, rest } = splitArticle(name);
  if (article === "le") return `du ${rest}`;
  if (article === "les") return `des ${rest}`;
  if (article !== null) return `de ${name}`;
  return elides(name) ? `d'${name}` : `de ${name}`;
}

/* Le mot seul, accordé : « annonce » ou « annonces ». Le pluriel irrégulier
   se passe en second argument. Zéro prend le singulier, comme en français
   courant (« 0 annonce », « aucune annonce »). */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return Math.abs(count) >= 2 ? plural : singular;
}

/* Le nombre et le mot : « 1 critère », « 3 critères ». */
export function countLabel(count: number, singular: string, plural?: string): string {
  return `${new Intl.NumberFormat("fr-FR").format(count)} ${pluralize(count, singular, plural)}`;
}

/* La première lettre en capitale : une tournure qui ouvre un titre —
   « Cartes d'autres jeux d'occasion ». */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
