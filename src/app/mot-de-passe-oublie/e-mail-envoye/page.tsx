import type { Metadata } from "next";
import { EmailSentScreen } from "@/components/auth/EmailSentScreen";
import { isSupabaseMode } from "@/lib/data/source";
import { readEmailSentTo } from "@/lib/email-sent";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

/* Après une demande de nouveau mot de passe. La même page, que l'adresse ait
   un compte ou non : dire « aucun compte pour cette adresse » dirait à
   n'importe qui quelles adresses sont inscrites. */
export default async function PasswordResetSentPage() {
  return (
    <EmailSentScreen
      maskedEmail={await readEmailSentTo()}
      sentence={(address) => (
        <>
          Si un compte existe pour {address}, un lien pour choisir un nouveau mot de passe vient d&apos;y
          partir.
        </>
      )}
      advice={[
        "Il arrive en général en quelques minutes.",
        "Rien reçu ? Regardez dans les indésirables et les promotions.",
        "Le lien sert une fois, pendant une heure, et ouvre la page où choisir le nouveau mot de passe.",
        "Toujours rien au bout de dix minutes ? Redemandez un lien, en vérifiant l'adresse.",
      ]}
      actions={[
        { href: routes.passwordReset, label: "Redemander un lien" },
        { href: routes.signIn, label: "Il vous revient ? Se connecter" },
      ]}
      demoNote={isSupabaseMode() ? null : "Site de démonstration : aucun e-mail ne part."}
    />
  );
}
