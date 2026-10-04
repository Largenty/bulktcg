import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DealTimeline } from "@/components/deal/DealTimeline";
import { ReportLink } from "@/components/report/ReportLink";
import { ReviewForm } from "@/components/review/ReviewForm";
import { ReviewContent } from "@/components/review/ReviewList";
import { DefinitionList } from "@/components/ui/DefinitionList";
import { Icon } from "@/components/ui/Icon";
import { getConversationById } from "@/lib/data/conversations";
import { getDealById } from "@/lib/data/deals";
import { requireCurrentUserId } from "@/lib/data/session";
import { describeDeal, getDealPerspective } from "@/lib/deal-display";
import { formatDate, formatPrice } from "@/lib/format";
import { DEAL_KIND_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { REVIEWS_ANCHOR, routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Récapitulatif", robots: { index: false, follow: false } };

type PageProps = { params: Promise<{ id: string }> };

/* Le récapitulatif d'une vente ou d'un échange, lu par ses deux parties
   seulement : le lot, avec qui, les étapes, et les deux avis. C'est ici
   qu'on note l'autre. Une vente dont on n'est pas partie répond 404. */
export default async function DealRecapPage({ params }: PageProps) {
  const { id } = await params;
  const userId = await requireCurrentUserId(routes.deal(id));
  const deal = await getDealById(id, userId);
  if (!deal) notFound();

  const perspective = getDealPerspective(deal, userId);
  const { other, myReview, theirReview } = perspective;
  const conversation = await getConversationById(deal.conversationId, userId);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href={routes.accountDeals} className="inline-flex items-center gap-1.5 text-[length:var(--text-sm)] font-semibold">
          <Icon name="arrowLeft" size={15} />
          Ventes et achats
        </Link>
        <p className="label mt-5 text-[var(--muted)]">Récapitulatif · {DEAL_KIND_LABELS[deal.kind]}</p>
        <h2 className="display display-h3 mt-1.5">{deal.listing.title}</h2>
        <p className="mt-1.5 text-[length:var(--text-md)] text-[var(--ink-soft)]">
          {describeDeal(deal, perspective)} le <time dateTime={deal.closedAt}>{formatDate(deal.closedAt)}</time>.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <DefinitionList
          rows={[
            { label: "Nature", value: DEAL_KIND_LABELS[deal.kind] },
            { label: "Prix affiché", value: formatPrice(deal.listing.priceCents) },
            { label: "Vendeur", value: deal.seller.username },
            { label: "Acheteur", value: deal.buyer.username },
            { label: "Conclu le", value: formatDate(deal.closedAt), dateTime: deal.closedAt },
            { label: "Conversation", value: conversation ? "Toujours ouverte" : UNKNOWN_VALUE },
          ]}
          columns={2}
          isCompact
        />
        <DealTimeline deal={deal} perspective={perspective} />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--text-sm)] font-semibold">
        <Link href={routes.listing(deal.listing.slug)} className="underline underline-offset-4">Voir l&apos;annonce</Link>
        {conversation ? (
          <Link href={routes.conversation(conversation.id)} className="underline underline-offset-4">Voir la conversation</Link>
        ) : null}
        <Link href={routes.profile(other.username)} className="underline underline-offset-4">Profil de {other.username}</Link>
        {conversation ? <ReportLink target="conversation" targetKey={conversation.id} /> : null}
      </div>

      <section id={REVIEWS_ANCHOR} aria-labelledby="avis-titre" className="scroll-mt-24">
        <h3 id="avis-titre" className="display display-h3">Avis</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="panel flex flex-col gap-4">
            <h4 className="label text-[var(--muted)]">Votre avis sur {other.username}</h4>
            {myReview ? (
              <ReviewContent review={myReview} />
            ) : (
              <ReviewForm dealId={deal.id} revieweeUsername={other.username} revieweeRole={perspective.isSeller ? "buyer" : "seller"} />
            )}
          </div>
          <div className="panel flex flex-col gap-4">
            <h4 className="label text-[var(--muted)]">L&apos;avis de {other.username} sur vous</h4>
            {theirReview ? (
              <ReviewContent review={theirReview} />
            ) : (
              <p className="text-[length:var(--text-md)] text-[var(--ink-soft)]">
                {other.username} n&apos;a pas encore laissé son avis. Chacun note l&apos;autre de son côté : le sien ne dépend
                pas du vôtre.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
