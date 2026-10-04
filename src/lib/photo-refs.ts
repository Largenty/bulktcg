/* Référence d'une photo d'annonce, telle qu'elle circule entre le formulaire
   et la couche données.

   - « https://… » : une photo déjà publiée, que la modification conserve ;
   - « storage:<clé> » : un fichier téléversé chez Cloudflare Images
     (phase 2), et inscrit au registre photo_uploads — l'identifiant que
     Cloudflare a tiré pour l'image ;
   - « local:<identifiant> » : un fichier choisi sur l'appareil et resté là,
     faute de stockage (phase 1).

   Le schéma de formulaire ne juge que cette forme : ce qu'il y a derrière
   est l'affaire de la couche données. */
/* La clé est un identifiant de Cloudflare Images tel qu'il le tire : un seul
   segment, sans extension ni barre oblique — ni chemin ni « .. » possibles.
   Le chemin à extension de R2 n'a plus cours depuis que R2 est écarté
   (supabase/README.md, § 6). À qui appartient le fichier, c'est le registre
   qui le dit, côté base, pas la forme de sa clé. */
export const PHOTO_REF_PATTERN = /^(https:\/\/\S+|storage:[\w-]+|local:[\w-]+)$/;

export type PhotoRefKind = "published" | "stored" | "local";

const STORED_PREFIX = "storage:";

export function getPhotoRefKind(ref: string): PhotoRefKind {
  if (ref.startsWith(STORED_PREFIX)) return "stored";
  if (ref.startsWith("local:")) return "local";
  return "published";
}

/* La clé d'un fichier téléversé (« storage:<clé> »), null pour toute autre
   référence. */
export function getStoredPhotoKey(ref: string): string | null {
  return ref.startsWith(STORED_PREFIX) ? ref.slice(STORED_PREFIX.length) : null;
}

/* Une référence « https: » désigne une photo déjà publiée : elle n'est
   recevable que si elle appartient à l'annonce qu'on modifie. Sans ce
   contrôle, un formulaire trafiqué accrocherait n'importe quelle image du
   web à une annonce. */
export function findForeignPhotoRefs(refs: string[], ownPhotoUrls: string[]): string[] {
  const own = new Set(ownPhotoUrls);
  return refs.filter((ref) => getPhotoRefKind(ref) === "published" && !own.has(ref));
}
