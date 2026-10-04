import type { WantedCardData } from "@/types/wanted";
import { WantedStatusBadge } from "@/components/wanted/WantedStatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { ProBadge } from "@/components/pro/ProBadge";
import { formatAge, formatCardCount, formatCount, formatDistance, formatPrice, formatRating } from "@/lib/format";
import { fromCity } from "@/lib/french";
import { gameColorVariable } from "@/lib/game-style";
import { GAME_LABELS, LOT_TYPE_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { routes } from "@/lib/routes";

type WantedCardProps = {
  /* Une demande publiée, ou celle qu'on est en train d'écrire : le jeu peut
     alors manquer, et s'affiche en emplacement vide. */
  wanted: WantedCardData;
  /* Distance entre l'acheteur et le point d'origine saisi, calculée par la
     page. Sans ville saisie il n'y a pas de distance, et on n'en invente pas. */
  distanceKm?: number | null;
  /* L'instant de « il y a 3 h » : Date.now() dans une grille rendue par le
     serveur, l'instant figé de la page dans l'aperçu du dépôt. */
  now: number;
};

/* Une demande de recherche est de la même famille que la vignette d'un lot,
   et ne lui ressemble pourtant pas : pas de photo ni de cadre d'encre, un
   filet à la couleur du jeu en tête, la loupe à la place du carré de jeu, et
   le budget en pavé contour là où un lot porte son prix en pavé plein — un
   plafond, pas un prix. Dessous, une fiche courte : ce qu'on cherche, combien,
   jusqu'où l'acheteur se déplace. Un acheteur qui parcourt les lots voit au
   premier coup d'œil que ceci n'en est pas un. */
export function WantedCard({ wanted, distanceKm = null, now }: WantedCardProps) {
  const { buyer } = wanted;

  return (
    <article className={`card want ${wanted.status !== "open" ? "want-closed" : ""}`}>
      {wanted.gameId ? (
        <span aria-hidden="true" className="want-band" style={{ backgroundColor: gameColorVariable(wanted.gameId) }} />
      ) : (
        <span aria-hidden="true" className="want-band want-band-empty" />
      )}

      <h3 className="want-title">
        <IntentLink href={routes.wanted(wanted.slug)}>{wanted.title}</IntentLink>
      </h3>

      <p className="want-budget price price-chip-outline">
        <span className="sr-only">Budget maximum : </span>
        {wanted.maxPriceCents === null ? UNKNOWN_VALUE : `≤ ${formatPrice(wanted.maxPriceCents)}`}
      </p>

      {/* Comme la tête d'un lot : sur une ligne sur téléphone, sur deux en
          grand écran, pour que les titres d'une rangée s'alignent. */}
      <p className="want-type label">
        <Icon name="search" size={14} strokeWidth={2.4} className="shrink-0" />
        <span className="lot-type-text">
          <span>Recherche</span>
          <span className="lot-type-separator"> · </span>
          <span className="lot-type-format">
            {wanted.gameId ? GAME_LABELS[wanted.gameId] : <span className="lot-gap">Jeu ?</span>}
          </span>
        </span>
      </p>

      <dl className="want-specs">
        <dt>Format</dt>
        <dd>{wanted.lotType === null ? "Tout format" : LOT_TYPE_LABELS[wanted.lotType]}</dd>
        <dt>Volume</dt>
        <dd>{wanted.minCardCount === null ? "Tout volume" : `≥ ${formatCardCount(wanted.minCardCount)}`}</dd>
        <dt>Rayon</dt>
        <dd>
          {wanted.maxDistanceKm} km autour {fromCity(wanted.city)}
          {distanceKm !== null ? <b> · à {formatDistance(distanceKm)} de vous</b> : null}
        </dd>
      </dl>

      <div className="want-foot">
        <Avatar initials={buyer.avatarInitials} size="sm" />
        <span className="min-w-0 truncate font-semibold text-[var(--ink)]">{buyer.username}</span>
        {buyer.isPro ? <ProBadge /> : null}
        <span className="shrink-0">
          {buyer.ratingAvg === null || buyer.ratingCount === 0 ? (
            <span className="sr-only">, pas encore d&apos;avis</span>
          ) : (
            <>
              <span aria-hidden="true" className="text-[var(--pokemon)]">★</span>{" "}
              <span className="sr-only">note de </span>
              {formatRating(buyer.ratingAvg)}
              <span className="sr-only"> sur 5, {formatCount(buyer.ratingCount)} avis</span>
            </>
          )}
        </span>
        <span className="ml-auto shrink-0">
          {wanted.status !== "open" ? (
            <WantedStatusBadge status={wanted.status} />
          ) : (
            <time dateTime={wanted.createdAt}>{formatAge(wanted.createdAt, now)}</time>
          )}
        </span>
      </div>
    </article>
  );
}
