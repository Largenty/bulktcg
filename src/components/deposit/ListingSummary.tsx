"use client";

import type { SellerSummary } from "@/types/profile";
import type { WantedListing } from "@/types/wanted";
import { PublishSummary } from "@/components/deposit/PublishSummary";
import type { PublishedListing } from "@/components/deposit/useListingSubmit";
import { ListingCard } from "@/components/listing/ListingCard";
import { MatchingWanted, type MatchAlert } from "@/components/wanted/MatchingWanted";
import type { City } from "@/lib/city-label";
import type { Edition } from "@/types/edition";
import { formatCardCount, formatPrice, formatWeight } from "@/lib/format";
import { AUDIENCE_LABELS, CONDITION_LABELS, GAME_LABELS, LANGUAGE_LABELS, LOT_TYPE_LABELS, TAG_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { buildPreviewListing, type DraftPhoto } from "@/lib/listing-draft";
import { matchListingAgainstWanted, sortMatches, type WantedMatch } from "@/lib/matching";
import { routes } from "@/lib/routes";
import { toPriceCents, type ListingFormValues } from "@/lib/schemas/listing-form";
import { MAX_PHOTOS, SITE_URL } from "@/lib/site";

type ListingSummaryProps = {
  published: PublishedListing;
  photos: DraftPhoto[];
  seller: SellerSummary;
  now: string;
  openWantedListings: WantedListing[];
  permalink?: string;
  /* Les options payantes cochées au dépôt : elles ne passent pas par le
     schéma — le paiement, à venir, les validera — mais l'aperçu et le
     récapitulatif les montrent. */
  options: { isFeatured: string; isUrgent: string; isBumped: string };
  /* La commune choisie dans le formulaire : elle situe le lot pour le
     croisement. */
  city: City | null;
  /* Les séries reçues du serveur : le récapitulatif y lit leurs codes. */
  editions: ReadonlyMap<string, Edition>;
  onEdit: () => void;
};

/* Croise le lot validé avec les demandes ouvertes : il n'existe pas encore en
   base, mais il a tout ce qu'il faut pour être croisé. */
function findMatches(values: ListingFormValues, city: City | null, openWantedListings: WantedListing[]): WantedMatch[] {
  if (!city) return [];
  const draft = {
    gameId: values.gameId,
    lotType: values.lotType,
    cardCount: values.cardCount,
    priceCents: toPriceCents(values.priceEuros),
    latitude: city.latitude,
    longitude: city.longitude,
  };
  return sortMatches(
    openWantedListings
      .map((wanted) => matchListingAgainstWanted(draft, wanted))
      .filter((match): match is WantedMatch => match !== null),
  );
}

export function ListingSummary({ published, photos, seller, now, openWantedListings, permalink, options, city, editions, onEdit }: ListingSummaryProps) {
  const { values, result } = published;
  const matches = findMatches(values, city, openWantedListings);
  const written = result.status === "saved" || result.status === "not-persisted" ? result.data : null;
  const path = written?.path ?? null;
  const matchAlert: MatchAlert = result.status !== "saved" ? "demo" : permalink === undefined ? "sent" : "edited";
  /* Décidé par le serveur, qui lit l'option sur l'annonce : sans elle, les
     photos au-delà de la troisième attendent le paiement. */
  const awaitingPayment = written?.photosAwaitingPayment ?? 0;
  const preview = buildPreviewListing(
    {
      ...values,
      ...options,
      cardCount: String(values.cardCount ?? ""),
      weightKg: String(values.weightKg ?? ""),
      priceEuros: String(values.priceEuros),
      openToTrade: values.openToTrade ? "on" : "",
      extraPhotos: values.extraPhotos ? "on" : "",
    },
    photos,
    seller,
    now,
    city,
    editions,
  );

  return (
    <PublishSummary
      subject="L'annonce"
      isSaved={result.status === "saved"}
      isEdit={permalink !== undefined}
      preview={<ListingCard listing={preview} now={Date.parse(now)} />}
      crossing={<MatchingWanted matches={matches.slice(0, 4)} totalCount={matches.length} subject="ce que vous décrivez" alert={matchAlert} />}
      title={values.title}
      description={values.description}
      permalinkUrl={permalink ?? `${SITE_URL}${path ?? ""}`}
      dashboardHref={routes.accountListings}
      dashboardLabel="Voir mes annonces"
      onEdit={onEdit}
      rows={[
        { label: "Jeu", value: GAME_LABELS[values.gameId] },
        { label: "Format", value: LOT_TYPE_LABELS[values.lotType] },
        /* Pas de note ici : ce récapitulatif est relu par le vendeur, qui sait
           très bien qu'il n'a pas compté. Le tiret seul suffit. */
        { label: "Nombre de cartes", value: formatCardCount(values.cardCount) },
        { label: "Poids", value: formatWeight(values.weightKg) },
        { label: "État", value: CONDITION_LABELS[values.condition] },
        { label: "Langue", value: LANGUAGE_LABELS[values.language] },
        {
          label: "Séries",
          value: values.editions.length === 0 ? UNKNOWN_VALUE : values.editions.map((id) => editions.get(id)?.code ?? id).join(", "),
        },
        {
          label: "Produits inclus",
          value: values.tags.length === 0 ? UNKNOWN_VALUE : values.tags.map((tag) => TAG_LABELS[tag]).join(", "),
        },
        { label: "Prix", value: formatPrice(toPriceCents(values.priceEuros)) },
        /* « Non » est une réponse du vendeur, pas une absence : pas de tiret. */
        {
          label: "Échange",
          value: values.openToTrade ? (values.tradeNote ? `Ouvert, contre ${values.tradeNote}` : "Ouvert") : "Non",
        },
        { label: "Rendez-vous", value: `${values.city} (${values.postalCode})` },
        {
          label: "Photos",
          value:
            awaitingPayment > 0
              ? `${values.photos.length}, dont ${awaitingPayment} en attente du paiement de l'option`
              : String(values.photos.length),
        },
        { label: "Visible par", value: AUDIENCE_LABELS[values.audience] },
        /* « Aucune » est une réponse — le vendeur n'en a pas choisi —, pas une
           information manquante : pas de tiret ici. */
        {
          label: "Options",
          value:
            [
              options.isFeatured ? "À la une" : null,
              options.isUrgent ? "Urgent" : null,
              options.isBumped ? "Remontée quotidienne" : null,
              values.extraPhotos ? `${MAX_PHOTOS} photos` : null,
            ]
              .filter(Boolean)
              .join(", ") || "Aucune",
        },
      ]}
    />
  );
}
