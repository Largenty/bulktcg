import type { ReactNode } from "react";
import { ConversationList } from "@/components/messages/ConversationList";
import { MessagesShell } from "@/components/messages/MessagesShell";
import { getConversationsForUser } from "@/lib/data/conversations";
import { requireCurrentUserId } from "@/lib/data/session";
import { routes } from "@/lib/routes";

/* La messagerie garde sa liste d'une page à l'autre : ouvrir un fil ne
   recharge pas la colonne des conversations, comme dans toute messagerie. */
export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const userId = await requireCurrentUserId(routes.inbox);
  const conversations = await getConversationsForUser(userId);

  return (
    <div className="container pb-[var(--section-gap)] pt-6 lg:pt-10">
      <MessagesShell list={<ConversationList conversations={conversations} viewerId={userId} />}>{children}</MessagesShell>
    </div>
  );
}
