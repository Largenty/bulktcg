import Link from "next/link";
import type { Notification } from "@/types/notification";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatRelativeTime } from "@/lib/format";
import { NOTIFICATION_KIND_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";

type Rendered = { icon: IconName; sentence: string; href: string; linkLabel: string };

/* Ce que dit chaque notification, et où elle mène. Un lot devenu illisible
   — vendu entre-temps, ou réservé aux pros — n'a plus de titre : la phrase
   le dit sans l'inventer. */
function describe(notification: Notification): Rendered {
  const title = notification.listing ? `« ${notification.listing.title} »` : "un lot qui n'est plus en ligne";
  const listingHref = notification.listing ? routes.listing(notification.listing.slug) : routes.listings;
  const actor = notification.actorUsername ?? "L'autre partie";
  /* La section des avis de la vente, ou la liste des ventes : sans vente
     connue, l'ancre ne viserait rien. */
  const reviewsHref = notification.dealId ? routes.dealReviews(notification.dealId) : routes.accountDeals;
  switch (notification.kind) {
    case "listing_available":
      return { icon: "bell", sentence: `${title} est de nouveau disponible. Tous les inscrits sont prévenus en même temps.`, href: listingHref, linkLabel: "Voir le lot" };
    case "deal_closed":
      return { icon: "handshake", sentence: `${actor} a clôturé la vente de ${title}. Vous pouvez maintenant noter ${actor}.`, href: reviewsHref, linkLabel: `Noter ${actor}` };
    case "review_received":
      return { icon: "star", sentence: `${actor} vous a laissé un avis sur ${title}.`, href: reviewsHref, linkLabel: "Lire l'avis" };
    case "wanted_match":
      return {
        icon: "sparkle",
        sentence: `${title} répond à votre recherche${notification.wanted ? ` « ${notification.wanted.title} »` : ""}.`,
        href: listingHref,
        linkLabel: "Voir le lot",
      };
    /* Écrite une semaine avant l'échéance (run_listing_lifecycle) : la
       phrase ne donne pas de date, qui serait fausse dès la prolongation. */
    case "listing_expiring":
      return {
        icon: "clock",
        sentence: `${title} arrive à expiration : prolongez-la en un clic pour qu'elle reste dans les listes.`,
        href: routes.accountListings,
        linkLabel: "Prolonger",
      };
  }
}

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const now = Date.now();
  return (
    <ul className="flex list-none flex-col gap-3">
      {notifications.map((notification) => {
        const rendered = describe(notification);
        const isUnread = notification.readAt === null;
        return (
          <li
            key={notification.id}
            className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-[var(--radius-lg)] border-[length:var(--border-width)] bg-[var(--card)] p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${
              isUnread ? "border-[var(--ink)]" : "border-[var(--line)]"
            }`}
          >
            <span className={`grid h-10 w-10 place-items-center rounded-[var(--radius-md)] ${isUnread ? "bg-[var(--ink)] text-[var(--on-ink)]" : "bg-[var(--tint)] text-[var(--ink)]"}`}>
              <Icon name={rendered.icon} size={18} />
            </span>
            <div className="min-w-0">
              <p className="label flex flex-wrap items-center gap-x-2 text-[var(--muted)]">
                {NOTIFICATION_KIND_LABELS[notification.kind]}
                {isUnread ? <span className="text-[var(--ink)]">· Nouveau</span> : null}
                <span className="mono font-normal normal-case tracking-normal">
                  · <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt, now)}</time>
                </span>
              </p>
              <p className={`mt-1 text-[length:var(--text-md)] leading-snug ${isUnread ? "font-semibold" : ""}`}>{rendered.sentence}</p>
            </div>
            <Link href={rendered.href} className="col-start-2 text-[length:var(--text-sm)] font-semibold underline underline-offset-4 sm:col-start-3">
              {rendered.linkLabel}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
