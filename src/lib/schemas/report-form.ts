import { z } from "@/lib/schemas/zod";
import { REPORT_REASONS, REPORT_TARGETS } from "@/types/report";

/* Le signalement tel qu'il arrive du formulaire. La cible est désignée par
   ce que l'écran connaît — le lien d'une annonce, un pseudo, l'identifiant
   d'une conversation — et résolue côté serveur : un identifiant de base
   fourni par le navigateur ne serait pas vérifié. */
export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetKey: z.string().trim().min(1).max(160),
  reason: z.enum(REPORT_REASONS, {
    error: "Choisissez ce qui ne va pas.",
  }),
  details: z.string().trim().max(1000, "1 000 caractères au plus.").default(""),
});
