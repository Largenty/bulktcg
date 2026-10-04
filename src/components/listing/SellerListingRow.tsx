import Link from "next/link";
import type { Deal } from "@/types/deal";
import type { Listing } from "@/types/listing";
import { removeListing } from "@/app/actions/listings";
import { ItemActions } from "@/components/account/ItemActions";
import type { BuyerCandidate } from "@/components/account/BuyerChoices";
import { ListingLifecycleNote } from "@/components/account/ListingLifecycleNote";
import { ListingStatusSwitcher } from "@/components/account/ListingStatusSwitcher";
import { DealNote } from "@/components/messages/DealNote";
import { ListingImage } from "@/components/listing/ListingImage";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatPrice, formatRelativeTime } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { isListingFeatured, isListingUrgent } from "@/lib/listing-display";
import { isArchived, isExpired } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

type SellerListingRowProps = {
  listing: Listing;
  /* Compté par la page, en un seul passage sur les demandes ouvertes. */
  matchCount: number;
  /* Ceux qui ont écrit à propos du lot : « Vendu » demande lequel. */
  buyers: BuyerCandidate[];
  /* La vente clôturée sur ce lot, s'il y en a une. */
  deal: Deal | null;
  /* Combien attendent que la réservation tombe : un nombre, jamais des noms. */
  waitlistCount: number;
};

/* Une annonce, vue de son vendeur : où elle en est, qui la cherche, et les
   gestes qui la font vivre. Le statut se change ici en un clic, par la même
   action serveur que sur la fiche.

   Composant serveur : « déposée il y a 3 heures » et « À la une » dépendent
   de l'heure. Rendus côté client, ils étaient calculés une fois au build et
   une fois à l'hydratation, et le texte ne concordait plus (React #418). */
export function SellerListingRow({ listing, matchCount, buyers, deal, waitlistCount }: SellerListingRowProps) {
  const reservedFor = buyers.find((buyer) => buyer.userId === listing.reservedForId)?.username ?? null;
  const shareUrl = `${SITE_URL}${routes.listing(listing.slug)}`;
  const now = Date.now();
  /* Expirée, elle n'a plus de statut à changer : la remettre en ligne est le
     seul geste, et il est dans la note du cycle de vie. Archivée, ses photos
     ne se montrent plus, même avant le passage de la tâche qui les retire. */
  const hasExpired = isExpired(listing, now);
  const isOffMarket = hasExpired || listing.status === "sold";

  return (
    <li className="grid gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-4 sm:grid-cols-[112px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)_auto] lg:items-start">
      <ListingImage
        gameId={listing.gameId}
        photo={isArchived(listing, now) ? undefined : listing.photos[0]}
        alt=""
        ratio="1 / 1"
        sizes="112px"
        isFaded={isOffMarket}
        className="hidden rounded-[var(--radius-md)] sm:block"
      />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[length:var(--text-body)] font-semibold leading-snug">
            <Link href={routes.listing(listing.slug)} className="underline-offset-4 hover:underline">
              {listing.title}
            </Link>
          </h3>
          {isListingFeatured(listing, now) ? <span className="seal">À la une</span> : null}
          {isListingUrgent(listing, now) ? <span className="urgent-flag">Urgent</span> : null}
          {/* Le vendeur doit voir d'un coup d'œil qu'un lien partagé de ce lot
              répondra « introuvable » aux particuliers. */}
          {listing.audience === "pros" ? <Badge>Réservée aux pros</Badge> : null}
        </div>
        <p className="mono mt-1.5 text-[length:var(--text-xs)] text-[var(--muted)]">
          {formatPrice(listing.priceCents)} · {listing.city} · déposée{" "}
          <time dateTime={listing.createdAt}>{formatRelativeTime(listing.createdAt, now)}</time> ·{" "}
          {countLabel(listing.viewCount, "vue")}
        </p>
        {matchCount > 0 && !isOffMarket ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-3 py-1 text-[length:var(--text-sm)] font-semibold text-[var(--on-ink)]">
            <Icon name="sparkle" size={15} />
            {countLabel(matchCount, "recherche")} {matchCount > 1 ? "correspondent" : "correspond"}
          </p>
        ) : null}

        <div className="mt-4">
          {/* Une vente clôturée ne se défait pas : plus de sélecteur, une
              ligne qui dit à qui, et où noter. */}
          {deal ? (
            <DealNote deal={deal} viewerId={listing.seller.id} isSeller otherUsername={deal.buyer.username} />
          ) : hasExpired ? null : (
            <ListingStatusSwitcher listingId={listing.id} title={listing.title} status={listing.status} buyers={buyers} />
          )}
          {listing.status === "reserved" && !hasExpired ? (
            <p className="mt-2 text-[length:var(--text-sm)] text-[var(--ink-soft)]">
              {reservedFor ? `Réservé pour ${reservedFor}` : "Réservé hors du site"} ·{" "}
              {waitlistCount > 0
                ? `${countLabel(waitlistCount, "personne attend", "personnes attendent")} si la réservation tombe`
                : "personne n'attend pour l'instant"}
            </p>
          ) : null}
          <div className="mt-3">
            <ListingLifecycleNote listing={listing} now={now} />
          </div>
        </div>
      </div>

      <div className="sm:col-span-2 lg:col-span-1 lg:w-[260px]">
        <ItemActions
          shareUrl={shareUrl}
          editHref={deal ? undefined : routes.editListing(listing.slug)}
          itemName={listing.title}
          onDeleteAction={deal ? undefined : removeListing.bind(null, listing.id)}
          deleteConsequence={
            deal
              ? undefined
              : "Le lien permanent cessera de répondre, et les acheteurs qui l'ont enregistré tomberont sur une page introuvable. Si le lot est parti, passez-le plutôt en « Vendu » : la page reste servie, et désigner l'acheteur ouvre les avis."
          }
        />
      </div>
    </li>
  );
}
