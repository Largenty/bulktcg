"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";

/* Deux volets en grand écran — les conversations à gauche, le fil à
   droite —, un seul à la fois sur téléphone : la liste sur /messages, le fil
   dès qu'une conversation est ouverte. La page n'est plus une colonne de
   900 px collée à gauche d'un écran de 1 600. */
export function MessagesShell({ list, children }: { list: ReactNode; children: ReactNode }) {
  const isThreadOpen = useSelectedLayoutSegment() !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* min-w-0 : sans lui, la colonne prend la largeur des aperçus tronqués
          (845 px sur un téléphone de 360) au lieu de les tronquer. */}
      <div className={isThreadOpen ? "min-w-0 max-lg:hidden" : "min-w-0"}>{list}</div>
      <div className={isThreadOpen ? "min-w-0" : "min-w-0 max-lg:hidden"}>{children}</div>
    </div>
  );
}
