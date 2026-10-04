import "server-only";
import { getEditionById, isRetiredEdition } from "@/lib/editions";
import type { Edition } from "@/types/edition";
import { z } from "@/lib/schemas/zod";

/* Les séries d'un formulaire, vérifiées par le serveur seul : le référentiel
   ne part pas dans le navigateur, et le schéma partagé n'y vérifie que le
   jeu que porte l'identifiant. Une série inconnue, ou d'un autre jeu, est
   refusée ; une série retirée du référentiel aussi, sauf si l'annonce la
   portait déjà — la modification ne force pas à la décocher. */
export const UNKNOWN_EDITION_ERROR = "Une des séries cochées n'appartient pas au jeu sélectionné.";

type EditionLookup = { find: (id: string) => Edition | null; isRetired: (id: string) => boolean };

const REFERENTIAL: EditionLookup = { find: getEditionById, isRetired: isRetiredEdition };

/* Le premier refus d'une liste de séries, ou null. */
export function editionIssue(gameId: string, editions: readonly string[], kept: readonly string[], lookup: EditionLookup = REFERENTIAL): string | null {
  for (const id of editions) {
    const edition = lookup.find(id);
    if (!edition || edition.gameId !== gameId) return UNKNOWN_EDITION_ERROR;
    if (lookup.isRetired(id) && !kept.includes(id)) return `La série ${edition.code} n'est plus proposée : décochez-la.`;
  }
  return null;
}

export function withKnownEditions<Values extends { gameId: string; editions: string[] }>(
  schema: z.ZodType<Values>,
  kept: readonly string[] = [],
) {
  return schema.superRefine((values, context) => {
    const message = editionIssue(values.gameId, values.editions, kept);
    if (message) context.addIssue({ code: "custom", path: ["editions"], message });
  });
}
