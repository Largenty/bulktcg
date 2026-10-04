import type { Metadata } from "next";
import { EmailSentScreen } from "@/components/auth/EmailSentScreen";
import { isSupabaseMode } from "@/lib/data/source";
import { readEmailSentTo } from "@/lib/email-sent";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Confirmez votre adresse",
  robots: { index: false, follow: false },
};

/* Après une inscription acceptée. La page ne sait pas si un compte vient de
   naître, existait déjà, ou si l'envoi a échoué — et ne doit pas le dire :
   chaque phrase reste vraie dans les trois cas. Recommencer l'inscription
   renvoie le lien à une adresse non confirmée, et crée le compte si le
   premier essai ne l'avait pas fait. */
export default async function SignUpSentPage() {
  return (
    <EmailSentScreen
      maskedEmail={await readEmailSentTo()}
      sentence={(address) => (
        <>
          Si {address} est valide et n&apos;a pas encore de compte confirmé, un lien de confirmation vient
          d&apos;y partir. Votre compte s&apos;ouvre quand vous le suivez.
        </>
      )}
      advice={[
        "Il arrive en général en quelques minutes.",
        "Rien reçu ? Regardez dans les indésirables et les promotions.",
        "Le lien sert une fois, pendant une heure.",
        "Toujours rien au bout de dix minutes ? L'envoi a pu échouer : recommencez l'inscription. Le lien repart, et le compte se crée s'il ne l'avait pas été.",
      ]}
      actions={[
        { href: routes.signUp, label: "Recommencer l'inscription" },
        { href: routes.signIn, label: "Déjà confirmé ? Se connecter" },
        { href: routes.passwordReset, label: "Un compte, mais plus le mot de passe ?" },
      ]}
      demoNote={
        isSupabaseMode()
          ? null
          : "Site de démonstration : aucun compte n'est créé et aucun e-mail ne part. Avec la base branchée, cette page suit chaque inscription."
      }
    />
  );
}
