"use client";

import type { MatchCandidate } from "@/lib/match-candidate";
import type { SellerSummary } from "@/types/profile";
import type { WantedListing } from "@/types/wanted";
import { PublishSummary } from "@/components/deposit/PublishSummary";
import { MatchingListings } from "@/components/wanted/MatchingListings";
import { WantedCard } from "@/components/wanted/WantedCard";
import type { City } from "@/lib/city-label";
import type { MutationResult } from "@/lib/data/mutation-result";
import type { WantedWriteResult } from "@/lib/data/wanted-mutations";
import { formatCardCount, formatPrice } from "@/lib/format";
import { GAME_LABELS, LOT_TYPE_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { getDistancesFromOrigin } from "@/lib/listing-display";
import { matchesWantedCriteria } from "@/lib/matching";
import { routes } from "@/lib/routes";
import type { WantedFormValues } from "@/lib/schemas/wanted-form";
import { SITE_URL } from "@/lib/site";

type WantedSummaryProps = {
  published: { values: WantedFormValues; result: MutationResult<WantedWriteResult> };
  buyer: SellerSummary;
  activeListings: MatchCandidate[];
  permalink?: string;
  now: string;
  /* La commune choisie dans le formulaire : le centre du rayon. */
  city: City | null;
  onEdit: () => void;
};

/* La demande validée, sous la forme où les vendeurs la verront. Elle
   n'existe pas encore en base, mais elle a tout ce qu'il faut pour être
   croisée avec les lots en ligne. */
function toPreview(values: WantedFormValues, city: City | null, buyer: SellerSummary, slug: string, now: string): WantedListing {
  return {
    id: "apercu",
    slug,
    reference: "RC-APERÇU",
    buyer,
    gameId: values.gameId,
    title: values.title,
    description: values.description,
    lotType: values.lotType === "" ? null : values.lotType,
    maxPriceCents: values.maxPriceEuros === null ? null : Math.round(values.maxPriceEuros * 100),
    minCardCount: values.minCardCount,
    city: city?.name ?? values.city,
    postalCode: values.postalCode,
    departmentCode: city?.departmentCode ?? "",
    latitude: city?.latitude ?? 0,
    longitude: city?.longitude ?? 0,
    maxDistanceKm: values.maxDistanceKm,
    status: "open",
    createdAt: now,
    updatedAt: now,
    fulfilledAt: null,
  };
}

export function WantedSummary({ published, buyer, activeListings, permalink, now, city, onEdit }: WantedSummaryProps) {
  const { values, result } = published;
  const slug = result.status === "saved" || result.status === "not-persisted" ? result.data.slug : "";
  const preview = toPreview(values, city, buyer, slug, now);
  const matching = activeListings.filter((listing) => matchesWantedCriteria(listing, preview) !== null);
  const origin = city;

  return (
    <PublishSummary
      subject="La demande"
      isSaved={result.status === "saved"}
      isEdit={permalink !== undefined}
      preview={<WantedCard wanted={preview} now={Date.parse(now)} />}
      crossing={
        <MatchingListings
          listings={matching.slice(0, 4)}
          totalCount={matching.length}
          distanceByListingId={origin ? getDistancesFromOrigin(matching, origin) : new Map<string, number>()}
        />
      }
      title={values.title}
      description={values.description}
      permalinkUrl={permalink ?? `${SITE_URL}${routes.wanted(slug)}`}
      dashboardHref={routes.accountWanted}
      dashboardLabel="Voir mes recherches"
      onEdit={onEdit}
      rows={[
        { label: "Jeu", value: GAME_LABELS[values.gameId] },
        { label: "Format", value: values.lotType === "" ? "Peu importe" : LOT_TYPE_LABELS[values.lotType] },
        { label: "Volume minimum", value: values.minCardCount === null ? "Peu importe" : formatCardCount(values.minCardCount) },
        { label: "Budget maximum", value: values.maxPriceEuros === null ? UNKNOWN_VALUE : formatPrice(values.maxPriceEuros * 100) },
        { label: "Point de départ", value: `${values.city} (${values.postalCode})` },
        { label: "Se déplace jusqu'à", value: `${values.maxDistanceKm} km` },
      ]}
    />
  );
}
