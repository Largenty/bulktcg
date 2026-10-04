import { z } from "@/lib/schemas/zod";
import { isValidSiret, normalizeSiret } from "@/lib/siret";

/* La déclaration du statut professionnel (Paramètres) : le SIRET de
   l'établissement, l'enseigne facultative — le nom du répertoire sinon —,
   et l'engagement de la personne qui le déclare. Le même schéma dans le
   navigateur, pour répondre tout de suite à une faute de frappe, et dans
   l'action serveur, qui vérifie ensuite l'établissement auprès du
   répertoire des entreprises (lib/company-registry.ts). */

export const proStatusSchema = z.object({
  siret: z
    .string()
    .transform(normalizeSiret)
    .refine((siret) => /^\d{14}$/.test(siret), "Le SIRET compte 14 chiffres : celui de l'établissement, pas le SIREN seul.")
    /* La clé seulement sur quatorze chiffres : un message à la fois. */
    .refine((siret) => !/^\d{14}$/.test(siret) || isValidSiret(siret), "Ce numéro n'est pas un SIRET valide : vérifiez les chiffres."),
  companyName: z
    .string()
    .trim()
    .max(80, "80 caractères au plus.")
    .refine((value) => value === "" || value.length >= 2, "Deux caractères au moins.")
    .default(""),
  /* Un SIRET prouve qu'un établissement existe, pas que la personne qui le
     tape le dirige : c'est cette déclaration qui l'engage. */
  certifies: z.preprocess(
    (value) => value === "on" || value === true,
    z.literal(true, { error: "Cochez la déclaration : le statut professionnel engage le compte qui le déclare." }),
  ),
});

export type ProStatusValues = z.infer<typeof proStatusSchema>;
