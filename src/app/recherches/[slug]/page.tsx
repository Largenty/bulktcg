import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { StickyColumn } from "@/components/layout/StickyColumn";
import { SafetyNote } from "@/components/listing/SafetyNote";
import { SellerCard } from "@/components/listing/SellerCard";
import { ReportLink } from "@/components/report/ReportLink";
import { WantedDetails } from "@/components/wanted/WantedDetails";
import { WantedHeadline } from "@/components/wanted/WantedHeadline";
import { WantedMatchesSection } from "@/components/wanted/WantedMatchesSection";
import { WantedViewerActions } from "@/components/wanted/WantedViewerActions";
import { getCurrentUserId } from "@/lib/data/session";
import { getListingsMatchingWanted, getWantedBySlug } from "@/lib/data/wanted";
import { atCity } from "@/lib/french";
import { GAME_LABELS, withGame } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { getWantedListingsUrl } from "@/lib/wanted-query";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const wanted = await getWantedBySlug(slug);
  if (!wanted) return { title: "Demande introuvable" };

  return {
    title: `${wanted.title} — ${wanted.city}`,
    description: `${withGame("Demande de recherche", wanted.gameId)} ${atCity(wanted.city)}, dans un rayon de ${wanted.maxDistanceKm} km.`,
    alternates: { canonical: routes.wanted(wanted.slug) },
    /* Personne ne tape « quelqu'un cherche du vrac Pokémon » : la demande est
       servie pour son lien permanent, pas pour Google. */
    robots: { index: false, follow: true },
  };
}

/* Deux colonnes, comme une fiche d'annonce. À droite, épinglé, ce qui fait
   agir : le jeu, le titre, le budget, les gestes et l'acheteur. À gauche, la
   demande elle-même — ses critères et ce que l'acheteur en dit. Bridée à
   1 000 px, la page laissait vide un tiers d'un écran de 1 600.

   Sur téléphone, l'ordre est celui de la lecture : le titre et le bouton
   d'abord, le détail ensuite. */
export default async function WantedPage({ params }: PageProps) {
  const { slug } = await params;
  const wanted = await getWantedBySlug(slug);
  if (!wanted) notFound();

  const [matchingListings, viewerId] = await Promise.all([getListingsMatchingWanted(wanted), getCurrentUserId()]);
  const isOwner = viewerId === wanted.buyer.id;

  return (
    <div className="container pb-[var(--section-gap)] pt-6 lg:pt-10">
      <Breadcrumb
        items={[
          { href: routes.wantedListings, label: "Recherches" },
          /* Comme sur une fiche d'annonce, le fil s'arrête au jeu : le titre
             suit juste en dessous. Il finissait sur la référence, « RC-II1H2K »,
             qu'aucun acheteur ne lit comme un nom de page. */
          { href: getWantedListingsUrl(wanted.gameId), label: GAME_LABELS[wanted.gameId] },
        ]}
      />

      <div className="grid gap-7 [grid-template-areas:'aside'_'details'] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-x-12 lg:[grid-template-areas:'details_aside']">
        <div className="min-w-0 [grid-area:aside]">
          <StickyColumn className="flex flex-col gap-5">
            <WantedHeadline wanted={wanted} />
            <WantedViewerActions wanted={wanted} isOwner={isOwner} />
            <SellerCard seller={wanted.buyer} role="Cherché par" />
            <SafetyNote />
            {isOwner ? null : <ReportLink target="wanted" targetKey={wanted.slug} />}
          </StickyColumn>
        </div>

        <WantedDetails wanted={wanted} />
      </div>

      <WantedMatchesSection wanted={wanted} listings={matchingListings} />
    </div>
  );
}
