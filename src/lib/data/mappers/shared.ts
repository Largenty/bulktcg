import type { ListingRow } from "@/lib/data/rows";
import { getCityByPair, type City } from "@/lib/cities";
import { DEFAULT_PHOTO_VARIANT, buildPhotoUrl } from "@/lib/photo-hosting";
import { hashString } from "@/lib/random";

/* Les outils communs aux mappers de chaque domaine. Le point d'entrée,
   lib/data/mappers.ts, n'en réexporte que toLocationColumns. */

/* Les colonnes texte de Postgres ne portent aucune garantie de type : on les
   rétrécit ici. Une valeur inconnue lève, elle n'est pas silencieusement
   remplacée — une dérive de schéma doit se voir tout de suite, pas produire
   une annonce à l'état « undefined ». */
export function narrow<T extends string>(value: string, allowed: readonly T[], column: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`Valeur inattendue en base pour ${column} : « ${value} ».`);
}

/* Référence dérivée de l'identifiant : stable, sans collision aux volumes
   de la démonstration. À l'échelle réelle elle devra devenir une colonne
   avec contrainte d'unicité — six caractères en base 36 laissent deux
   milliards de valeurs, ce qui ne suffit plus passé quelques dizaines de
   milliers d'annonces à cause du paradoxe des anniversaires. Le préfixe
   distingue un lot (BK) d'une recherche (RC) : une référence citée dans un
   message doit désigner l'un ou l'autre sans ambiguïté. */
export function buildReference(prefix: "BK" | "RC", id: string): string {
  return `${prefix}-${hashString(id).toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

/* Les lignes d'une table de liaison dans l'ordre de saisie. */
export function byPosition<T extends { position: number }>(rows: readonly T[]): T[] {
  return rows.toSorted((left, right) => left.position - right.position);
}

/* Du plus ancien au plus récent : messages d'un fil, avis d'une vente. */
export function byCreationDate<T extends { created_at: string }>(rows: readonly T[]): T[] {
  return rows.toSorted((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

const DEMO_PHOTO_HOST = /^https:\/\/images\.unsplash\.com\//;

/* Phase 1 : storage_path contient déjà une URL absolue (Unsplash).
   Phase 2 : il contient l'identifiant de l'image chez Cloudflare Images
   (photo_uploads.key), et NEXT_PUBLIC_PHOTOS_URL dit comment l'adresser —
   un gabarit, « https://imagedelivery.net/<hash>/{key}/{variant} », où la
   clé prend sa place et la plus grande variante la sienne : l'image de
   partage, les données structurées et le plan de site veulent la photo
   entière, et le chargeur next/image la réduit pour l'affichage
   (lib/photo-hosting). Le branchement vit ici et nulle part ailleurs.

   Les photos d'une annonce réservée aux pros n'y passent pas : privées chez
   Cloudflare, elles s'adressent par la route du site qui vérifie le lecteur
   et le renvoie vers une URL signée (supabase/README.md, § 8). Une photo
   privée oubliée ici tomberait sur une adresse publique que Cloudflare
   refuse sans signature : l'oubli casse l'image, il ne la montre pas. */
export function resolvePhotoUrl(storagePath: string | null): string | null {
  if (!storagePath) return null;
  /* Une adresse absolue n'est admise que pour les photos de démonstration,
     sur le seul hôte externe du site. En phase 2 la base n'en contient plus
     — la clé d'un fichier est vérifiée, et une URL refusée même à la clé de
     service (photo_uploads.key) —, et l'image de partage, qui télécharge la
     photo côté serveur, n'ira jamais chercher une adresse choisie par un
     tiers (audit de sécurité, F9). */
  if (/^https?:\/\//.test(storagePath)) return DEMO_PHOTO_HOST.test(storagePath) ? storagePath : null;
  const template = process.env.NEXT_PUBLIC_PHOTOS_URL;
  if (!template) return null;
  return buildPhotoUrl(template, storagePath, DEFAULT_PHOTO_VARIANT);
}

export type LocationColumns = Pick<ListingRow, "city" | "postal_code" | "department_code" | "latitude" | "longitude">;

/* Les cinq colonnes qui situent une annonce ou une demande, tirées du
   référentiel des communes et jamais de la saisie : un code postal ou des
   coordonnées tapés à la main ne seraient pas vérifiés. */
export function toLocationColumns(city: City): LocationColumns {
  return {
    city: city.name,
    postal_code: city.postalCode,
    department_code: city.departmentCode,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}

/* La commune d'un formulaire validé, à son couple nom et code postal : trois
   communes s'appellent Valence. L'action a déjà ramené la saisie à un couple
   du référentiel (schemas/commune.ts) : arriver ici sans lui est une erreur
   de programmation, pas une saisie. */
export function communeOf(name: string, postalCode: string): City {
  const city = getCityByPair(name, postalCode);
  if (!city) throw new Error(`Commune absente du référentiel : « ${name} (${postalCode}) ».`);
  return city;
}
