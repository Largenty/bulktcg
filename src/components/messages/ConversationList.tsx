import type { Conversation } from "@/types/conversation";
import { ConversationLink } from "@/components/messages/ConversationLink";
import { InboxHeading } from "@/components/messages/InboxHeading";
import { ListingImage } from "@/components/listing/ListingImage";
import { StatusBadge } from "@/components/listing/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatAge } from "@/lib/format";
import { countInbox, describeReservation } from "@/lib/conversation-display";
import { countLabel } from "@/lib/french";
import { routes } from "@/lib/routes";

/* Le volet de gauche : toutes les conversations, la plus récente en tête,
   les non lues sur fond d'avis. */
export function ConversationList({ conversations, viewerId }: { conversations: Conversation[]; viewerId: string }) {
  const { awaiting, unreadLocked } = countInbox(conversations);
  const now = Date.now();
  const summary =
    [
      awaiting > 0 ? `${countLabel(awaiting, "conversation")} ${awaiting > 1 ? "attendent" : "attend"} votre réponse.` : null,
      unreadLocked > 0 ? `${countLabel(unreadLocked, "message non lu", "messages non lus")} sur un lot réservé à d'autres.` : null,
    ]
      .filter(Boolean)
      .join(" ") || "Tout est à jour.";

  return (
    <section>
      <InboxHeading summary={summary} />
      {conversations.length === 0 ? (
        <EmptyState
          title="Aucune conversation"
          reason="Personne ne vous a encore écrit, et vous n'avez contacté aucun vendeur. Une conversation s'ouvre depuis la fiche d'un lot."
          action={<ButtonLink href={routes.listings}>Parcourir les annonces</ButtonLink>}
        />
      ) : (
        <ul className="flex list-none flex-col overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)]">
          {conversations.map((conversation) => {
            const other = conversation.buyer.id === viewerId ? conversation.seller : conversation.buyer;
            const isUnread = conversation.unreadCount > 0;
            return (
              <li key={conversation.id} className="border-b-[length:var(--border-width)] border-[var(--line)] last:border-b-0">
                <ConversationLink conversationId={conversation.id} isUnread={isUnread}>
                  <ListingImage
                    gameId={conversation.listing.gameId}
                    photo={{ id: conversation.listing.id, position: 0, seed: conversation.listing.photoSeed, url: conversation.listing.photoUrl }}
                    alt=""
                    ratio="1 / 1"
                    sizes="48px"
                    className="w-12 shrink-0 rounded-[var(--radius-sm)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[length:var(--text-md)] ${isUnread ? "font-bold" : "font-semibold"}`}>{other.username}</p>
                    <p className={`mt-0.5 truncate text-[length:var(--text-sm)] ${isUnread ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}>
                      {conversation.lastMessage?.body ?? "Conversation ouverte, aucun message."}
                    </p>
                    {/* Le statut vit sur la ligne du lot, dont il parle : sur celle du
                        pseudo, « Réservé pour ce contact » effaçait le pseudo. */}
                    <p className="mt-1 flex min-w-0 items-center gap-2">
                      {conversation.listing.status !== "available" ? (
                        <span className="shrink-0">
                          <StatusBadge
                            status={conversation.listing.status}
                            label={describeReservation(conversation, viewerId) ?? undefined}
                          />
                        </span>
                      ) : null}
                      <span className="mono min-w-0 truncate text-[length:var(--text-xs)] text-[var(--muted)]">{conversation.listing.title}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <time dateTime={conversation.lastMessageAt} className="mono text-[length:var(--text-xs)] text-[var(--muted)]">
                      {formatAge(conversation.lastMessageAt, now)}
                    </time>
                    {isUnread ? (
                      <span className="mono grid h-6 min-w-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--ink)] px-1.5 text-[length:var(--text-xs)] font-bold text-[var(--on-ink)]">
                        {conversation.unreadCount}
                        <span className="sr-only"> messages non lus</span>
                      </span>
                    ) : null}
                  </div>
                </ConversationLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
