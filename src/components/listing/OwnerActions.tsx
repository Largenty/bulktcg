import type { Listing } from "@/types/listing";
import { ListingLifecycleNote } from "@/components/account/ListingLifecycleNote";
import { ListingStatusSwitcher } from "@/components/account/ListingStatusSwitcher";
import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { MobileActionBar } from "@/components/listing/MobileActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { isExpired } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";

/* Le vendeur sur sa propre fiche n'a rien à se demander : il voit le statut
   en un clic, la modification et le partage, là où il se serait proposé de
   se contacter lui-même. */
export function OwnerActions({ listing, shareUrl }: { listing: Listing; shareUrl: string }) {
  /* Composant serveur : l'échéance se lit ici, à l'instant de la page. */
  const now = Date.now();
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width-strong)] border-[var(--ink)] bg-[var(--card)] p-5">
      <p className="label text-[var(--muted)]">Votre annonce</p>
      {/* Expirée, elle n'a plus de statut à changer : la remettre en ligne
          est le seul geste, dans la note qui suit. */}
      {isExpired(listing, now) ? null : (
        <ListingStatusSwitcher
          listingId={listing.id}
          title={listing.title}
          status={listing.status}
          idleText="Un clic suffit : la fiche et le lien partagé affichent le nouveau statut."
        />
      )}
      <ListingLifecycleNote listing={listing} now={now} />
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={routes.editListing(listing.slug)} variant="secondary" size="sm">
          Modifier
        </ButtonLink>
        <CopyLinkButton url={shareUrl} size="sm" />
      </div>
      <MobileActionBar price={listing.priceCents} href={routes.accountListings} label="Gérer mes annonces" />
    </div>
  );
}
