import Link from "next/link";
import type { Deal } from "@/types/deal";
import { ListingImage } from "@/components/listing/ListingImage";
import { ButtonLink } from "@/components/ui/Button";
import { ProBadge } from "@/components/pro/ProBadge";
import { describeDeal, getDealPerspective } from "@/lib/deal-display";
import { formatDate, formatPrice, formatRating } from "@/lib/format";
import { DEAL_KIND_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* Une vente ou un achat conclu, sur une ligne : le lot, avec qui, quand, et
   où en sont les avis. Le geste attendu — noter — passe devant le reste. */
export function DealListRow({ deal, viewerId }: { deal: Deal; viewerId: string }) {
  const perspective = getDealPerspective(deal, viewerId);
  const { other, myReview, theirReview } = perspective;
  const href = routes.deal(deal.id);

  return (
    <li className="grid gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-4 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
      <ListingImage
        gameId={deal.listing.gameId}
        photo={{ id: deal.listing.id, position: 0, seed: deal.listing.photoSeed, url: deal.listing.photoUrl }}
        alt=""
        ratio="1 / 1"
        sizes="64px"
        className="hidden w-16 rounded-[var(--radius-md)] sm:block"
      />
      <div className="min-w-0">
        <p className="label text-[var(--muted)]">
          {perspective.isSeller ? DEAL_KIND_LABELS[deal.kind] : deal.kind === "trade" ? "Échange" : "Achat"} ·{" "}
          <time dateTime={deal.closedAt}>{formatDate(deal.closedAt)}</time>
        </p>
        <h3 className="mt-1 truncate text-[length:var(--text-body)] font-semibold">
          <Link href={href} className="underline-offset-4 hover:underline">
            {deal.listing.title}
          </Link>
        </h3>
        <p className="mono mt-1 flex flex-wrap items-center gap-x-2 text-[length:var(--text-xs)] text-[var(--muted)]">
          <span>{describeDeal(deal, perspective)}</span>
          {other.isPro ? <ProBadge /> : null}
          {deal.kind === "sale" ? <span>· {formatPrice(deal.listing.priceCents)}</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
        <p className="text-[length:var(--text-sm)] text-[var(--ink-soft)]">
          {theirReview ? (
            <>
              Son avis : <span aria-hidden="true" className="text-[var(--pokemon)]">★</span>{" "}
              <b className="mono text-[var(--ink)]">{formatRating(theirReview.rating)}</b>
            </>
          ) : (
            "Pas encore son avis"
          )}
        </p>
        {myReview ? (
          <ButtonLink href={href} variant="secondary" size="sm">
            Récapitulatif<span className="sr-only"> de {deal.listing.title}</span>
          </ButtonLink>
        ) : (
          <ButtonLink href={routes.dealReviews(deal.id)} size="sm">
            Noter {other.username}
          </ButtonLink>
        )}
      </div>
    </li>
  );
}
