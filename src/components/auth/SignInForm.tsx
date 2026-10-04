"use client";

import Link from "next/link";
import { signInAction } from "@/app/actions/auth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { EmailField } from "@/components/auth/EmailField";
import { PasswordField } from "@/components/auth/PasswordField";
import { ProviderSignIn } from "@/components/auth/ProviderSignIn";
import { useAuthForm } from "@/components/auth/useAuthForm";
import { routes } from "@/lib/routes";
import { signInSchema } from "@/lib/schemas/auth-form";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

/* `returnTo` : où revenir une fois connecté, déjà filtré par la page
   (safeReturnPath) ; le schéma le refiltre à l'arrivée. */
export function SignInForm({ returnTo }: { returnTo: string }) {
  const form = useAuthForm(signInSchema, signInAction, ["email", "password"]);

  return (
    <AuthFormShell
      form={form}
      submitLabel="Se connecter"
      action="vous connecter"
      notPersistedText={`Adresse et mot de passe au bon format, mais rien n'est vérifié : ${DEMO_MODE_REASON}, où un compte est déjà connecté.`}
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={routes.signUpThenReturn(returnTo)} className="text-link">
            Créer un compte
          </Link>
        </>
      }
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <ProviderSignIn label="Se connecter avec Google" />
      <EmailField autoComplete="username" defaultValue={form.values.email} error={form.errors.email} />
      <PasswordField
        isNew={false}
        error={form.errors.password}
        after={
          <Link href={routes.passwordReset} className="text-link self-start text-[length:var(--text-sm)]">
            Mot de passe oublié ?
          </Link>
        }
      />
    </AuthFormShell>
  );
}
