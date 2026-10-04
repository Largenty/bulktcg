import { z } from "@/lib/schemas/zod";

/* Un message : ni vide, ni roman. Le plafond protège la conversation de ce
   qui ressemble à un copier-coller de description. */
export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(2, "Écrivez votre message avant de l'envoyer.")
    .max(2000, "Un message ne dépasse pas 2 000 caractères."),
});
