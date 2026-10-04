import "server-only";
import type { Conversation } from "@/types/conversation";
import { getConversationById } from "@/lib/data/conversations";
import { toBlockInsert } from "@/lib/data/mappers";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getCurrentUserId } from "@/lib/data/session";
import { performWrite } from "@/lib/data/write-seam";

/* Les gestes posés sur une conversation : la retirer de sa boîte, et
   bloquer l'autre partie. Chacun part de la conversation et non d'un
   identifiant fourni par le navigateur : on ne bloque que quelqu'un avec
   qui l'on a parlé. */

type Participation = { userId: string; conversation: Conversation; isSeller: boolean };

async function participation(conversationId: string): Promise<Participation | MutationResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };
  const conversation = await getConversationById(conversationId, userId);
  if (!conversation || (conversation.buyer.id !== userId && conversation.seller.id !== userId)) {
    return { status: "not-found" };
  }
  return { userId, conversation, isSeller: conversation.seller.id === userId };
}

function isRefused(value: Participation | MutationResult<null>): value is MutationResult<null> {
  return "status" in value;
}

/* Ne la retire que de sa propre boîte : l'autre partie garde son fil.
   hide_conversation ne date que le retrait de l'appelant. */
export async function hideConversation(conversationId: string): Promise<MutationResult<null>> {
  const found = await participation(conversationId);
  if (isRefused(found)) return found;
  const conversation = found.conversation.id;
  return performWrite("conversations.delete", { rpc: "hide_conversation", conversation }, null, ({ user }) =>
    user.rpc("hide_conversation", { conversation }),
  );
}

export async function blockOtherParticipant(conversationId: string): Promise<MutationResult<null>> {
  const found = await participation(conversationId);
  if (isRefused(found)) return found;
  const other = found.isSeller ? found.conversation.buyer : found.conversation.seller;
  const block = toBlockInsert(found.userId, other.id);
  return performWrite("blocks.insert", block, null, ({ user }) => user.from("blocks").insert(block), blockFieldErrors);
}

/* Bloquer deux fois la même personne : c'est déjà fait. */
function blockFieldErrors(code: string) {
  return code === "23505" ? { block: "Vous avez déjà bloqué cette personne." } : null;
}

/* Ouvrir un fil marque lus les messages reçus : read_at est la seule
   colonne que le destinataire modifie, sur les messages de l'autre partie
   seulement (droits et politique, migration 10). */
export async function markConversationRead(conversationId: string): Promise<MutationResult<null>> {
  const found = await participation(conversationId);
  if (isRefused(found)) return found;
  const conversation = found.conversation.id;
  return performWrite("messages.read", { conversation_id: conversation, reader_id: found.userId, read_at: "now()" }, null, ({ user }) =>
    user
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversation)
      .neq("sender_id", found.userId)
      .is("read_at", null),
  );
}
