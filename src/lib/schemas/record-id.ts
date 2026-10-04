import { z } from "@/lib/schemas/zod";

/* L'identifiant d'un enregistrement — annonce, demande, conversation,
   vente —, tel qu'une action serveur le reçoit du navigateur. Il était
   recopié dans six fichiers d'actions, et deux champs cachés de formulaire
   lui échappaient : `listingId` et `wantedId` n'étaient vérifiés que comme
   « une chaîne », sans borne ni alphabet.

   Lettres, chiffres, tirets et soulignés : les identifiants de la phase 1
   (« l-04 ») comme les UUID de la phase 2. Un fichier glissé à la place du
   champ caché, une barre oblique ou dix mille caractères sont refusés avant
   d'atteindre la couche données. */
export const recordIdSchema = z.string().regex(/^[\w-]{1,64}$/);

/* L'identifiant qu'un dépôt portera, tiré quand la page du formulaire
   s'affiche et renvoyé par un champ caché : un double envoi retombe sur la
   même ligne au lieu d'en créer une seconde (migration 11). Un UUID, rien
   d'autre — c'est la clé primaire de la base. */
export const draftIdSchema = z.uuid();
