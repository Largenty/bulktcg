import type { Listing } from "@/types/listing";
import { GameBadge } from "@/components/listing/GameBadge";
import { ListingFacts } from "@/components/listing/ListingFacts";
import { ListingSector } from "@/components/listing/ListingSector";
import { StatusBadge } from "@/components/listing/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatPrice, formatRelativeTime, getDropPercent } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { hasPriceDrop, isListingFeatured, isListingUrgent } from "@/lib/listing-display";
import { isExpired } from "@/lib/listing-lifecycle";

/* Badges, titre, métadonnées, prix et faits : le bloc que l'acheteur lit en
   premier, et le premier sous la photo sur téléphone. Le statut est
   toujours écrit, « Disponible » compris : c'est la question que pose chaque
   acheteur, et la raison d'être du lien permanent. Combien, dans quel état,
   dans quelle langue : les trois faits de la vignette suivent le prix — ils
   n'arrivaient qu'après la galerie et la liste des séries. */
export function ListingHeadline({ listing }: { listing: Listing }) {
  const now = Date.now();
  const dropPercent =
    hasPriceDrop(listing) && listing.previousPriceCents !== null
      ? getDropPercent(listing.priceCents, listing.previousPriceCents)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <GameBadge gameId={listing.gameId} size="md" />
        <StatusBadge status={isExpired(listing, now) ? "expired" : listing.status} />
        {isListingFeatured(listing, now) ? <span className="seal">À la une</span> : null}
        {isListingUrgent(listing, now) ? <span className="urgent-flag">Urgent</span> : null}
        {dropPercent !== null ? <Badge tone="ink">Baisse de {dropPercent} %</Badge> : null}
      </div>

      <h1 className="display text-[length:var(--text-h3)] sm:text-[length:var(--text-2xl)]">{listing.title}</h1>

      {/* Un div et non un p : le lieu ouvre la carte de son secteur, dont le
          popover est un div, qu'un paragraphe ne peut pas contenir. */}
      <div className="text-[length:var(--text-md)] text-[var(--muted)]">
        <ListingSector city={listing.city} postalCode={listing.postalCode} gameId={listing.gameId} /> · déposée{" "}
        <time dateTime={listing.createdAt}>{formatRelativeTime(listing.createdAt, now)}</time> · {countLabel(listing.viewCount, "vue")}
      </div>

      <p className="flex flex-wrap items-baseline gap-3">
        <span className="price text-[length:var(--number-3xl)] font-bold leading-none">
          {formatPrice(listing.priceCents)}
        </span>
        {dropPercent !== null && listing.previousPriceCents !== null ? (
          <span className="price text-[length:var(--number-sm)] text-[var(--muted)] line-through">
            {formatPrice(listing.previousPriceCents)}
          </span>
        ) : null}
      </p>

      <ListingFacts listing={listing} className="lot-facts text-[length:var(--text-md)]" />

      {listing.openToTrade ? (
        <p className="flex items-start gap-2.5 text-[length:var(--text-md)] leading-snug">
          <Icon name="swap" size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">Ouvert à l&apos;échange</strong>
            {listing.tradeNote
              ? ` — contre ${listing.tradeNote}. Le prix donne la valeur de référence.`
              : " : le vendeur accepte aussi des cartes contre ce lot. Le prix donne la valeur de référence."}
          </span>
        </p>
      ) : null}
    </div>
  );
}
