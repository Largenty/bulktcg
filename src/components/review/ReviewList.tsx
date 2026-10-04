import type { Review } from "@/types/review";
import { REVIEW_CRITERIA } from "@/types/review";
import { Avatar } from "@/components/ui/Avatar";
import { IntentLink } from "@/components/ui/IntentLink";
import { formatDate, formatRating } from "@/lib/format";
import { REVIEW_CRITERION_LABELS, REVIEW_ROLE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* Les avis reçus, comme vendeur et comme acheteur. Chacun dit ses trois
   notes : « 4,0 » ne disait pas si c'était le retard ou le lot. */
export function ReviewList({ reviews }: { reviews: Review[] }) {
  return (
    <ul className="grid list-none gap-3 md:grid-cols-2">
      {reviews.map((review) => (
        <ReviewItem key={review.id} review={review} />
      ))}
    </ul>
  );
}

function ReviewItem({ review }: { review: Review }) {
  return (
    <li className="panel flex flex-col gap-3">
      <ReviewContent review={review} />
    </li>
  );
}

/* Le contenu d'un avis, sans son conteneur : la liste du profil le range
   dans une grille, le récapitulatif d'une vente dans son propre panneau. */
export function ReviewContent({ review }: { review: Review }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {/* Un compte supprimé n'a plus de profil : ni lien, ni initiales. */}
        <Avatar initials={review.reviewerInitials ?? "—"} size="sm" />
        {review.reviewerUsername ? (
          <IntentLink href={routes.profile(review.reviewerUsername)} className="text-[length:var(--text-md)] font-semibold underline-offset-4 hover:underline">
            {review.reviewerUsername}
          </IntentLink>
        ) : (
          <span className="text-[length:var(--text-md)] font-semibold text-[var(--ink-soft)]">Compte supprimé</span>
        )}
        <span className="inline-flex items-center gap-1 text-[length:var(--text-sm)]">
          <span aria-hidden="true" className="text-[var(--pokemon)]">★</span>
          <span className="mono font-semibold">{formatRating(review.rating)}</span>
          <span className="sr-only"> sur 5</span>
        </span>
        <time dateTime={review.createdAt} className="mono ml-auto text-[length:var(--text-xs)] text-[var(--muted)]">
          {formatDate(review.createdAt)}
        </time>
      </div>

      <ul className="mono flex list-none flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-xs)] text-[var(--ink-soft)]">
        {REVIEW_CRITERIA.map((criterion) => (
          <li key={criterion}>
            {REVIEW_CRITERION_LABELS[criterion]} <b className="text-[var(--ink)]">{review.scores[criterion]}</b>/5
          </li>
        ))}
      </ul>

      {review.comment ? (
        <p className="text-[length:var(--text-lg)] leading-relaxed">{review.comment}</p>
      ) : (
        <p className="text-[length:var(--text-md)] italic text-[var(--muted)]">Notes laissées sans commentaire.</p>
      )}

      <p className="mono text-[length:var(--text-xs)] text-[var(--muted)]">
        En tant que {REVIEW_ROLE_LABELS[review.reviewedRole].toLowerCase()} ·{" "}
        {"slug" in review.listing ? (
          <>
            Sur :{" "}
            <IntentLink href={routes.listing(review.listing.slug)} className="underline underline-offset-4">
              {review.listing.title}
            </IntentLink>
          </>
        ) : review.listing.unavailable === "pro-only" ? (
          "sur un lot réservé aux professionnels"
        ) : (
          "sur un lot retiré depuis"
        )}
      </p>
    </>
  );
}
