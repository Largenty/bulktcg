const COMBINING_MARKS = /[̀-ͯ]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;

/* Les lettres que la décomposition NFD ne sépare pas en lettre et accent :
   sans elles, « Æther Revolt » — une extension Magic — devenait
   « ther-revolt », « Cœur » « c-ur », et une recherche « oeil » ne trouvait
   pas une description qui écrit « œil ». */
const LIGATURES: Record<string, string> = { œ: "oe", Œ: "oe", æ: "ae", Æ: "ae", ß: "ss" };
const LIGATURE = /[œŒæÆß]/g;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(LIGATURE, (letter) => LIGATURES[letter] ?? letter)
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, "-")
    .replace(EDGE_DASHES, "");
}

/* Le slug est le lien permanent partagé sur Facebook : il doit rester lisible
   et rester stable même si le titre est modifié plus tard. Le suffixe garantit
   l'unicité sans exposer l'identifiant complet. */
export function buildSlug(title: string, city: string, suffix: string): string {
  return [slugify(title), slugify(city), suffix].filter(Boolean).join("-");
}

/* Le suffixe d'un lien permanent tiré de l'identifiant de l'enregistrement :
   ses huit premiers caractères hexadécimaux. Avec le titre et la commune
   devant eux, deux liens ne se confondent pas ; la contrainte d'unicité de
   la base tranche le reste. */
export function idSlugSuffix(id: string): string {
  return id.replace(/[^0-9a-f]/gi, "").slice(0, 8).toLowerCase();
}
