import { z } from "@/lib/schemas/zod";
import {
  currentPasswordField,
  emailField,
  newPasswordField,
  postalCodeField,
  returnToField,
  usernameField,
} from "@/lib/schemas/fields";

/* Les formulaires du compte : connexion, inscription, mot de passe oublié,
   nouveau mot de passe. Comme partout, le même schéma valide la saisie
   dans le navigateur, pour répondre tout de suite, puis dans l'action
   serveur, parce qu'un formulaire se trafique. */

export const signInSchema = z.object({
  email: emailField,
  password: currentPasswordField,
  returnTo: returnToField,
});

/* Un mot de passe qui répète l'adresse ou le pseudo se devine avant tout
   autre : il est refusé. */
function passwordRepeatsIdentity(values: { password: string; email: string; username?: string }): boolean {
  const password = values.password.toLowerCase();
  const localPart = values.email.split("@")[0] ?? "";
  return [values.email, localPart, values.username ?? ""].some((identity) => identity.length >= 3 && password.includes(identity));
}

const PASSWORD_REPEATS_IDENTITY = {
  path: ["password"],
  error: "Le mot de passe ne doit pas reprendre votre adresse ni votre pseudo.",
};

export const signUpSchema = z
  .object({
    username: usernameField,
    email: emailField,
    password: newPasswordField,
    /* La commune place les annonces sur la carte des acheteurs, choisie
       dans le référentiel comme partout ailleurs. L'adresse exacte n'est
       jamais demandée. */
    city: z.string().trim().min(2, "Indiquez votre commune."),
    postalCode: postalCodeField,
    returnTo: returnToField,
  })
  .refine((values) => !passwordRepeatsIdentity(values), PASSWORD_REPEATS_IDENTITY);

export const passwordResetRequestSchema = z.object({
  email: emailField,
});

/* Le nouveau mot de passe, depuis le lien reçu par e-mail. L'adresse vient
   de la session ouverte par ce lien, pas du formulaire. */
export const newPasswordSchema = z.object({
  password: newPasswordField,
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;
export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
