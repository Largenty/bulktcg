import { z } from "@/lib/schemas/zod";
import { postalCodeField, usernameField } from "@/lib/schemas/fields";

/* La commune d'un compte, vérifiée par l'action (schemas/commune.ts) : le
   message d'une commune que le référentiel ne connaît pas, au profil comme à
   l'inscription. */
export const COMMUNE_ERROR = "Choisissez la commune dans la liste proposée.";

/* Les adresses de profil acceptées, les mêmes qu'en base (migration 16). */
export const CARDMARKET_PROFILE = /^https:\/\/www\.cardmarket\.com\/[a-z]{2}\/[A-Za-z]+\/Users\/[A-Za-z0-9_.-]+$/;
export const CARDNEXUS_PROFILE = /^https:\/\/(www\.)?cardnexus\.com\/\S+$/;

/* Le profil public. Le pseudo suit la règle de l'inscription (fields.ts). */
export const profileSchema = z.object({
    username: usernameField,
    bio: z.string().trim().max(280, "Deux lignes suffisent : 280 caractères au maximum."),
    city: z.string().trim().min(2, "Indiquez votre ville."),
    postalCode: postalCodeField,
    /* La fiche boutique, pour un pro. Absente du formulaire d'un
       particulier, elle arrive vide et la couche données l'ignore. */
    shopAddress: z
      .string()
      .trim()
      .max(160, "160 caractères au plus.")
      .refine((value) => value === "" || value.length >= 5, "Indiquez au moins la rue et la commune.")
      .default(""),
    shopHours: z
      .string()
      .trim()
      .max(160, "160 caractères au plus.")
      .refine((value) => value === "" || value.length >= 3, "Précisez les jours et les heures.")
      .default(""),
    shopWebsite: z
      .string()
      .trim()
      .max(200, "200 caractères au plus.")
      .refine((value) => value === "" || /^https:\/\/\S+$/.test(value), "Une adresse complète, qui commence par https://")
      .default(""),
    /* Ses pages de vendeur ailleurs, déclarées et affichées comme telles. La
       forme est celle que la base exige (migration 16) : l'adresse de la
       page vendeur, copiée depuis le navigateur. */
    cardmarketUrl: z
      .string()
      .trim()
      .max(200, "200 caractères au plus.")
      .refine(
        (value) => value === "" || CARDMARKET_PROFILE.test(value),
        "L'adresse de votre page vendeur Cardmarket : https://www.cardmarket.com/fr/…/Users/votre-pseudo",
      )
      .default(""),
    cardnexusUrl: z
      .string()
      .trim()
      .max(200, "200 caractères au plus.")
      .refine((value) => value === "" || CARDNEXUS_PROFILE.test(value), "L'adresse de votre page CardNexus : https://cardnexus.com/…")
      .default(""),
  });

export type ProfileValues = z.infer<typeof profileSchema>;
