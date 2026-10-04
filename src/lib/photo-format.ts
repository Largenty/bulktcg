/* Le format des photos d'annonce, décidé avant tout envoi. C'est celui du
   visuel : la galerie de la fiche et la fenêtre de la vignette sont en 4:3
   (la miniature carrée du téléphone y taille à son tour). Une photo déjà au
   bon format pèse moins, s'affiche plus vite, et ce que le vendeur voit dans
   l'aperçu est exactement ce que verront les acheteurs.

   Fonctions pures : lib/photo-convert les applique dans le navigateur, et
   tests/photo-format.test.mjs les vérifie sans lui. */

export const PHOTO_RATIO = 4 / 3;

/* La galerie affiche 760 px de large en grand écran : 1 600 px couvrent un
   écran à double densité, avec de la marge. Au-delà, le fichier grossit
   sans rien montrer de plus. */
export const PHOTO_MAX_WIDTH = 1600;

export const PHOTO_OUTPUT_TYPE = "image/webp";

/* Repli quand le navigateur ne sait pas encoder le WebP (certains Safari
   rendent un PNG à la place) : recadré et réduit quand même. */
export const PHOTO_FALLBACK_TYPE = "image/jpeg";

export const PHOTO_QUALITY = 0.82;

export type PhotoCropPlan = {
  /* Le rectangle pris dans la photo d'origine… */
  sx: number;
  sy: number;
  sWidth: number;
  sHeight: number;
  /* … et la taille de la photo produite, jamais agrandie. */
  width: number;
  height: number;
};

/* Le recadrage centré qui donne le format 4:3 — comme l'affichage, qui
   remplit sa fenêtre et taille au centre —, puis la réduction. */
export function planPhotoCrop(sourceWidth: number, sourceHeight: number): PhotoCropPlan {
  const isWider = sourceWidth / sourceHeight > PHOTO_RATIO;
  const sWidth = Math.max(1, isWider ? Math.round(sourceHeight * PHOTO_RATIO) : sourceWidth);
  const sHeight = Math.max(1, isWider ? sourceHeight : Math.round(sourceWidth / PHOTO_RATIO));
  const width = Math.max(1, Math.min(PHOTO_MAX_WIDTH, sWidth));
  return {
    sx: Math.round((sourceWidth - sWidth) / 2),
    sy: Math.round((sourceHeight - sHeight) / 2),
    sWidth,
    sHeight,
    width,
    height: Math.max(1, Math.round(width / PHOTO_RATIO)),
  };
}

/* « IMG_2031.HEIC » devient « IMG_2031.webp » : le nom dit le format réel. */
export function convertedPhotoName(name: string, type: string): string {
  const extension = type === PHOTO_OUTPUT_TYPE ? "webp" : "jpg";
  const base = name.replace(/\.[^./]+$/, "") || "photo";
  return `${base}.${extension}`;
}
