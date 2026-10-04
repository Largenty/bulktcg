"use client";

import { newPasswordAction } from "@/app/actions/auth";
import { AuthFormShell } from "@/components/auth/AuthFormShell";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuthForm } from "@/components/auth/useAuthForm";
import { newPasswordSchema } from "@/lib/schemas/auth-form";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

/* Depuis le lien reçu par e-mail : la session ouverte par ce lien désigne
   le compte, le formulaire ne demande que le nouveau mot de passe. */
export function NewPasswordForm() {
  const form = useAuthForm(newPasswordSchema, newPasswordAction, ["password"]);

  return (
    <AuthFormShell
      form={form}
      submitLabel="Enregistrer le mot de passe"
      action="enregistrer le mot de passe"
      notPersistedText={`Mot de passe au bon format, mais rien n'est changé : ${DEMO_MODE_REASON}.`}
    >
      <PasswordField isNew label="Nouveau mot de passe" error={form.errors.password} />
    </AuthFormShell>
  );
}
