import type { Listing } from "@/types/listing";
import { RenewListingButton } from "@/components/account/RenewListingButton";
import { Icon } from "@/components/ui/Icon";
import { formatDate } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { LISTING_LIFECYCLE, daysUntil, getListingLifecycle } from "@/lib/listing-lifecycle";

type ListingLifecycleNoteProps = {
  listing: Pick<Listing, "id" | "title" | "status" | "renewedAt" | "soldAt" | "photos">;
  /* L'instant de la page : composant serveur, il ne lit pas l'horloge
     lui-même pour autant — la ligne et la fiche disent la même chose. */
  now: number;
};

const NOTE = "text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]";

/* Une échéance, écrite en toutes lettres dans un <time> qui porte son
   instant. */
function Day({ at }: { at: number }) {
  const isoDate = new Date(at).toISOString();
  return <time dateTime={isoDate}>{formatDate(isoDate)}</time>;
}

/* Où en est l'annonce, pour son vendeur : jusqu'à quand elle reste en ligne,
   quand ses photos partent, et le geste gratuit qui la relance. La même
   ligne sur le tableau de bord et sur la fiche. Le décompte ne passe au
   premier plan qu'à l'approche de l'échéance (LISTING_LIFECYCLE.warningDays) :
   avant, une date discrète suffit, et un compte à rebours permanent ne
   serait plus lu. */
export function ListingLifecycleNote({ listing, now }: ListingLifecycleNoteProps) {
  const lifecycle = getListingLifecycle(listing, now);
  const hasPhotos = listing.photos.length > 0;

  if (lifecycle.phase === "online") {
    if (!lifecycle.isWarning) {
      return (
        <p className={NOTE}>
          En ligne jusqu&apos;au <Day at={lifecycle.expiresAt} /> : chaque modification ou changement de statut la prolonge de{" "}
          {LISTING_LIFECYCLE.lifetimeDays} jours.
        </p>
      );
    }
    return (
      <div data-lifecycle="expiring" className="notice notice-warn flex flex-col gap-3">
        <p className="flex items-start gap-2 text-[length:var(--text-md)] leading-snug">
          <Icon name="clock" size={18} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">Expire dans {countLabel(daysUntil(lifecycle.expiresAt, now), "jour")}</strong>, le{" "}
            <Day at={lifecycle.expiresAt} />. Sans prolongation, elle quittera les listes et les recherches.
          </span>
        </p>
        <RenewListingButton listingId={listing.id} title={listing.title} label={`Prolonger de ${LISTING_LIFECYCLE.lifetimeDays} jours`} />
      </div>
    );
  }

  if (lifecycle.phase === "expired") {
    return (
      <div data-lifecycle="expired" className="notice flex flex-col gap-3">
        <p className="text-[length:var(--text-md)] leading-snug">
          <strong className="font-semibold">Expirée le <Day at={lifecycle.expiredAt} /></strong> : elle n&apos;apparaît plus dans
          les listes, et sa page dit qu&apos;elle n&apos;est plus en ligne.{" "}
          {lifecycle.isArchived ? (
            <>
              Archivée depuis le <Day at={lifecycle.archiveAt} /> : une annonce archivée n&apos;a plus de photos, et repart sans
              elles.
            </>
          ) : hasPhotos ? (
            <>
              Sans remise en ligne, ses photos seront supprimées le <Day at={lifecycle.archiveAt} />.
            </>
          ) : (
            "Vous pouvez la remettre en ligne à tout moment."
          )}
        </p>
        <RenewListingButton listingId={listing.id} title={listing.title} label="Remettre en ligne" />
      </div>
    );
  }

  if (lifecycle.archiveAt === null) return null;
  if (lifecycle.isArchived) {
    return (
      <p className={NOTE}>
        Archivée depuis le <Day at={lifecycle.archiveAt} /> : une annonce archivée n&apos;a plus de photos. Le texte, le prix et
        les avis restent.
      </p>
    );
  }
  return hasPhotos ? (
    <p className={NOTE}>
      Ses photos seront supprimées le <Day at={lifecycle.archiveAt} />, {LISTING_LIFECYCLE.archiveAfterDays} jours après la vente :
      nous ne gardons pas plus longtemps que nécessaire des photos prises chez vous.
    </p>
  ) : null;
}
