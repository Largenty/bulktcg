import { z } from "@/lib/schemas/zod";
import { parseDecimal } from "@/lib/decimal";
import { safeReturnPath } from "@/lib/routes";

/* Les champs que plusieurs formulaires partagent, écrits une fois : le titre
   d'une annonce ou d'une recherche, le code postal, la commune au
   référentiel, le nombre facultatif, et ceux du compte. */

export const titleField = z
  .string()
  .trim()
  .min(12, "Le titre doit faire au moins 12 caractères.")
  .max(90, "Le titre ne doit pas dépasser 90 caractères.");

/* Le pseudo finit dans le filigrane des photos : court, sans espace ni
   accent, pour rester lisible en coin d'image. Le profil et l'inscription
   partagent la même règle. */
export const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,24}$/, "De 3 à 24 caractères : lettres sans accent, chiffres, point, tiret.");

/* L'adresse sert d'identifiant : normalisée — espaces retirés, minuscules —
   pour qu'une majuscule tapée par le téléphone ne crée pas un second
   compte. 254 caractères, la limite d'une adresse (RFC 5321) : rien de plus
   long n'est lu. */
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Indiquez votre adresse e-mail.")
  .max(254, "Cette adresse est trop longue pour être valide.")
  .pipe(z.email({ error: "Cette adresse e-mail n'est pas valide : vérifiez l'arobase et le domaine." }));

/* Un nouveau mot de passe : 12 caractères au moins, 128 au plus, et aucune
   règle de composition — une phrase de passe se retient mieux qu'un mot
   hérissé de symboles, et c'est la longueur qui protège (NIST SP 800-63B).
   Jamais rogné : une espace en tête fait partie du mot de passe. En phase 2,
   Supabase refuse en plus les mots de passe connus des fuites. */
export const newPasswordField = z
  .string()
  .min(12, "12 caractères au moins : une phrase de quelques mots se retient mieux qu'un mot compliqué.")
  .max(128, "128 caractères au plus.");

/* Le mot de passe d'une connexion : aucune règle à révéler, seulement une
   borne, pour qu'un envoi démesuré ne soit pas traité. */
export const currentPasswordField = z
  .string()
  .min(1, "Indiquez votre mot de passe.")
  .max(128, "128 caractères au plus.");

/* Le code postal d'une commune, que le choix dans la liste pose. Vide sans
   JavaScript : le serveur retrouve alors la commune à son nom
   (schemas/commune.ts), le seul qui vérifie qu'elle existe — le référentiel
   ne part pas dans le navigateur. */
export const postalCodeField = z
  .string()
  .trim()
  .regex(/^(\d{5})?$/, "Le code postal doit contenir cinq chiffres.")
  .default("");

/* Un champ numérique laissé vide vaut null, pas zéro : « je n'ai pas compté »
   et « il y a zéro carte » ne sont pas la même information. */
export function optionalPositiveNumber(error: string, { isInteger }: { isInteger: boolean }) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : parseDecimal(value)))
    .refine(
      (value) =>
        value === null ||
        (Number.isFinite(value) && value > 0 && (!isInteger || Number.isInteger(value))),
      { error },
    );
}

/* Le chemin de retour après connexion, porté par un champ caché. Il arrive
   de l'URL et se trafique : filtré par safeReturnPath, il redevient l'accueil
   du compte plutôt que de bloquer la connexion. */
export const returnToField = z.string().optional().transform(safeReturnPath);
