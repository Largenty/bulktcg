import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import sharp from "sharp";

/* Ce que les images de partage demandent en octets : les polices, la photo
   de couverture, et l'encodage final.

   Satori n'a pas accès aux polices auto-hébergées par next/font : il faut lui
   passer les octets. On les récupère depuis Google Fonts, une seule fois par
   processus. Si le réseau manque, l'image est produite avec la police par
   défaut plutôt que d'échouer : une vignette moins jolie vaut mieux qu'un
   aperçu absent. Chaque requête a un délai : Facebook abandonne une image
   qui tarde, et un réseau lent ne doit pas bloquer un build. */

type LoadedFont = { name: string; data: ArrayBuffer; weight: 400 | 600 | 700 | 800; style: "normal" };

/* Un User-Agent ancien fait renvoyer du TTF par Google plutôt que du WOFF2,
   que Satori ne sait pas lire. */
const LEGACY_USER_AGENT = "Mozilla/5.0 (Windows NT 6.1)";
const FONT_TIMEOUT_MS = 5000;
const PHOTO_TIMEOUT_MS = 2500;

/* Les axes se demandent dans l'ordre alphabétique de leurs étiquettes, avec
   les valeurs dans le même ordre : « wdth,wght@110,800 » pour Science
   Gothic large.
   Google renvoie alors une instance statique : Satori ne lit pas les polices
   variables. */
async function fetchFont(family: string, axes: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:${axes}`;
    const css = await fetch(cssUrl, {
      headers: { "User-Agent": LEGACY_USER_AGENT },
      signal: AbortSignal.timeout(FONT_TIMEOUT_MS),
    }).then((response) => response.text());
    const fontUrl = css.match(/src:\s*url\((https:[^)]+)\)/)?.[1];
    if (!fontUrl) return null;
    return await fetch(fontUrl, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) }).then((response) => response.arrayBuffer());
  } catch {
    return null;
  }
}

let cache: Promise<LoadedFont[]> | null = null;

/* Les mêmes voix que le site : Space Grotesk pour le titre, Science Gothic pour
   le prix, les libellés et le logotype, Mona Sans pour le texte. */
export function loadOpenGraphFonts(): Promise<LoadedFont[]> {
  cache ??= (async () => {
    const [heading, label, labelLight, body] = await Promise.all([
      fetchFont("Space Grotesk", "wght@600"),
      fetchFont("Science Gothic", "wdth,wght@110,800"),
      /* La graisse légère du « TCG » du logotype. */
      fetchFont("Science Gothic", "wdth,wght@110,400"),
      fetchFont("Mona Sans", "wght@600"),
    ]);

    const fonts: LoadedFont[] = [];
    if (heading) fonts.push({ name: "Space Grotesk", data: heading, weight: 600, style: "normal" });
    if (label) fonts.push({ name: "Science Gothic", data: label, weight: 800, style: "normal" });
    if (labelLight) fonts.push({ name: "Science Gothic", data: labelLight, weight: 400, style: "normal" });
    if (body) fonts.push({ name: "Mona Sans", data: body, weight: 600, style: "normal" });
    return fonts;
  })();

  return cache;
}

/* Le format des images de partage : 1 200 × 630, celui qu'attendent
   Facebook, WhatsApp et X. La colonne de gauche — photo, couleur du jeu —
   fait 520 px de large. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_PANE_WIDTH = 520;
const SHARE_PHOTO = { width: SHARE_PANE_WIDTH, height: SHARE_IMAGE_SIZE.height } as const;

/* Satori n'a pas l'espace fine insécable qu'Intl pose dans « 1 500 » ou
   « 35 € » : elle disparaissait, et « 1500 cartes » s'affichait. L'insécable
   ordinaire la remplace dans tout texte d'une image de partage. */
export function forSatori(text: string): string {
  return text.replace(/\u202f/g, "\u00a0");
}

/* Satori ne décode que le PNG, le JPEG et le GIF : une photo WebP — le
   format de toutes les photos déposées depuis leur conversion dans le
   navigateur — faisait échouer l'image entière (audit SEO, P0-2). Toute
   photo passe donc par sharp : recadrée à sa fenêtre, ré-encodée en JPEG.
   Un fichier illisible rend null, et l'image garde la couleur du jeu. */
export async function toShareImagePhoto(bytes: Uint8Array): Promise<string | null> {
  try {
    const jpeg = await sharp(bytes)
      .rotate()
      .resize(SHARE_PHOTO.width, SHARE_PHOTO.height, { fit: "cover" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/* La photo de couverture, chargée en octets avec un délai : une source lente
   ou absente laisse l'emplacement aux couleurs du jeu, jamais une erreur. */
export async function loadOpenGraphPhoto(
  url: string | null,
  { timeoutMs = PHOTO_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<string | null> {
  if (!url) return null;
  try {
    const source = url.includes("images.unsplash.com") ? `${url}?w=560&h=630&fit=crop&q=72&fm=jpg` : url;
    const response = await fetch(source, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await toShareImagePhoto(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/* L'image rendue par Satori sort en PNG : 1,1 Mo pour une fiche avec photo,
   quand WhatsApp et Messenger ignorent les aperçus lourds. En JPEG, elle
   pèse une centaine de kilo-octets, sans perte visible. */
export async function encodeShareImageJpeg(png: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(png)).flatten().jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

/* Ce que generateImageMetadata déclare d'une image de partage. L'identifiant
   est sa version : il change avec ce qu'elle montre, et son adresse avec
   lui — Facebook et WhatsApp gardent une image tant que son adresse ne
   change pas. */
export function shareImageMetadata(version: string, alt: string) {
  return [{ id: version, alt: forSatori(alt), size: SHARE_IMAGE_SIZE, contentType: "image/jpeg" }];
}

/* Une image de partage rendue en JPEG. Le dessin reçoit la disponibilité
   des polices de la marque ; un second dessin, sans photo, sert de repli
   si le premier échoue — une photo que le moteur refuse ne doit pas priver
   la page de son aperçu. L'adresse change avec l'image : ce qu'elle désigne
   ne change jamais, d'où un cache d'un an. */
export async function shareImageResponse(
  draw: (hasBrandFonts: boolean) => ReactElement,
  fallback?: (hasBrandFonts: boolean) => ReactElement,
  /* Les tests rendent sans aller chercher les polices sur le réseau. */
  { loadFonts = loadOpenGraphFonts }: { loadFonts?: () => Promise<LoadedFont[]> } = {},
): Promise<Response> {
  const fonts = await loadFonts();
  const hasBrandFonts = fonts.length > 0;
  const render = async (element: ReactElement) =>
    encodeShareImageJpeg(
      await new ImageResponse(element, { ...SHARE_IMAGE_SIZE, fonts: hasBrandFonts ? fonts : undefined }).arrayBuffer(),
    );
  let jpeg: Buffer;
  try {
    jpeg = await render(draw(hasBrandFonts));
  } catch (error) {
    if (!fallback) throw error;
    jpeg = await render(fallback(hasBrandFonts));
  }
  return new Response(new Uint8Array(jpeg), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
