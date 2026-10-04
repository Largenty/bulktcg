import type { AccountAction } from "@/components/account/ActionList";
import type { Listing } from "@/types/listing";
import { getListingStageUrl } from "@/lib/account-stages";
import { LISTING_LIFECYCLE, isArchived, isExpired, isExpiringWithin } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";

/* Les deux gestes que demande le temps qui passe, en tête de la vue
   d'ensemble : prolonger ce qui expire dans la semaine, remettre en ligne ce
   qui a expiré avant que ses photos ne partent. Une annonce archivée ne
   réclame plus rien — elle reviendrait sinon ici indéfiniment, pour un
   vendeur qui a simplement cessé de vendre. Une ligne à zéro ne s'affiche
   pas (ActionList). */
export function buildLifecycleActions(listings: Pick<Listing, "status" | "renewedAt" | "soldAt">[], now: number): AccountAction[] {
  const expiringSoon = listings.filter((listing) => isExpiringWithin(listing, LISTING_LIFECYCLE.noticeDays, now)).length;
  const recentlyExpired = listings.filter((listing) => isExpired(listing, now) && !isArchived(listing, now)).length;
  return [
    {
      count: expiringSoon,
      sentence: `${expiringSoon > 1 ? "de vos annonces expirent" : "de vos annonces expire"} dans moins de ${LISTING_LIFECYCLE.noticeDays} jours : prolongez-les en un clic pour qu'elles restent dans les listes.`,
      href: routes.accountListings,
      linkLabel: "Prolonger",
    },
    {
      count: recentlyExpired,
      sentence: `${recentlyExpired > 1 ? "de vos annonces ont expiré" : "de vos annonces a expiré"} : remises en ligne d'un clic, elles gardent leurs photos.`,
      href: getListingStageUrl("expired"),
      linkLabel: "Remettre en ligne",
    },
  ];
}
