import type { ReactNode } from "react";

export type StatusTone = {
  /* Classes du contour, du fond et du texte, et couleur du point. Deux
     tables plutôt qu'une couleur brute : le statut « réservé » n'a pas la
     même encre que son point, et c'est mesuré par l'audit de contraste. */
  pill: string;
  dot: string;
};

type StatusPillProps = {
  tone: StatusTone;
  children: ReactNode;
};

/* Pastille à point : l'état d'une annonce comme celui d'une demande. La
   couleur n'est jamais seule porteuse du sens — le libellé est écrit à
   côté. */
export function StatusPill({ tone, children }: StatusPillProps) {
  return (
    <span
      className={`label inline-flex min-h-[26px] items-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] border-[length:var(--border-width)] px-2.5 font-semibold ${tone.pill}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
      {children}
    </span>
  );
}
