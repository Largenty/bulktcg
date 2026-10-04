import type { SellerProfile } from "@/types/profile";
import { StatList } from "@/components/account/StatList";
import { ShopDetails } from "@/components/profile/ShopDetails";
import { ReportLink } from "@/components/report/ReportLink";
import { Avatar } from "@/components/ui/Avatar";
import { ProBadge } from "@/components/pro/ProBadge";
import { Rating } from "@/components/ui/Rating";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { REVIEWS_ANCHOR } from "@/lib/routes";

/* L'ardoise d'un profil public : qui, où, depuis quand, la note — qui mène
   à son détail plus bas —, et pour une boutique au forfait actif, son badge
   et sa fiche. On ne se signale pas soi-même : le lien n'apparaît pas sur
   son propre profil. */
export function ProfileHeader({ profile, viewerId }: { profile: SellerProfile; viewerId: string | null }) {
  return (
    <div className="on-slate">
      <div className="container flex flex-col gap-6 py-8 sm:flex-row sm:items-start lg:py-12">
        <Avatar initials={profile.avatarInitials} size="lg" isInverse />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2.5">
            <span className="label text-[var(--chalk-muted)]">{profile.isPro ? "Boutique" : "Profil"}</span>
            {profile.isPro ? <ProBadge isInverse /> : null}
          </p>
          <h1 className="display display-h2 display-user mt-1.5">{profile.username}</h1>
          {profile.isPro && profile.companyName ? (
            <p className="mt-1 text-[length:var(--text-lg)] font-semibold text-[var(--chalk-soft)]">{profile.companyName}</p>
          ) : null}
          <p className="mono mt-2 text-[length:var(--text-sm)] text-[var(--chalk-soft)]">
            {profile.city} ({profile.postalCode}) · compte créé{" "}
            <time dateTime={profile.createdAt}>{formatRelativeTime(profile.createdAt, Date.now())}</time>
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Rating ratingAvg={profile.ratingAvg} ratingCount={profile.ratingCount} size="md" isInverse />
            {profile.ratingCount > 0 ? (
              <a href={`#${REVIEWS_ANCHOR}`} className="text-[length:var(--text-sm)] font-semibold text-[var(--chalk-soft)] underline underline-offset-4 hover:text-[var(--chalk)]">
                Détail de la note
              </a>
            ) : null}
          </p>
          {profile.bio ? (
            <p className="mt-4 text-[length:var(--text-md)] leading-relaxed text-[var(--chalk-soft)]">{profile.bio}</p>
          ) : null}
          {profile.shop ? <ShopDetails shop={profile.shop} /> : null}
          {viewerId !== profile.id ? (
            <div className="mt-4">
              <ReportLink target="profile" targetKey={profile.username} isInverse />
            </div>
          ) : null}
        </div>
        <StatList
          isInverse
          stats={[
            { label: "En ligne", value: formatCount(profile.activeListingCount) },
            { label: "Ventes réalisées", value: formatCount(profile.soldListingCount) },
          ]}
        />
      </div>
    </div>
  );
}
