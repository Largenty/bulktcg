"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Game, GameId } from "@/types/game";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { formatCount } from "@/lib/format";
import { gameColorVariable } from "@/lib/game-style";
import { routes } from "@/lib/routes";

type GameMenuProps = {
  games: Game[];
  countByGame: Record<GameId, number>;
  totalCount: number;
};

/* Un menu de liens, pas une liste de sélection : chaque ligne navigue. On
   garde donc le comportement natif du lien — la tabulation le parcourt, le
   clic du milieu ouvre un onglet — et on n'ajoute que ce que le dépliant
   impose : Échap referme et rend le focus, un clic dehors referme. */
export function GameMenu({ games, countByGame, totalCount }: GameMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        /* Le panneau n'existe que déplié : désigner un identifiant absent est
           une erreur de validité HTML. */
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded-[var(--radius-sm)] text-[length:var(--text-md)] font-semibold text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] aria-expanded:text-[var(--ink)]"
      >
        Annonces
        <Icon name="chevronDown" size={16} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="absolute left-[-14px] top-[calc(100%+20px)] z-[var(--layer-popover)] w-[300px] rounded-[var(--radius-lg)] border-[length:var(--border-width-strong)] border-[var(--frame)] bg-[var(--card)] p-2 text-[var(--ink)] shadow-[var(--shadow-lg)]"
        >
          <IntentLink
            href={routes.listings}
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[length:var(--text-md)] font-semibold hover:bg-[var(--tint)]"
          >
            Toutes les annonces
            <span className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{formatCount(totalCount)}</span>
          </IntentLink>
          <p className="label px-3 pb-1.5 pt-3 text-[var(--muted)]">Par jeu</p>
          {games.map((game) => (
            <IntentLink
              key={game.id}
              href={routes.game(game.id)}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-[length:var(--text-md)] font-medium hover:bg-[var(--tint)]"
            >
              <span
                aria-hidden="true"
                className="lot-mark"
                style={{ backgroundColor: gameColorVariable(game.id) }}
              />
              {game.label}
              <span className="mono ml-auto text-[length:var(--text-xs)] text-[var(--muted)]">
                {formatCount(countByGame[game.id])}
              </span>
            </IntentLink>
          ))}
          <IntentLink
            href={routes.wantedListings}
            onClick={() => setIsOpen(false)}
            className="mt-1.5 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border-t-[length:var(--border-width)] border-[var(--line)] px-3 pb-2 pt-3 text-[length:var(--text-sm)] text-[var(--ink-soft)] hover:bg-[var(--tint)]"
          >
            Ce que les acheteurs cherchent
            <Icon name="arrowRight" size={16} />
          </IntentLink>
        </div>
      ) : null}
    </div>
  );
}
