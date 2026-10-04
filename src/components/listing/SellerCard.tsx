import type { SellerSummary } from "@/types/profile";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { ProBadge } from "@/components/pro/ProBadge";
import { Rating } from "@/components/ui/Rating";
import { routes } from "@/lib/routes";

/* Qui vend. La note et le nombre d'avis sont la seule preuve de sérieux
   qu'un acheteur ait avant le rendez-vous ; le profil public montre le
   reste — ses autres lots, ce qu'il cherche, les avis écrits. */
export function SellerCard({ seller, role = "Vendu par" }: { seller: SellerSummary; role?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-4">
      <Avatar initials={seller.avatarInitials} size="md" />
      <div className="min-w-0 flex-1">
        <p className="label text-[var(--muted)]">{role}</p>
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[length:var(--text-lg)] font-semibold">{seller.username}</span>
          {seller.isPro ? <ProBadge /> : null}
        </p>
        {/* L'enseigne d'une boutique, sous le pseudo : c'est elle qu'on
            retrouve sur la vitrine le jour du rendez-vous. */}
        {seller.isPro && seller.companyName ? (
          <p className="truncate text-[length:var(--text-sm)] text-[var(--ink-soft)]">{seller.companyName}</p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Rating ratingAvg={seller.ratingAvg} ratingCount={seller.ratingCount} />
          <span className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{seller.city}</span>
        </div>
      </div>
      <IntentLink
        href={routes.profile(seller.username)}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] hover:border-[var(--ink)]"
      >
        <Icon name="arrowRight" size={18} />
        <span className="sr-only">Voir le profil de {seller.username}</span>
      </IntentLink>
    </div>
  );
}
