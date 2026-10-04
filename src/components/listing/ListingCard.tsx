import type { ListingCardData } from "@/types/listing";
import { ListingFacts } from "@/components/listing/ListingFacts";
import { ListingTagStrip } from "@/components/listing/ListingTags";
import { ListingWindow } from "@/components/listing/ListingWindow";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { formatAge, formatCount, formatDistance, formatPrice, formatRating, getDropPercent } from "@/lib/format";
import { gameColorVariable } from "@/lib/game-style";
import { GAME_LABELS, LOT_TYPE_LABELS } from "@/lib/labels";
import { hasPriceDrop, isListingFeatured, isListingUrgent } from "@/lib/listing-display";
import { isBumped } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";

type ListingCardProps = {
  /* Une annonce publiée, ou le brouillon de l'aperçu de dépôt : jeu, format,
     état et langue peuvent alors manquer, et s'affichent en emplacements
     vides. */
  listing: ListingCardData;
  /* Précharge la photo : réservé aux premières vignettes de la grille. */
  isPriority?: boolean;
  /* Renseignée seulement quand l'acheteur a indiqué une ville : sans point
     d'origine il n'y a pas de distance, et on n'en invente pas. */
  distanceKm?: number | null;
  /* Aperçu de dépôt seulement : tant que le prix n'est pas saisi, la
     vignette affiche « — » plutôt qu'un « 0 € » qui serait faux. */
  priceLabel?: string;
  /* L'instant de « il y a 3 h » et des options qui expirent : Date.now() dans
     une grille rendue par le serveur, l'instant figé de la page dans un
     aperçu client. Lu ici, il divergeait entre le build et l'hydratation. */
  now: number;
};

/* La vignette d'un lot, présentée comme une carte gradée : une étiquette
   dans un boîtier, qui dit exactement ce qu'il contient. En tête, la ligne
   de type — le jeu et le format — et le coût, le prix en pavé d'encre ; puis
   le titre, la fenêtre de la photo, les faits, les séries, et le pied : où,
   à quelle distance, depuis quand.

   Le DOM suit l'ordre d'un lecteur d'écran — titre, prix, type, faits,
   lieu, vendeur — et styles/base/lot.css (.lot) le range dans l'ordre
   d'une carte, verticale en grand écran, horizontale sur téléphone. */
export function ListingCard({ listing, isPriority = false, distanceKm = null, priceLabel, now }: ListingCardProps) {
  const isFeatured = isListingFeatured(listing, now);
  const isUrgent = isListingUrgent(listing, now);
  const dropPercent =
    hasPriceDrop(listing) && listing.previousPriceCents !== null
      ? getDropPercent(listing.priceCents, listing.previousPriceCents)
      : null;
  const { seller } = listing;

  return (
    <article
      className={["card lot", isFeatured ? "lot-featured" : "", listing.status === "sold" ? "lot-sold" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {/* La fiche ne se précharge qu'à l'intention : une grille de dix-huit
          vignettes téléchargeait dix-huit fiches à mesure qu'on défilait. */}
      <h3 className="lot-title">
        <IntentLink href={routes.listing(listing.slug)}>{listing.title}</IntentLink>
      </h3>

      <p className="lot-price price price-chip">{priceLabel ?? formatPrice(listing.priceCents)}</p>

      {/* Le jeu, puis le format : sur une ligne dans la vignette horizontale du
          téléphone, sur deux en grand écran — la tête de chaque vignette a
          alors la même hauteur, et les titres d'une rangée s'alignent. */}
      <p className="lot-type label">
        {listing.gameId ? (
          <span aria-hidden="true" className="lot-mark" style={{ backgroundColor: gameColorVariable(listing.gameId) }} />
        ) : (
          <span aria-hidden="true" className="lot-mark lot-mark-empty" />
        )}
        <span className="lot-type-text">
          <span>{listing.gameId ? GAME_LABELS[listing.gameId] : <span className="lot-gap">Jeu ?</span>}</span>
          <span className="lot-type-separator"> — </span>
          <span className="lot-type-format">
            {listing.lotType ? LOT_TYPE_LABELS[listing.lotType] : <span className="lot-gap">Format ?</span>}
          </span>
        </span>
        {/* Sur téléphone, « Urgent » vit dans la ligne de type : la miniature
            de 104 px porte déjà le sceau et le prix. */}
        {isUrgent ? <span className="urgent-flag lot-type-urgent">Urgent</span> : null}
      </p>

      <ListingWindow listing={listing} isFeatured={isFeatured} isUrgent={isUrgent} dropPercent={dropPercent} isPriority={isPriority} />

      <ListingFacts listing={listing} className="lot-facts" />
      <ListingTagStrip listing={listing} className="lot-sets" />

      {/* Chaque segment est insécable, le séparateur accroché au précédent :
          un retour à la ligne ne tombe jamais au milieu d'une valeur. */}
      <p className="lot-foot mono">
        <span>
          {listing.city}
          {distanceKm !== null ? (
            <>
              {" · "}
              <b>à {formatDistance(distanceKm)}</b>
            </>
          ) : null}
        </span>{" "}
        {/* Une condition de la vente, entre le lieu et l'âge : lisible d'un
            coup d'œil sans entrer dans les faits, qui décrivent le lot. */}
        {listing.openToTrade ? (
          <>
            <span className="lot-trade">
              <Icon name="swap" size={12} strokeWidth={2.4} />
              Échange<span className="sr-only"> possible</span>
            </span>{" "}
          </>
        ) : null}
        {/* Un rang acheté se signale : la mise à la une a son sceau, la
            remontée sa mention, à côté de la date de dépôt qu'elle ne
            change pas. */}
        {isBumped(listing, now) ? (
          <>
            <span className="lot-trade">
              <Icon name="arrowUp" size={12} strokeWidth={2.4} />
              Remontée<span className="sr-only"> par son vendeur, option payante</span>
            </span>{" "}
          </>
        ) : null}
        <span>
          {dropPercent !== null && listing.previousPriceCents !== null ? (
            <>
              <s>
                <span className="sr-only">Au lieu de </span>
                {formatPrice(listing.previousPriceCents)}
              </s>
              {" · "}
            </>
          ) : null}
          <time dateTime={listing.createdAt}>{formatAge(listing.createdAt, now)}</time>
        </span>
      </p>

      <p className="sr-only" data-seller={seller.username}>
        Proposé par {seller.username}
        {seller.isPro ? ", vendeur professionnel" : ""},{" "}
        {seller.ratingAvg === null || seller.ratingCount === 0
          ? "pas encore d'avis"
          : `note de ${formatRating(seller.ratingAvg)} sur 5, ${formatCount(seller.ratingCount)} avis`}
      </p>
    </article>
  );
}
