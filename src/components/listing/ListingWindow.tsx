import Image from "next/image";
import type { ListingCardData } from "@/types/listing";
import { PhotoBlock } from "@/components/listing/PhotoBlock";
import { Icon } from "@/components/ui/Icon";
import { formatCount, formatRating } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/labels";
import { hashString } from "@/lib/random";
import { buildWatermarkLabel } from "@/lib/watermark";

type ListingWindowProps = {
  listing: ListingCardData;
  isFeatured: boolean;
  isUrgent: boolean;
  dropPercent: number | null;
  isPriority: boolean;
};

/* La fenêtre du boîtier : la photo en retrait, et ce qui se pose dessus — le
   sceau holographique de la mise en avant, la baisse de prix, l'onglet des
   annonces réservées aux pros, le tampon d'état, et la ligne de crédit.

   Sans photo, l'emplacement neutre dit « Sans photo » en toutes lettres :
   sans la mention, on attend une image qui ne viendra pas. La ligne de
   crédit garde alors le pseudo, mais pas la classe watermark : le filigrane
   marque une photo contre la reprise, posé sur un emplacement vide il ne
   protégerait rien. */
export function ListingWindow({ listing, isFeatured, isUrgent, dropPercent, isPriority }: ListingWindowProps) {
  const photo = listing.photos[0];
  const hasPhoto = Boolean(photo?.url);
  const { seller } = listing;

  return (
    <div className="lot-window">
      <PhotoBlock gameId={listing.gameId} seed={photo?.seed ?? hashString(listing.title || listing.gameId || listing.id)} className="absolute inset-0" />
      {photo?.url ? (
        <Image
          src={photo.url}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 104px, (max-width: 1100px) 45vw, 320px"
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : undefined}
          className="object-cover"
        />
      ) : (
        <span className="label lot-window-empty">Sans photo</span>
      )}
      <span aria-hidden="true" className="lot-gloss" />

      {isFeatured ? <span className="seal lot-window-seal">À la une</span> : null}
      {/* En haut à droite, l'un sous l'autre : « Urgent », puis la baisse. */}
      {isUrgent || dropPercent !== null ? (
        <span className="lot-window-flags">
          {isUrgent ? <span className="urgent-flag">Urgent</span> : null}
          {dropPercent !== null ? (
            <span className="price price-chip lot-window-drop">
              −{dropPercent} %<span className="sr-only"> de baisse</span>
            </span>
          ) : null}
        </span>
      ) : null}
      {listing.audience === "pros" ? (
        <span className="label lot-window-pro">
          <Icon name="lock" size={13} />
          Réservée aux pros
        </span>
      ) : null}
      {listing.status !== "available" ? (
        <span className={`stamp lot-window-stamp ${listing.status === "sold" ? "stamp-sold" : "stamp-reserved"}`}>
          {STATUS_LABELS[listing.status]}
        </span>
      ) : null}

      {/* Le vendeur et sa note sont lus plus loin, en toutes lettres : la
          ligne de crédit n'est que leur version imprimée. */}
      <p aria-hidden="true" className="credit">
        <span className={hasPhoto ? "watermark" : "min-w-0 overflow-hidden text-ellipsis"}>
          {buildWatermarkLabel(listing, { isCompact: true })}
        </span>
        {seller.isPro ? <span className="credit-pro">PRO</span> : null}
        <span className="credit-rating">
          {seller.ratingAvg === null || seller.ratingCount === 0 ? (
            "Pas encore d'avis"
          ) : (
            <>
              <span className="text-[var(--pokemon)]">★</span> <b>{formatRating(seller.ratingAvg)}</b> ({formatCount(seller.ratingCount)})
            </>
          )}
        </span>
      </p>
    </div>
  );
}
