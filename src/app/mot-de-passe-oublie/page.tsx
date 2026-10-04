import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { PasswordResetRequestForm } from "@/components/auth/PasswordResetRequestForm";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Mot de passe oublié",
  robots: { index: false, follow: true },
};

export default function PasswordResetRequestPage() {
  return (
    <AuthPageLayout title="Mot de passe oublié" form={<PasswordResetRequestForm />}>
      <p className="lead mt-5 text-[var(--ink-soft)]">
        Indiquez l&apos;adresse de votre compte : un lien pour choisir un nouveau mot de passe y part,
        valable une heure.
      </p>
      <p className="mt-5 text-[length:var(--text-lg)] leading-relaxed text-[var(--muted)]">
        Personne chez BulkTCG ne vous demandera votre mot de passe, ni par message ni par
        téléphone.{" "}
        <Link href={routes.safety} className="text-link text-[var(--ink)]">
          Nos conseils de sécurité
        </Link>{" "}
        disent ce qu&apos;on ne vous demandera jamais.
      </p>
    </AuthPageLayout>
  );
}
