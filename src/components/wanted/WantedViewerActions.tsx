import type { WantedListing } from "@/types/wanted";
import { WantedStatusSwitcher } from "@/components/account/WantedStatusSwitcher";
import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";
import { getWantedListingsUrl } from "@/lib/wanted-query";

/* Ce que la page d'une demande propose dépend de qui la regarde, comme sur
   une fiche d'annonce. Un vendeur a deux gestes : écrire à l'acheteur, ou
   déposer le lot qui lui répond. L'acheteur, lui, voit ses outils — fermer
   en un clic dès qu'il a trouvé, c'est la promesse de la fonctionnalité — là
   où on lui proposait « J'ai ce lot » sur sa propre demande. */
export function WantedViewerActions({ wanted, isOwner }: { wanted: WantedListing; isOwner: boolean }) {
  const shareUrl = `${SITE_URL}${routes.wanted(wanted.slug)}`;

  if (isOwner) {
    return (
      <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width-strong)] border-[var(--ink)] bg-[var(--card)] p-5">
        <p className="label text-[var(--muted)]">Votre demande</p>
        <WantedStatusSwitcher wantedId={wanted.id} title={wanted.title} status={wanted.status} />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={routes.editWanted(wanted.slug)} variant="secondary" size="sm">
            Modifier
          </ButtonLink>
          <CopyLinkButton url={shareUrl} size="sm" />
        </div>
      </div>
    );
  }

  if (wanted.status !== "open") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] bg-[var(--card)] p-5">
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          Cette demande n&apos;est plus active. La page reste en ligne parce que le lien a pu être partagé
          ailleurs.
        </p>
        <ButtonLink href={getWantedListingsUrl(wanted.gameId)} variant="secondary">
          Voir les demandes en cours
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ButtonLink href={routes.proposeListing(wanted.slug)} size="lg" className="w-full">
        <Icon name="box" size={18} />
        J&apos;ai ce lot
      </ButtonLink>
      <ButtonLink href={routes.depositFor(wanted.slug)} variant="secondary" className="w-full">
        Déposer un lot pour cette demande
      </ButtonLink>
      <CopyLinkButton url={shareUrl} className="w-full" />
    </div>
  );
}
