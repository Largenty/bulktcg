import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConversationHeader } from "@/components/messages/ConversationHeader";
import { DealNote } from "@/components/messages/DealNote";
import { MarkThreadRead } from "@/components/messages/MarkThreadRead";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { MessageThread } from "@/components/messages/MessageThread";
import { ProsOnlyNotice } from "@/components/messages/ProsOnlyNotice";
import { ReservedNotice } from "@/components/messages/ReservedNotice";
import { ListingImage } from "@/components/listing/ListingImage";
import { StatusBadge } from "@/components/listing/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { describeThreadState } from "@/lib/conversation-display";
import { formatPrice } from "@/lib/format";
import { getConversationById, getMessages } from "@/lib/data/conversations";
import { requireCurrentUserId } from "@/lib/data/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ conversationId: string }> };

/* Le volet de droite : avec qui, à propos de quel lot, puis le fil et la
   réponse. La vente se clôture depuis « Mes annonces » ; ici, une ligne dit
   seulement ce qui s'est conclu. */
export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params;
  /* La session est nécessaire avant la lecture : une conversation se lit du
     point de vue de quelqu'un. */
  const userId = await requireCurrentUserId(routes.conversation(conversationId));
  const conversation = await getConversationById(conversationId, userId);

  if (!conversation) notFound();
  if (conversation.buyer.id !== userId && conversation.seller.id !== userId) notFound();

  const messages = await getMessages(conversation.id);
  const other = conversation.buyer.id === userId ? conversation.seller : conversation.buyer;
  const { listing } = conversation;
  const isSeller = conversation.seller.id === userId;
  /* La même règle que la couche données et la base : réservé pour un autre,
     ou passé « pros » quand on n'est pas une boutique au forfait actif, le
     fil se relit sans se relancer. */
  const threadState = describeThreadState(conversation, userId);

  return (
    <div className="flex flex-col gap-5">
      <ConversationHeader other={other} conversationId={conversation.id} />

      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-3.5">
        <div className="flex items-center gap-4">
          <ListingImage
            gameId={listing.gameId}
            photo={{ id: listing.id, position: 0, seed: listing.photoSeed, url: listing.photoUrl }}
            alt=""
            ratio="1 / 1"
            sizes="64px"
            className="w-16 shrink-0 rounded-[var(--radius-md)]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[length:var(--text-body)] font-semibold">
              <Link href={routes.listing(listing.slug)} className="underline-offset-4 hover:underline">
                {listing.title}
              </Link>
            </p>
            <p className="price mt-1 text-[length:var(--number-sm)]">{formatPrice(listing.priceCents)}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={listing.status} />
            {listing.audience === "pros" ? <Badge>Réservée aux pros</Badge> : null}
          </div>
        </div>
        {threadState ? (
          <p className="border-t-[length:var(--border-width)] border-[var(--line)] pt-3 text-[length:var(--text-sm)] text-[var(--ink-soft)]">
            {threadState}
          </p>
        ) : null}
        {conversation.deal ? (
          <DealNote
            deal={conversation.deal}
            viewerId={userId}
            isSeller={isSeller}
            otherUsername={other.username}
          />
        ) : null}
      </div>

      <MessageThread messages={messages} viewerId={userId} />
      <MarkThreadRead conversationId={conversation.id} hasUnread={conversation.unreadCount > 0} />

      {conversation.replyBlock === "reserved-for-other" ? (
        <ReservedNotice listingId={listing.id} viewerId={userId} />
      ) : conversation.replyBlock === "pros-only" ? (
        <ProsOnlyNotice gameId={listing.gameId} />
      ) : (
        <MessageComposer conversationId={conversation.id} recipientUsername={other.username} />
      )}
    </div>
  );
}
