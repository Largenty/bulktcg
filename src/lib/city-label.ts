/* Une commune telle que l'interface la manipule, sans le référentiel : ce
   module ne charge aucune donnée et peut entrer dans le navigateur. Le
   référentiel lui-même — 35 000 communes — vit côté serveur
   (lib/cities.ts) ; un champ commune interroge la route de suggestions. */

/* Un couple commune et code postal : c'est lui qu'une annonce, une demande
   ou un profil enregistre, et la clé étrangère de la base le vérifie. `slug`
   est celui de la page de la commune, le même pour tous ses codes postaux. */
export type City = {
  slug: string;
  name: string;
  postalCode: string;
  departmentCode: string;
  departmentName: string;
  latitude: number;
  longitude: number;
  /* Le code INSEE : il distingue deux homonymes d'un même département, s'il
     en existe un jour. */
  communeCode: string;
  population: number;
};

/* Ce qu'un champ « Où » donne : une commune, avec les homonymes qu'on aurait
   pu vouloir dire, ou des pistes quand rien ne correspond. */
export type CityResolution =
  | { status: "found"; city: City; via: "name" | "postal-code"; homonyms: City[] }
  | { status: "unknown"; input: string; suggestions: City[] };

/* Libellé canonique d'une commune, celui que le champ affiche une fois la
   suggestion choisie et que resolveCity sait relire. */
export function formatCityLabel(city: Pick<City, "name" | "postalCode">): string {
  return `${city.name} (${city.postalCode})`;
}

/* « Valence (82400) », ou « Valence 82400 » tapé à la main. */
const LABEL = /^(.+?)\s*\(?(\d{5})\)?$/;

/* « Valence (82400) » relu en nom et code postal : la forme qui désigne un
   homonyme sans ambiguïté. */
export function parseCityLabel(value: string): { name: string; postalCode: string } | null {
  const match = value.trim().match(LABEL);
  return match?.[1] && match[2] ? { name: match[1], postalCode: match[2] } : null;
}
