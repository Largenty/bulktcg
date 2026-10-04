"use client";

import type { ReactNode } from "react";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import type { useAuthForm } from "@/components/auth/useAuthForm";
import { Button } from "@/components/ui/Button";

type AuthFormShellProps = {
  form: ReturnType<typeof useAuthForm>;
  submitLabel: string;
  /* Ce qui a été demandé, pour le compte rendu : « vous connecter »… */
  action: string;
  /* La phrase de la démonstration, quand le formulaire est valide mais que
     rien n'est vérifié ni envoyé. Sans objet pour l'inscription et le mot
     de passe oublié, dont une demande acceptée mène à la page qui suit. */
  notPersistedText?: string;
  children: ReactNode;
  /* Le lien vers l'autre parcours : « Pas encore de compte ? ». */
  footer?: ReactNode;
};

/* Le cadre des quatre formulaires du compte : le panneau, les champs, le
   bouton, le compte rendu annoncé aux lecteurs d'écran, puis le lien vers
   l'autre parcours. L'action serveur est sur l'attribut action — le
   formulaire part en POST même sans JavaScript —, noValidate laisse les
   messages au schéma plutôt qu'aux bulles du navigateur. */
export function AuthFormShell({ form, submitLabel, action, notPersistedText, children, footer }: AuthFormShellProps) {
  return (
    <form action={form.formAction} onSubmit={form.onSubmit} noValidate className="panel flex flex-col gap-5">
      {children}
      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={form.isPending}>
          {form.isPending ? "Vérification…" : submitLabel}
        </Button>
        <PersistenceNote result={form.outcome} action={action} notPersistedText={notPersistedText} />
      </div>
      {footer ? (
        <p className="border-t-[length:var(--border-width)] border-[var(--line)] pt-5 text-[length:var(--text-md)]">{footer}</p>
      ) : null}
    </form>
  );
}
