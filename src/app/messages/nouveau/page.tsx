import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactSellerView } from "@/components/messages/ContactSellerView";
import { ProposeListingView } from "@/components/messages/ProposeListingView";
import { requireCurrentUserId } from "@/lib/data/session";
import { ROUTE_PARAM, routes } from "@/lib/routes";
import { firstParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Nouveau message",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<SearchParams> };

/* Écrire à quelqu'un, à propos de quelque chose. Deux entrées :
   « Contacter le vendeur » depuis une fiche (?annonce=), et « J'ai ce lot »
   depuis une demande de recherche (?recherche=). Avant, les deux menaient à
   la boîte de réception, où rien ne permettait d'écrire à qui que ce soit. */
export default async function NewConversationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const listingSlug = firstParam(params[ROUTE_PARAM.aboutListing]);
  if (listingSlug) {
    const viewerId = await requireCurrentUserId(routes.contactSeller(listingSlug));
    return <ContactSellerView slug={listingSlug} viewerId={viewerId} />;
  }
  const wantedSlug = firstParam(params[ROUTE_PARAM.aboutWanted]);
  if (wantedSlug) {
    const viewerId = await requireCurrentUserId(routes.proposeListing(wantedSlug));
    return <ProposeListingView slug={wantedSlug} viewerId={viewerId} />;
  }
  notFound();
}
