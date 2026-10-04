"use server";

import { refresh } from "next/cache";
import { revalidateMessagePaths } from "@/app/actions/revalidate";
import { blockOtherParticipant, hideConversation, markConversationRead } from "@/lib/data/conversation-mutations";
import type { MutationResult } from "@/lib/data/mutation-result";
import { recordIdSchema } from "@/lib/schemas/record-id";


/* Actions minces : elles revalident l'entrée, délèguent à la couche données,
   et rafraîchissent la messagerie quand une écriture a vraiment eu lieu. */
function after(result: MutationResult<null>, conversationId: string): MutationResult<null> {
  if (result.status === "saved") revalidateMessagePaths(conversationId);
  return result;
}

export async function hideConversationAction(conversationId: string): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return { status: "not-found" };
  return after(await hideConversation(id.data), id.data);
}

export async function blockUserAction(conversationId: string): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return { status: "not-found" };
  return after(await blockOtherParticipant(id.data), id.data);
}

/* Ouvrir un fil le marque lu : le badge de l'en-tête et la liste des fils
   ne regardent que la personne, d'où refresh() et aucune page invalidée. */
export async function markConversationReadAction(conversationId: string): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return { status: "not-found" };
  const result = await markConversationRead(id.data);
  if (result.status === "saved") refresh();
  return result;
}
