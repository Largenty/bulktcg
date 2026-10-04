import type { Metadata } from "next";
import { MarkAllRead } from "@/components/notifications/MarkAllRead";
import { NotificationList } from "@/components/notifications/NotificationList";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getNotificationsForUser } from "@/lib/data/notifications";
import { requireCurrentUserId } from "@/lib/data/session";
import { countLabel } from "@/lib/french";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

/* Ce que la cloche de l'en-tête compte : les non lues d'abord signalées,
   toutes rangées de la plus récente à la plus ancienne. Chacune mène à ce
   dont elle parle. */
export default async function NotificationsPage() {
  const userId = await requireCurrentUserId(routes.notifications);
  const notifications = await getNotificationsForUser(userId);
  const unread = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <div className="container pb-[var(--section-gap)] pt-6 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display display-h2">Notifications</h1>
          <p className="mt-1.5 text-[length:var(--text-md)] text-[var(--ink-soft)]">
            {unread > 0 ? `${countLabel(unread, "nouvelle", "nouvelles")} depuis votre dernière visite.` : "Tout est lu."}
          </p>
        </div>
        {unread > 0 ? <MarkAllRead /> : null}
      </div>
      <div className="mt-8">
        {notifications.length > 0 ? (
          <NotificationList notifications={notifications} />
        ) : (
          <EmptyState
            title="Rien pour le moment"
            reason="Cette page vous prévient quand un lot attendu redevient disponible, quand une vente est clôturée, quand on vous note, et quand un lot répond à l'une de vos recherches."
            action={<ButtonLink href={routes.listings}>Voir les annonces</ButtonLink>}
          />
        )}
      </div>
    </div>
  );
}
