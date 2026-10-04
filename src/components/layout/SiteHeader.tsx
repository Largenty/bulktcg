import Link from "next/link";
import { GameMenu } from "@/components/layout/GameMenu";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tranche } from "@/components/layout/Tranche";
import { getUnreadConversationCount } from "@/lib/data/conversations";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { getGames } from "@/lib/data/games";
import { getListingCountByGame } from "@/lib/data/listings";
import { getProfileById } from "@/lib/data/profiles";
import { getCurrentUserId } from "@/lib/data/session";
import { routes } from "@/lib/routes";

const NAV_LINK =
  "rounded-[var(--radius-sm)] text-[length:var(--text-md)] font-semibold text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]";

/* Sans utilitaire d'affichage : chaque lien le reçoit à l'usage
   (« hidden md:inline-flex »). Deux utilitaires d'affichage sur un même
   élément ne s'arbitrent pas par leur ordre dans la classe mais par celui de
   la feuille générée — c'est ainsi que Messages et Mon compte débordaient de
   l'en-tête sur mobile. */
const TOOL_LINK =
  "relative h-10 items-center gap-2 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] px-3 text-[length:var(--text-md)] font-semibold text-[var(--ink)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--tint)]";

/* L'en-tête est une étiquette : blanche, soulignée d'un filet d'encre en
   clair, en ardoise en sombre — et la tranche aux couleurs des jeux qui court
   dessous signe chaque page. Les sept jeux et « Autre » ne sont pas dans la
   barre — à côté de trois boutons d'action, onze entrées cessent d'être une
   navigation — mais dans le dépliant « Annonces ».
   « Conseils » a quitté la barre quand « Pros » y est entré : à quatre
   liens, le champ de recherche tombait à 95 px et coupait sa propre
   invite. Il reste dans le menu mobile et le pied de page. */
export async function SiteHeader() {
  const currentUserId = await getCurrentUserId();
  const [games, countByGame] = await Promise.all([getGames(), getListingCountByGame()]);
  const [unreadCount, notificationCount, profile] = currentUserId
    ? await Promise.all([
        getUnreadConversationCount(currentUserId),
        getUnreadNotificationCount(currentUserId),
        getProfileById(currentUserId),
      ])
    : [0, 0, null];
  const totalCount = Object.values(countByGame).reduce((sum, count) => sum + count, 0);

  return (
    <header className="sticky top-0 z-[var(--layer-header)] bg-[var(--header-bg)] text-[var(--ink)]">
      <div className="border-b-[length:var(--border-width-strong)] border-[var(--header-rule)]">
      <div className="container flex h-[var(--header-height)] items-center gap-2 sm:gap-3 lg:gap-5 2xl:gap-7">
        <Logo />

        {/* Sous 1 280 px, « Recherches » et « Pros » passent dans le menu : avec
            la cloche, la barre débordait à 1 024 px — le bouton « Déposer »
            sortait de l'écran et la recherche tombait à une icône. */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-5 lg:flex xl:gap-6">
          <GameMenu games={games} countByGame={countByGame} totalCount={totalCount} />
          <Link href={routes.wantedListings} className={`${NAV_LINK} hidden xl:inline`}>
            Recherches
          </Link>
          <Link href={routes.pro} className={`${NAV_LINK} hidden xl:inline`}>
            Pros
          </Link>
        </nav>

        <HeaderSearch />

        {/* Serré sur téléphone : logo, « Déposer » et menu débordaient de 6 px
            sur la marge droite à 360 px. */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle className="hidden h-10 w-10 place-items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] text-[var(--ink)] transition-colors hover:border-[var(--ink)] hover:bg-[var(--tint)] xl:grid" />
          {profile ? (
            <>
              <Link href={routes.inbox} className={`${TOOL_LINK} hidden md:inline-flex`}>
                <Icon name="message" size={18} />
                <span className="hidden 2xl:inline">Messages</span>
                {unreadCount > 0 ? (
                  <span className="mono grid h-5 min-w-5 place-items-center rounded-[var(--radius-sm)] bg-[var(--ink)] px-1.5 text-[length:var(--text-xs)] font-bold text-[var(--on-ink)]">
                    {unreadCount}
                    <span className="sr-only"> conversations non lues</span>
                  </span>
                ) : null}
                <span className="sr-only 2xl:hidden">Messages</span>
              </Link>
              {/* La cloche : un lot réservé redevenu disponible, une vente
                  clôturée, un avis, un lot pour une recherche. Le chiffre ne
                  compte que les non lues. */}
              <Link href={routes.notifications} className={`${TOOL_LINK} hidden md:inline-flex`}>
                <Icon name="bell" size={18} />
                {notificationCount > 0 ? (
                  <span className="mono grid h-5 min-w-5 place-items-center rounded-[var(--radius-sm)] bg-[var(--ink)] px-1.5 text-[length:var(--text-xs)] font-bold text-[var(--on-ink)]">
                    {notificationCount}
                    <span className="sr-only"> notifications non lues</span>
                  </span>
                ) : null}
                <span className="sr-only">Notifications</span>
              </Link>
              {/* L'avatar est le raccourci attendu vers son propre compte : il
                  porte un vrai libellé, l'initiale seule n'en est pas un. */}
              <Link href={routes.account} className={`${TOOL_LINK} hidden pl-1.5 md:inline-flex`}>
                <Avatar initials={profile.avatarInitials} size="sm" />
                <span className="hidden 2xl:inline">Mon compte</span>
                <span className="sr-only 2xl:hidden">Mon compte</span>
              </Link>
            </>
          ) : (
            <Link href={routes.signIn} className={`${TOOL_LINK} hidden md:inline-flex`}>
              Se connecter
            </Link>
          )}

          {/* Sous 360 px — 320 px, la largeur du critère WCAG 1.4.10 —, le
              libellé cède la place à l'icône et reste lu : la barre débordait
              de 24 px sur toutes les pages. */}
          <ButtonLink href={routes.deposit} size="sm" className="whitespace-nowrap">
            <Icon name="plus" size={16} strokeWidth={2.4} />
            <span className="max-[359px]:sr-only xl:hidden">Déposer</span>
            <span className="hidden xl:inline">Déposer une annonce</span>
          </ButtonLink>

          <MobileNav
            games={games}
            countByGame={countByGame}
            totalCount={totalCount}
            unreadCount={unreadCount}
            notificationCount={notificationCount}
            isSignedIn={profile !== null}
          />
        </div>
      </div>
      </div>
      <Tranche />
    </header>
  );
}
