import { PHOTO_MAX_WIDTH, PHOTO_RATIO } from "@/lib/photo-format";

/* L'hébergement des photos chez Cloudflare Images, décidé une fois : les
   variantes servies, et combien de temps vit chaque chose — l'adresse de
   dépôt, l'URL signée d'une photo privée, un fichier qu'aucune photo
   n'affiche plus. Le code lit ces valeurs ici, supabase/README.md (§ 6 et 8)
   les cite, et les tests tiennent les trois ensemble, migration du ménage
   comprise (tests/photo-hosting.test.mjs, tests/schema-sync.test.mjs).

   Le navigateur lit ce module — le chargeur next/image en dépend : rien de
   secret ici, et aucune horloge, l'instant est toujours passé en argument.
   La signature, elle, vit côté serveur (lib/photo-signing). */

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

export const PHOTO_DURATIONS = {
  /* L'adresse de dépôt à usage unique (champ expiry de direct_upload), que
     Cloudflare borne entre 2 minutes et 6 heures — 30 minutes sans rien
     dire. Le formulaire téléverse à l'envoi, juste avant l'action : dix
     minutes couvrent huit photos sur une connexion lente, et une adresse
     perdue se redemande plutôt que de rester ouverte des heures. */
  directUploadSeconds: 10 * MINUTE,
  /* L'URL signée d'une photo privée : dix minutes au moins, son expiration
     arrondie aux cinq minutes suivantes. Elle ne sert qu'à suivre la
     redirection de la route qui vérifie le lecteur à chaque image
     (supabase/README.md, § 8) ; l'arrondi donne la même adresse à tous les
     lecteurs pendant cinq minutes, et les caches la resservent. */
  privateUrlSeconds: 10 * MINUTE,
  privateUrlStepSeconds: 5 * MINUTE,
  /* La redirection vers l'URL signée se garde dans le navigateur jusqu'à
     une minute avant son expiration. */
  privateRedirectMarginSeconds: MINUTE,
  /* Le ménage (claim_photo_purge, migration 4). Un fichier jamais accroché
     — dépôt abandonné, photos 4 à 8 dont le paiement n'est pas venu —
     attend sept jours : une session de paiement vit au plus 24 heures, et
     un webhook en échec est relancé pendant trois jours. */
  unattachedGraceSeconds: 7 * DAY,
  /* Un fichier décroché — photo retirée, annonce ou compte supprimés —
     attend un jour, le temps que les pages déjà servies cessent de le
     montrer. Plus long, une photo que le vendeur a retirée resterait en
     ligne. */
  detachedGraceSeconds: DAY,
} as const;

/* Les variantes nommées, configurées à l'identique chez Cloudflare : des
   boîtes au format des photos (4:3), fit « scale-down », métadonnées
   « none », aucune « toujours publique ». La plus grande est la largeur
   maximale d'un envoi (lib/photo-format) : au-delà, il n'y a rien de plus à
   montrer. Pas de variantes flexibles : elles ne servent pas une image
   privée, et laisseraient chacun choisir ses réglages, metadata=keep
   compris — le GPS d'un JPEG envoyé en contournant le formulaire. */
const VARIANT_WIDTHS = [160, 320, 640, 1024, PHOTO_MAX_WIDTH] as const;

export type PhotoVariantName = `w${(typeof VARIANT_WIDTHS)[number]}`;

export type PhotoVariant = { name: PhotoVariantName; width: number; height: number };

export const PHOTO_VARIANTS: readonly PhotoVariant[] = VARIANT_WIDTHS.map((width) => ({
  name: `w${width}` as PhotoVariantName,
  width,
  height: Math.round(width / PHOTO_RATIO),
}));

/* L'adresse enregistrée d'une photo désigne sa plus grande variante :
   l'image de partage, les données structurées et le plan de site veulent
   la photo entière, et le chargeur la réduit pour l'affichage. */
export const DEFAULT_PHOTO_VARIANT: PhotoVariantName = `w${PHOTO_MAX_WIDTH}`;

export function isPhotoVariantName(value: string): value is PhotoVariantName {
  return PHOTO_VARIANTS.some((variant) => variant.name === value);
}

/* La plus petite variante qui couvre la largeur demandée, la plus grande
   au-delà — la variante par défaut, celle de la photo entière
   (tests/photo-hosting.test.mjs tient les deux ensemble). */
export function photoVariantFor(width: number): PhotoVariantName {
  return PHOTO_VARIANTS.find((variant) => variant.width >= width)?.name ?? DEFAULT_PHOTO_VARIANT;
}

/* L'adresse d'une photo selon le gabarit NEXT_PUBLIC_PHOTOS_URL — pour
   Cloudflare Images, https://imagedelivery.net/<hash du compte>/{key}/{variant}
   (lib/env vérifie sa forme) : la clé encodée, la variante posée. */
export function buildPhotoUrl(template: string, key: string, variant: PhotoVariantName): string {
  return template.replace("{key}", key.split("/").map(encodeURIComponent).join("/")).replace("{variant}", variant);
}

/* Ce que le chargeur next/image demande pour une largeur : la même photo,
   dans la variante qui la couvre. Une photo s'adresse toujours par sa
   variante en dernier segment — chez Cloudflare comme sur la route du site
   qui sert les photos privées (supabase/README.md, § 8). Rien d'autre n'est
   touché : ni une adresse signée, dont la signature porte sur la variante,
   ni une adresse qui n'est pas une photo du site. */
export function photoLoaderUrl(src: string, width: number, template: string | undefined): string {
  const isSitePath = src.startsWith("/") && !src.startsWith("//");
  if (!isSitePath && !isOnPhotoHost(src, template)) return src;
  /* Une requête ou un fragment : une adresse signée, ou pas une des nôtres. */
  const [path] = src.split(/[?#]/);
  if (path !== src) return src;
  const cut = path.lastIndexOf("/");
  if (!isPhotoVariantName(path.slice(cut + 1))) return src;
  return `${path.slice(0, cut + 1)}${photoVariantFor(width)}`;
}

function isOnPhotoHost(src: string, template: string | undefined): boolean {
  if (!template) return false;
  try {
    return new URL(src).origin === new URL(buildPhotoUrl(template, "key", DEFAULT_PHOTO_VARIANT)).origin;
  } catch {
    return false;
  }
}

/* L'expiration d'une adresse de dépôt, au format que Cloudflare attend
   (RFC 3339, à la seconde). */
export function directUploadExpiry(nowMs: number): string {
  const seconds = Math.floor(nowMs / 1000) + PHOTO_DURATIONS.directUploadSeconds;
  return new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
}
