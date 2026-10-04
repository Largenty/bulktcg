"use client";

import type { Game, GameId } from "@/types/game";
import { ThemeChoiceControl } from "@/components/layout/ThemeChoiceControl";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { Sheet } from "@/components/ui/Sheet";
import { formatCount } from "@/lib/format";
import { gameColorVariable } from "@/lib/game-style";
import { routes } from "@/lib/routes";

type MobileNavProps = {
  games: Game[];
  countByGame: Record<GameId, number>;
  totalCount: number;
  unreadCount: number;
  notificationCount: number;
  isSignedIn: boolean;
};

const ROW =
  "flex min-h-[52px] items-center gap-3 border-b-[length:var(--border-width)] border-[var(--line)] px-5 text-[length:var(--text-lg)] font-semibold hover:bg-[var(--tint)]";

/* Sur téléphone, la navigation est une feuille plein écran : la recherche
   d'abord, puis les jeux avec leur nombre de lots, puis le compte. Une
   barre qui énumère huit entrées dans 390 px n'est plus une navigation. */
export function MobileNav({ games, countByGame, totalCount, unreadCount, notificationCount, isSignedIn }: MobileNavProps) {
  return (
    <Sheet
      title="Menu"
      triggerLabel="Ouvrir le menu"
      trigger={<Icon name="menu" size={22} />}
      triggerClassName="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] text-[var(--ink)] hover:border-[var(--ink)] hover:bg-[var(--tint)] xl:hidden"
    >
      <form action={routes.listings} method="get" role="search" aria-label="Chercher un lot" className="border-b-[length:var(--border-width)] border-[var(--line)] p-5">
        <label htmlFor="recherche-menu" className="label text-[var(--muted)]">
          Chercher un lot
        </label>
        <div className="mt-2 flex gap-2">
          <input id="recherche-menu" name="q" type="search" placeholder="Vrac, display, EV08…" className="field" />
          <button type="submit" className="btn shrink-0 px-4">
            <Icon name="search" size={18} />
            <span className="sr-only">Chercher</span>
          </button>
        </div>
      </form>

      <nav aria-label="Navigation principale">
        <IntentLink href={routes.listings} className={ROW}>
          Toutes les annonces
          <span className="mono ml-auto text-[length:var(--text-sm)] font-medium text-[var(--muted)]">{formatCount(totalCount)}</span>
        </IntentLink>
        {games.map((game) => (
          <IntentLink key={game.id} href={routes.game(game.id)} className={`${ROW} font-medium`}>
            <span aria-hidden="true" className="lot-mark" style={{ backgroundColor: gameColorVariable(game.id) }} />
            {game.label}
            <span className="mono ml-auto text-[length:var(--text-sm)] text-[var(--muted)]">{formatCount(countByGame[game.id])}</span>
          </IntentLink>
        ))}
        <IntentLink href={routes.wantedListings} className={ROW}>
          Demandes de recherche
        </IntentLink>
        <IntentLink href={routes.pro} className={ROW}>
          Le forfait pro
        </IntentLink>
        {isSignedIn ? (
          <>
            <IntentLink href={routes.inbox} className={ROW}>
              Messages
              {unreadCount > 0 ? (
                <span className="mono ml-auto grid h-6 min-w-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--ink)] px-1.5 text-[length:var(--text-xs)] text-[var(--on-ink)]">
                  {unreadCount}
                  <span className="sr-only"> conversations non lues</span>
                </span>
              ) : null}
            </IntentLink>
            <IntentLink href={routes.notifications} className={ROW}>
              Notifications
              {notificationCount > 0 ? (
                <span className="mono ml-auto grid h-6 min-w-6 place-items-center rounded-[var(--radius-sm)] bg-[var(--ink)] px-1.5 text-[length:var(--text-xs)] text-[var(--on-ink)]">
                  {notificationCount}
                  <span className="sr-only"> notifications non lues</span>
                </span>
              ) : null}
            </IntentLink>
            <IntentLink href={routes.account} className={ROW}>
              Mon compte
            </IntentLink>
          </>
        ) : (
          <IntentLink href={routes.signIn} className={ROW}>
            Se connecter
          </IntentLink>
        )}
        <IntentLink href={routes.safety} className={ROW}>
          Conseils de sécurité
        </IntentLink>
      </nav>

      <div className="flex flex-col gap-4 p-5">
        {/* Empilés : sur une ligne, le libellé et les trois choix sortaient
            de la feuille de 7 px à 360 px de large. */}
        <div className="flex flex-col items-start gap-2">
          <span className="label text-[var(--muted)]">Affichage</span>
          <ThemeChoiceControl tone="default" />
        </div>
        <IntentLink href={routes.deposit} className="btn w-full">
          <Icon name="plus" size={18} />
          Déposer une annonce
        </IntentLink>
      </div>
    </Sheet>
  );
}
