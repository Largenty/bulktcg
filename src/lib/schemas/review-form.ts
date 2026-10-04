import { z } from "@/lib/schemas/zod";

/* Une note de 1 à 5 par critère. Un critère laissé vide arrive à null, que
   la coercition changerait en 0 : il est refusé avec la consigne, jamais
   compté comme une note de zéro. */
const score = z.coerce
  .number({ error: "Choisissez une note de 1 à 5." })
  .int("Choisissez une note de 1 à 5.")
  .min(1, "Choisissez une note de 1 à 5.")
  .max(5, "Choisissez une note de 1 à 5.");

export const reviewSchema = z.object({
  dealId: z.string().trim().min(1).max(64),
  punctuality: score,
  responsiveness: score,
  reliability: score,
  comment: z.string().trim().max(1000, "1 000 caractères au plus.").default(""),
});
