import { z } from "@/lib/schemas/zod";
import { collectErrors } from "@/lib/schemas/field-errors";
import { optionalPositiveNumber, postalCodeField, titleField } from "@/lib/schemas/fields";
import { GAME_IDS } from "@/types/game";
import { LOT_TYPES } from "@/types/listing";

/* Schéma d'une demande de recherche. Plus court que celui d'une annonce :
   un acheteur décrit un besoin, pas un objet. Chaque champ facultatif laissé
   vide vaut null — « peu importe » est une réponse, pas une absence. */

export const wantedFormSchema = z.object({
  title: titleField,
  gameId: z.enum(GAME_IDS, { error: "Choisissez un jeu." }),
  /* Chaîne vide admise : elle veut dire « n'importe quel format ». */
  lotType: z.union([z.literal(""), z.enum(LOT_TYPES)]),
  maxPriceEuros: optionalPositiveNumber("Le budget doit être un nombre supérieur à zéro, ou rester vide.", { isInteger: false }),
  minCardCount: optionalPositiveNumber("Le volume minimum doit être un nombre entier supérieur à zéro, ou rester vide.", { isInteger: true }),
  city: z.string().trim().min(2, "Indiquez la ville d'où vous partez."),
  postalCode: postalCodeField,
  maxDistanceKm: z
    .string()
    .trim()
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value >= 5 && value <= 200, {
      error: "Indiquez une distance entre 5 et 200 km.",
    }),
  description: z
    .string()
    .trim()
    .min(30, "Décrivez ce que vous cherchez en 30 caractères minimum.")
    .max(2000, "La description ne doit pas dépasser 2 000 caractères."),
});

/* Le point de départ de l'acheteur est le centre de son rayon : sans
   commune reconnue, aucun lot ne pourrait jamais lui être signalé. L'action
   le vérifie (schemas/commune.ts). */
export const WANTED_COMMUNE_ERROR = "Choisissez la commune dans la liste proposée : c'est le centre du rayon que vous acceptez.";

export type WantedFormValues = z.infer<typeof wantedFormSchema>;
export type WantedFormErrors = Partial<Record<keyof WantedFormValues, string>>;

export function collectWantedFieldErrors(error: z.ZodError): WantedFormErrors {
  return collectErrors<keyof WantedFormValues>(error);
}
