import type { Metadata } from "next";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { SignInForm } from "@/components/auth/SignInForm";
import { ROUTE_PARAM, safeReturnPath } from "@/lib/routes";
import { firstParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Se connecter",
  robots: { index: false, follow: true },
};

type PageProps = { searchParams: Promise<SearchParams> };

/* Une page réservée envoie ici avec ?suivant= : la connexion ramène là où
   l'on allait. */
export default async function SignInPage({ searchParams }: PageProps) {
  const returnTo = safeReturnPath(firstParam((await searchParams)[ROUTE_PARAM.returnTo]));
  return (
    <AuthPageLayout title="Se connecter" form={<SignInForm returnTo={returnTo} />}>
      <p className="lead mt-5 text-[var(--ink-soft)]">
        Pour déposer une annonce, changer un statut en un clic et répondre aux acheteurs.
        Parcourir les lots ne demande aucun compte.
      </p>
    </AuthPageLayout>
  );
}
