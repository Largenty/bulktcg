import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageLayout } from "@/components/auth/AuthPageLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { formatPrice } from "@/lib/format";
import { ROUTE_PARAM, routes, safeReturnPath } from "@/lib/routes";
import { firstParam, type SearchParams } from "@/lib/search-params";
import { BUMP_PRICE_CENTS, EXTRA_PHOTOS_PRICE_CENTS, FEATURED_PRICE_CENTS, URGENT_PRICE_CENTS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false, follow: true },
};

/* Ce qui est public est dit avant l'inscription, pas découvert après : le
   pseudo se retrouve dans le filigrane des photos, et la ville place les
   annonces sur la carte des acheteurs. */
const PUBLIC_FACTS = [
  "Votre pseudo, sur chaque annonce et dans le filigrane de vos photos.",
  "Votre ville, jamais votre adresse : elle se convient dans la conversation.",
  "Votre note et vos avis, écrits par les acheteurs, une fois les ventes faites.",
];

type PageProps = { searchParams: Promise<SearchParams> };

export default async function SignUpPage({ searchParams }: PageProps) {
  const returnTo = safeReturnPath(firstParam((await searchParams)[ROUTE_PARAM.returnTo]));
  return (
    <AuthPageLayout title="Créer un compte" form={<SignUpForm returnTo={returnTo} />}>
      {/* Les prix viennent des constantes : écrits ici à la main, ils
          annonçaient « la seule chose facturée » alors que trois options
          l'étaient — quatre depuis la remontée. */}
      <p className="lead mt-5 text-[var(--ink-soft)]">
        Gratuit, et aucune commission n&apos;est prélevée sur vos ventes. Seules quatre options sont
        payantes, toutes facultatives : la mise en avant ({formatPrice(FEATURED_PRICE_CENTS)}), « Urgent »
        ({formatPrice(URGENT_PRICE_CENTS)}), la remontée ({formatPrice(BUMP_PRICE_CENTS)}) et les photos au-delà de trois (
        {formatPrice(EXTRA_PHOTOS_PRICE_CENTS)}).
      </p>

      {/* Le statut professionnel ne se demande pas ici : la plupart des
          comptes sont des particuliers, et une inscription courte est une
          inscription faite. Il se déclare ensuite, dans Paramètres. */}
      <p className="mt-5 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
        Vous vendez pour une boutique ou un commerce ? Créez votre compte, puis déclarez le SIRET de l&apos;établissement
        dans Paramètres : vos annonces porteront le badge Pro et votre enseigne. C&apos;est gratuit.
      </p>

      <div className="mt-8 rounded-[var(--radius-lg)] bg-[var(--tint)] p-5">
        <h2 className="label text-[var(--muted)]">Ce qui sera public</h2>
        <ul className="mt-4 flex list-none flex-col gap-3">
          {PUBLIC_FACTS.map((fact) => (
            <li key={fact} className="flex gap-3 text-[length:var(--text-md)] leading-snug">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink)]" />
              {fact}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 text-[length:var(--text-md)] leading-relaxed text-[var(--muted)]">
        Les{" "}
        <Link href={routes.legal} className="text-link text-[var(--ink)]">
          mentions légales
        </Link>{" "}
        disent ce que le site applique déjà — qui publie, dans quel ordre, combien de temps les photos sont gardées.
        L&apos;éditeur et l&apos;hébergeur y restent à compléter tant que le site n&apos;est pas exploité : une mention
        vraisemblable mais fausse serait plus dangereuse qu&apos;une mention manquante.
      </p>
    </AuthPageLayout>
  );
}
