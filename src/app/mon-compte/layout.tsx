import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountNav, type AccountTab } from "@/components/account/AccountNav";
import { SignOutButton } from "@/components/account/SignOutButton";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ProBadge } from "@/components/pro/ProBadge";
import { Rating } from "@/components/ui/Rating";
import { countListingsOwnedBy } from "@/lib/data/listings";
import { getDealsForUser } from "@/lib/data/deals";
import { getProfileById } from "@/lib/data/profiles";
import { canSignOut, requireCurrentUserId } from "@/lib/data/session";
import { countWantedListings } from "@/lib/data/wanted";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/* L'identité et la navigation sont dans le gabarit : elles ne changent pas
   d'un onglet à l'autre, et les recharger à chaque page ferait clignoter le
   seul repère stable de l'écran. En ardoise, comme l'en-tête : c'est
   l'espace à soi, distinct des pages publiques. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireCurrentUserId(routes.account);
  const profile = await getProfileById(userId);
  if (!profile) notFound();

  const [listingCount, wantedCount, deals] = await Promise.all([
    countListingsOwnedBy(userId, { includeSold: true }),
    countWantedListings({ buyerId: userId, includeClosed: true }),
    getDealsForUser(userId),
  ]);

  const tabs: AccountTab[] = [
    { href: routes.account, label: "Vue d'ensemble" },
    { href: routes.accountListings, label: "Mes annonces", count: listingCount },
    { href: routes.accountWanted, label: "Mes recherches", count: wantedCount },
    { href: routes.accountDeals, label: "Ventes et achats", count: deals.length },
    { href: routes.accountProfile, label: "Profil public" },
    { href: routes.accountSettings, label: "Paramètres" },
  ];

  return (
    <div className="pb-[var(--section-gap)]">
      <div className="on-slate">
        <div className="container flex flex-col gap-3 pb-5 pt-5 sm:flex-row sm:items-center sm:gap-5 sm:pb-6 sm:pt-8 lg:pt-10">
          {/* Sur téléphone l'en-tête occupait tout le premier écran : avatar
              réduit, et le bouton du profil public s'efface — l'onglet
              « Profil public » juste en dessous y mène déjà. */}
          <span className="sm:hidden">
            <Avatar initials={profile.avatarInitials} size="md" isInverse />
          </span>
          <span className="hidden sm:block">
            <Avatar initials={profile.avatarInitials} size="lg" isInverse />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2.5">
              <span className="label text-[var(--chalk-muted)]">Mon compte</span>
              {/* Le badge suit le statut professionnel ; le forfait et sa fin ne
                  se lisent qu'ici : c'est la seule page où la date intéresse
                  son lecteur. */}
              {profile.isPro ? <ProBadge isInverse /> : null}
              {profile.hasProPlan && profile.proUntil ? (
                <span className="label text-[var(--chalk-soft)]">
                  Forfait actif jusqu&apos;au <time dateTime={profile.proUntil}>{formatDate(profile.proUntil)}</time>
                </span>
              ) : null}
            </p>
            <h1 className="display display-h2 display-user mt-1.5">{profile.username}</h1>
            <p className="mono mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[length:var(--text-sm)] text-[var(--chalk-soft)]">
              <span>
                {profile.city} ({profile.postalCode}) · compte créé{" "}
                <time dateTime={profile.createdAt}>{formatRelativeTime(profile.createdAt, Date.now())}</time>
              </span>
              <Rating ratingAvg={profile.ratingAvg} ratingCount={profile.ratingCount} isInverse />
            </p>
          </div>
          {/* Voir ce que les autres voient : la seule façon de vérifier qu'une
              donnée privée n'a pas fui sur le profil public. */}
          <Link href={routes.profile(profile.username)} className="btn btn-outline-inverse btn-sm shrink-0 self-start max-sm:hidden sm:self-center">
            Voir mon profil public
            <Icon name="arrowRight" size={16} />
          </Link>
          {canSignOut() ? <SignOutButton /> : null}
        </div>
        <div className="container pb-4">
          <AccountNav tabs={tabs} />
        </div>
      </div>

      <div className="container mt-8 lg:mt-10">{children}</div>
    </div>
  );
}
