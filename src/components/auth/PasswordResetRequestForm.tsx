"use client";

import Link from "next/link";
import { passwordResetRequestAction } from "@/app/actions/auth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { EmailField } from "@/components/auth/EmailField";
import { useAuthForm } from "@/components/auth/useAuthForm";
import { routes } from "@/lib/routes";
import { passwordResetRequestSchema } from "@/lib/schemas/auth-form";

/* La réponse est la même, que l'adresse ait un compte ou non : sinon ce
   formulaire dirait à n'importe qui quelles adresses sont inscrites. */
export function PasswordResetRequestForm() {
  const form = useAuthForm(passwordResetRequestSchema, passwordResetRequestAction, ["email"]);

  return (
    <AuthFormShell
      form={form}
      submitLabel="Recevoir le lien"
      action="recevoir le lien"
      footer={
        <>
          Il vous revient ?{" "}
          <Link href={routes.signIn} className="text-link">
            Se connecter
          </Link>
        </>
      }
    >
      <EmailField autoComplete="email" defaultValue={form.values.email} error={form.errors.email} />
    </AuthFormShell>
  );
}
