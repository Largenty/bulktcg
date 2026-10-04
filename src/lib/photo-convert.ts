import {
  PHOTO_FALLBACK_TYPE,
  PHOTO_OUTPUT_TYPE,
  PHOTO_QUALITY,
  convertedPhotoName,
  planPhotoCrop,
} from "@/lib/photo-format";

/* La conversion des photos dans le navigateur, avant tout envoi : recadrées
   au format du visuel de l'annonce, réduites, ré-encodées en WebP. Le
   serveur ne reçoit jamais un fichier brut de 6 Mo tout droit sorti d'un
   téléphone.

   Le ré-encodage retire aussi les métadonnées de l'appareil — dont la
   position GPS de la prise de vue, qui dirait où habite le vendeur.

   Navigateur seulement (createImageBitmap, canvas) : le calcul du format
   vit dans lib/photo-format, testé sans lui. */

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, PHOTO_QUALITY));
}

async function convertPhoto(file: File): Promise<File> {
  /* « from-image » : une photo prise téléphone tourné arrive droite. */
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const plan = planPhotoCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponible.");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, plan.sx, plan.sy, plan.sWidth, plan.sHeight, 0, 0, plan.width, plan.height);
    /* Un navigateur qui ne sait pas encoder le WebP rend un PNG à la place :
       on le reconnaît au type, et on se rabat sur le JPEG. */
    let blob = await encode(canvas, PHOTO_OUTPUT_TYPE);
    if (!blob || blob.type !== PHOTO_OUTPUT_TYPE) blob = await encode(canvas, PHOTO_FALLBACK_TYPE);
    if (!blob) throw new Error("Encodage impossible.");
    return new File([blob], convertedPhotoName(file.name, blob.type), { type: blob.type });
  } finally {
    bitmap.close();
  }
}

export type PhotoConversion = { converted: File[]; rejected: string[] };

/* Toutes les photos choisies, dans l'ordre. Celles que le navigateur ne sait
   pas lire — un HEIC ailleurs que sous Safari — sont écartées avec leur
   raison, plutôt qu'envoyées telles quelles. */
export async function convertPhotos(files: File[]): Promise<PhotoConversion> {
  /* Chaque issue garde son fichier : un refus se nomme sans recoller deux
     listes par leur rang. */
  const outcomes = await Promise.all(
    files.map((file) =>
      convertPhoto(file).then(
        (photo) => ({ file, photo }),
        () => ({ file, photo: null }),
      ),
    ),
  );
  const converted: File[] = [];
  const rejected: string[] = [];
  for (const { file, photo } of outcomes) {
    if (photo) converted.push(photo);
    else rejected.push(`${file.name} : ce navigateur ne sait pas lire cette photo — enregistrez-la en JPEG`);
  }
  return { converted, rejected };
}
