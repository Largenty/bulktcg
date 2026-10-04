import type { Metadata } from "next";
import { ReservedCounts } from "@/components/pro/ReservedCounts";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProBadge } from "@/components/pro/ProBadge";
import { getProOnlyCountByGame, getProOnlyListings, isViewerActivePro } from "@/lib/data/listings";
import { requireCurrentUserId } from "@/lib/data/session";
import { countLabel } from "@/lib/french";
import { routes } from "@/lib/routes";

/* Jamais indexée : son contenu dépend de qui la regarde, et ce qu'elle montre
   aux pros n'a pas à apparaître ailleurs. */
export const metadata: Metadata = {
  title: "Espace pro — lots réservés",
  robots: { index: false, follow: false },
};

/* Les lots que des particuliers ne montrent qu'aux boutiques. Un pro au
   forfait actif les voit tous ; un autre visiteur n'en apprend que le
   nombre et les jeux, avec la porte d'entrée vers le forfait. La couche
   données garde la même règle : getProOnlyListings rend une liste vide à
   qui n'y a pas droit, même si cette page venait à l'oublier. */
export default async function ProListingsPage() {
  const viewerId = await requireCurrentUserId(routes.proListings);
  const isPro = await isViewerActivePro(viewerId);

  if (!isPro) {
    const counts = await getProOnlyCountByGame();
    /* Deux colonnes, comme la page du forfait : ce qu'est l'espace et comment
       y entrer, puis ce qui y attend — le nombre, jamais le contenu. Bridée à
       860 px, la page laissait vide plus d'un tiers d'un grand écran. */
    return (
      <div className="container pb-[var(--section-gap)] pt-8 lg:pt-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <p className="eyebrow text-[var(--muted)]">Espace pro</p>
            <h1 className="display display-h2 mt-3">Réservé aux boutiques au forfait</h1>
            <p className="lead mt-4 text-[var(--ink-soft)]">
              Ces lots, leurs vendeurs ont choisi de ne les montrer qu&apos;aux professionnels. Vous en voyez
              le nombre ; leur contenu s&apos;ouvre avec le forfait pro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={routes.pro}>Découvrir le forfait pro</ButtonLink>
              <ButtonLink href={routes.listings} variant="secondary">
                Voir les lots publics
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-6 sm:p-8">
            <ReservedCounts counts={counts} />
          </div>
        </div>
      </div>
    );
  }

  const listings = await getProOnlyListings(viewerId, { limit: 200 });

  return (
    <div className="container pb-[var(--section-gap)] pt-8 lg:pt-12">
      <div className="flex flex-wrap items-center gap-3">
        <p className="eyebrow text-[var(--muted)]">Espace pro</p>
        <ProBadge />
      </div>
      <h1 className="display display-h2 mt-3">Lots réservés aux pros</h1>
      <p className="mt-3 text-[length:var(--text-body)] text-[var(--ink-soft)]">
        {countLabel(listings.length, "lot", "lots")} que {listings.length > 1 ? "leurs vendeurs ne montrent" : "son vendeur ne montre"}{" "}
        qu&apos;aux boutiques : ni la recherche publique ni Google ne les voient. Écrivez depuis l&apos;annonce,
        comme pour n&apos;importe quel lot.
      </p>

      <div className="mt-8">
        {listings.length > 0 ? (
          <ListingGrid listings={listings} priorityCount={4} />
        ) : (
          <EmptyState
            title="Aucun lot réservé en ce moment"
            reason="Quand un particulier réserve son lot aux pros, il arrive ici dès sa publication."
            action={<ButtonLink href={routes.listings}>Voir les lots publics</ButtonLink>}
          />
        )}
      </div>
    </div>
  );
}
