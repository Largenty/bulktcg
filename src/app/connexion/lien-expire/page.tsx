import type { Metadata } from "next";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Lien expiré",
  robots: { index: false, follow: false },
};

/* Un lien reçu par e-mail qui a déjà servi, ou expiré : on le dit, et on
   donne de quoi repartir, plutôt qu'une connexion qui échouerait sans
   raison. */
export default function ExpiredLinkPage() {
  return (
    <AuthPageLayout
      title="Ce lien n'est plus valable"
      form={
        <div className="panel flex flex-col gap-3">
          <ButtonLink href={routes.passwordReset} size="lg">
            Recevoir un nouveau lien
          </ButtonLink>
          <ButtonLink href={routes.signIn} variant="secondary" size="lg">
            Se connecter
          </ButtonLink>
        </div>
      }
    >
      <p className="lead mt-5 text-[var(--ink-soft)]">
        Un lien reçu par e-mail ne sert qu&apos;une fois, et pendant une heure : celui-ci a déjà servi,
        ou il a expiré.
      </p>
      <p className="mt-5 text-[length:var(--text-lg)] leading-relaxed text-[var(--muted)]">
        Votre adresse est peut-être déjà confirmée : essayez de vous connecter. Pour choisir un
        nouveau mot de passe, demandez un autre lien.
      </p>
    </AuthPageLayout>
  );
}
