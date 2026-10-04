"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { routes } from "@/lib/routes";

/* La ligne d'une conversation, marquée courante quand son fil est ouvert à
   côté : c'est la seule chose que la liste, rendue par le serveur, ne peut
   pas savoir seule. */
export function ConversationLink({ conversationId, isUnread, children }: { conversationId: string; isUnread: boolean; children: ReactNode }) {
  const isCurrent = useSelectedLayoutSegment() === conversationId;

  return (
    <Link
      href={routes.conversation(conversationId)}
      aria-current={isCurrent ? "page" : undefined}
      className={`flex items-center gap-3 border-l-[length:var(--border-width-strong)] p-3.5 transition-colors hover:bg-[var(--tint)] ${
        isCurrent ? "border-[var(--ink)] bg-[var(--tint)]" : "border-transparent"
      } ${isUnread && !isCurrent ? "bg-[var(--notice-soft)]" : ""}`}
    >
      {children}
    </Link>
  );
}
