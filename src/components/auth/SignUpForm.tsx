"use client";

import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { EmailField } from "@/components/auth/EmailField";
import { PasswordField } from "@/components/auth/PasswordField";
import { ProviderSignIn } from "@/components/auth/ProviderSignIn";
import { useAuthForm } from "@/components/auth/useAuthForm";
import { CityCombobox } from "@/components/city/CityCombobox";
import { Input } from "@/components/ui/Input";
import { routes } from "@/lib/routes";
import { signUpSchema } from "@/lib/schemas/auth-form";

/* `returnTo` : où le lien de confirmation ramènera, comme à la connexion. */
export function SignUpForm({ returnTo }: { returnTo: string }) {
  const form = useAuthForm(signUpSchema, signUpAction, ["username", "email", "password", "city"]);

  return (
    <AuthFormShell
      form={form}
      submitLabel="Créer mon compte"
      action="créer votre compte"
      footer={
        <>
          Vous avez déjà un compte ?{" "}
          <Link href={routes.signInThenReturn(returnTo)} className="text-link">
            Se connecter
          </Link>
        </>
      }
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <ProviderSignIn label="Continuer avec Google" />
      {/* Le pseudo n'est pas l'identifiant de connexion — c'est l'adresse :
          « nickname », pour que le gestionnaire de mots de passe ne
          l'enregistre pas à sa place. */}
      <Input
        id="username"
        label="Pseudo"
        isRequired
        autoComplete="nickname"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={24}
        defaultValue={form.values.username}
        error={form.errors.username}
        hint="Il apparaîtra sur vos annonces, sur votre profil public et dans le filigrane de vos photos."
      />
      <EmailField autoComplete="email" defaultValue={form.values.email} error={form.errors.email} />
      <PasswordField isNew error={form.errors.password} />
      <CityCombobox
        id="city"
        label="Commune"
        autoComplete="address-level2"
        defaultValue={form.values.city}
        error={form.errors.city ?? form.errors.postalCode}
        hint="Elle montre aux acheteurs ce qui se vend près d'eux. L'adresse exacte n'est jamais demandée."
      />
    </AuthFormShell>
  );
}
