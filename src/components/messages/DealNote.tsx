import Link from "next/link";
import type { ConversationDeal } from "@/types/deal";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";

type DealNoteProps = {
  deal: ConversationDeal;
  viewerId: string;
  isSeller: boolean;
  otherUsername: string;
};

/* Une ligne, pas un panneau : la vente se clôture depuis « Mes annonces »,
   pas au milieu du fil. Une fois clôturée, la conversation dit seulement ce
   qui s'est conclu, et où laisser son avis. */
export function DealNote({ deal, viewerId, isSeller, otherUsername }: DealNoteProps) {
  const hasReviewed = deal.reviewerIds.includes(viewerId);
  const outcome = deal.kind === "trade" ? "Échange conclu avec" : isSeller ? "Vendu à" : "Acheté à";

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t-[length:var(--border-width)] border-[var(--line)] pt-3 text-[length:var(--text-sm)]">
      <Icon name="check" size={15} strokeWidth={2.4} className="shrink-0" />
      <span className="min-w-0">
        {outcome} {otherUsername} le <time dateTime={deal.closedAt}>{formatDate(deal.closedAt)}</time>
      </span>
      <Link
        href={hasReviewed ? routes.deal(deal.id) : routes.dealReviews(deal.id)}
        className="font-semibold underline underline-offset-4"
      >
        {hasReviewed ? "Voir le récapitulatif" : `Noter ${otherUsername}`}
      </Link>
    </p>
  );
}
