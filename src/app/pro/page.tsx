import type { Metadata } from "next";
import Link from "next/link";
import { ProFaq } from "@/components/pro/ProFaq";
import { ProForSellers } from "@/components/pro/ProForSellers";
import { ProPlanCard } from "@/components/pro/ProPlanCard";
import { ProSteps } from "@/components/pro/ProSteps";
import { ReservedCounts } from "@/components/pro/ReservedCounts";
import { Icon } from "@/components/ui/Icon";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getProOnlyCountByGame } from "@/lib/data/listings";
import { formatPrice } from "@/lib/format";
import { routes } from "@/lib/routes";
import { PRO_PLAN_PRICE_CENTS, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Le forfait pro — les lots réservés aux boutiques",
  description: `Boutiques et revendeurs : pour ${formatPrice(PRO_PLAN_PRICE_CENTS)} HT par mois, accédez aux lots que des particuliers ne montrent qu'aux pros sur ${SITE_NAME}. Le statut professionnel, vérifié par SIRET, reste gratuit.`,
  alternates: { canonical: routes.pro },
};

/* La page du forfait. Elle parle aux deux côtés : la boutique qui paie pour
   voir les lots réservés, et le particulier qui les réserve — sans lui, le
   forfait n'ouvrirait rien. Les chiffres viennent des annonces réelles, et
   ne disent que combien et de quels jeux, jamais quoi. */
export default async function ProPage() {
  const counts = await getProOnlyCountByGame();
  const reservedCount = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="container pb-[var(--section-gap)] pt-8 lg:pt-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14">
        <div className="min-w-0">
          <p className="eyebrow text-[var(--muted)]">Boutiques, dépôts-ventes, revendeurs</p>
          {/* display-h1 et non display-hero : la manchette de l'accueil se
              mesure sur la largeur de son conteneur (cqi), et sans conteneur
              ici elle prenait celle de la fenêtre — 109 px de corps dans une
              colonne de 826, un mot par ligne. */}
          <h1 className="display display-h1 mt-3">Les lots qu&apos;on ne montre qu&apos;aux pros.</h1>
          <p className="lead mt-5 text-[var(--ink-soft)]">
            Des particuliers veulent vendre un carton entier, vite, sans trente messages ni rendez-vous
            manqués : ils réservent leur annonce aux boutiques. Le forfait pro vous les ouvre ; le badge
            qui dit que vous en êtes une, lui, est gratuit.
          </p>
          <div className="mt-8 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-5">
            <ReservedCounts counts={counts} />
            <Link href={routes.proListings} className="mt-4 inline-flex items-center gap-1.5 text-[length:var(--text-md)] font-semibold underline underline-offset-4">
              Ouvrir l&apos;espace pro
              <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
        <ProPlanCard reservedCount={reservedCount} />
      </div>

      <section className="mt-[var(--section-gap)]">
        <SectionHeader eyebrow="Le mécanisme" title="Comment ça marche" />
        <ProSteps />
      </section>

      <section className="mt-[var(--section-gap)]">
        <ProForSellers />
      </section>

      {/* Le titre à gauche, les questions à droite : la section prend la
          largeur de la page, comme les précédentes. Bridée à 860 px, elle
          laissait un vide sous chacune. */}
      <section className="mt-[var(--section-gap)] grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start lg:gap-12">
        <SectionHeader eyebrow="Avant de souscrire" title="Questions" size="md" />
        <ProFaq />
      </section>
    </div>
  );
}
