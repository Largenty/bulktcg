"use client";

import { useSelectedLayoutSegment } from "next/navigation";

/* « Messages » est le titre de la page tant qu'aucun fil n'est ouvert ; dès
   qu'un fil l'est, c'est l'interlocuteur qui devient le titre, et la liste
   passe au second rang. Un seul h1 par page — mais une seule taille : le
   titre du volet sautait de 46 à 22 px en ouvrant une conversation. Il a le
   pas de tous les titres de page, comme le nom de l'interlocuteur, l'autre
   titre de volet. */
export function InboxHeading({ summary }: { summary: string }) {
  const isThreadOpen = useSelectedLayoutSegment() !== null;
  const Heading = isThreadOpen ? "h2" : "h1";

  return (
    <div className="mb-4">
      <Heading className="display display-h2">Messages</Heading>
      <p className="mt-1.5 text-[length:var(--text-md)] text-[var(--ink-soft)]">{summary}</p>
    </div>
  );
}
