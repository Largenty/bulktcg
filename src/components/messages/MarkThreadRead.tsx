"use client";

import { useEffect } from "react";
import { markConversationReadAction } from "@/app/actions/conversations";
import { settle } from "@/components/ui/useMutation";

/* Ouvrir un fil le marque lu — les messages reçus seulement. Un effet, et
   non le rendu de la page : c'est le passage de la personne qui compte, et
   une page préchargée ou rejouée ne lit rien. Rien à nettoyer : l'écriture
   part une fois, et un échec — réseau coupé — laisse simplement le fil non
   lu, comme avant l'ouverture. */
export function MarkThreadRead({ conversationId, hasUnread }: { conversationId: string; hasUnread: boolean }) {
  useEffect(() => {
    if (hasUnread) void settle(() => markConversationReadAction(conversationId));
  }, [conversationId, hasUnread]);

  return null;
}
