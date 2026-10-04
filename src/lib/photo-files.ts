/* Tri des fichiers choisis pour une annonce, avant tout téléversement.
   Fonction pure : le sélecteur de photos l'appelle, et tests/photo-files
   la vérifie sans navigateur. */

export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/* 10 Mo : une photo de téléphone récente en fait 3 à 6. Au-delà, c'est un
   fichier brut qu'on ne veut ni stocker ni servir. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

type FileLike = { name: string; type: string; size: number };

export type PhotoSelection<T extends FileLike> = {
  accepted: T[];
  /* Ce qui a été écarté et pourquoi, dit fichier par fichier : un refus sans
     raison ferait réessayer le même fichier. */
  rejected: string[];
};

export function selectPhotoFiles<T extends FileLike>(files: T[], room: number): PhotoSelection<T> {
  const accepted: T[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      rejected.push(`${file.name} : format non pris en charge (JPEG, PNG, WebP ou HEIC)`);
    } else if (file.size > MAX_PHOTO_BYTES) {
      rejected.push(`${file.name} : plus de 10 Mo`);
    } else if (accepted.length >= room) {
      rejected.push(`${file.name} : la limite de photos est atteinte`);
    } else {
      accepted.push(file);
    }
  }

  return { accepted, rejected };
}

/* Identifiant local d'un fichier choisi : « local:… ». Pas de
   crypto.randomUUID, absent hors contexte sécurisé — une page servie en
   http sur le réseau local le ferait planter. */
export function createLocalPhotoRef(): string {
  return `local:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* Les deux rangs doivent exister dans la liste : un rang de départ hors
   bornes y insérait undefined — une photo fantôme —, et un rang négatif
   déplaçait la dernière photo, splice comptant alors depuis la fin. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const isIndex = (index: number) => Number.isInteger(index) && index >= 0 && index < items.length;
  if (!isIndex(from) || !isIndex(to) || from === to) return items;
  const next = [...items];
  const moved = next.splice(from, 1);
  next.splice(to, 0, ...moved);
  return next;
}
