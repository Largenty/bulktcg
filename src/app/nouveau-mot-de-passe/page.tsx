import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { canChangePasswordFromLink } from "@/lib/data/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  robots: { index: false, follow: false },
};

/* La page où mène le lien reçu par e-mail. Il passe d'abord par la route de
   confirmation, qui ouvre la session du compte. Sans session ouverte par un
   tel lien depuis moins d'une heure — lien déjà servi, page ouverte à la
   main, session ouverte par mot de passe —, il n'y a pas de mot de passe à
   changer sans l'ancien, et la page le dit en renvoyant vers un nouveau
   lien. */
export default async function NewPasswordPage() {
  if (!(await canChangePasswordFromLink())) redirect(routes.expiredLink);
  return (
    <AuthPageLayout title="Nouveau mot de passe" form={<NewPasswordForm />}>
      <p className="lead mt-5 text-[var(--ink-soft)]">
        Choisissez un mot de passe que vous n&apos;utilisez nulle part ailleurs : s&apos;il fuit d&apos;un
        autre site, il n&apos;ouvrira pas celui-ci.
      </p>
    </AuthPageLayout>
  );
}
