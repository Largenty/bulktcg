import type { Listing } from "@/types/listing";
import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { MobileActionBar } from "@/components/listing/MobileActionBar";
import { OwnerActions } from "@/components/listing/OwnerActions";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WaitlistButton } from "@/components/listing/WaitlistButton";
import { REPLY_BLOCK_REASONS } from "@/lib/conversation-display";
import { findConversationForListing } from "@/lib/data/conversations";
import { isViewerActivePro } from "@/lib/data/listings";
import { getCurrentUserId } from "@/lib/data/session";
import { isOnWaitlist } from "@/lib/data/waitlist";
import { isExpired } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

/* Ce que la fiche propose dépend de qui la regarde. L'acheteur a un seul
   geste — écrire au vendeur à propos de ce lot — et le lien à partager. Le
   vendeur, lui, n'a rien à se demander : il voit le statut en un clic, la
   modification et le partage, là où il se serait proposé de se contacter
   lui-même.

   Phase 2 : la session se lit dans les cookies. La fiche est déjà rendue à
   chaque requête — le nonce de la CSP —, et la lire n'y change rien (voir
   supabase/README.md, § 7). */
export async function ViewerActions({ listing }: { listing: Listing }) {
  const viewerId = await getCurrentUserId();
  const shareUrl = `${SITE_URL}${routes.listing(listing.slug)}`;
  const isOwner = viewerId === listing.seller.id;

  if (isOwner) return <OwnerActions listing={listing} shareUrl={shareUrl} />;

  if (listing.status === "sold") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] bg-[var(--card)] p-5">
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          Ce lot est parti. La page reste en ligne parce que le lien a été partagé ailleurs — elle dit
          simplement la vérité au lieu de disparaître.
        </p>
        <ButtonLink href={routes.game(listing.gameId)} variant="secondary">
          Voir les lots en ligne
        </ButtonLink>
      </div>
    );
  }

  /* Expirée : son vendeur ne l'a pas prolongée, le lot n'est peut-être plus
     à vendre. Plus de nouveau message — la base refuse d'ouvrir un fil —,
     ni de lien à faire circuler. Le fil déjà ouvert, lui, reste dans la
     messagerie. */
  if (isExpired(listing, Date.now())) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] bg-[var(--card)] p-5">
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          <strong className="font-semibold text-[var(--ink)]">Cette annonce n&apos;est plus en ligne.</strong> Son vendeur ne
          l&apos;a pas prolongée : le lot est peut-être parti ailleurs. La page reste lisible parce que son lien a pu être
          partagé.
        </p>
        <ButtonLink href={routes.game(listing.gameId)} variant="secondary">
          Voir les lots en ligne
        </ButtonLink>
      </div>
    );
  }

  /* Réservée aux pros depuis qu'on en a parlé : la fiche reste lisible pour
     qui a un fil à son sujet, mais un particulier n'y écrit plus. La même
     règle et la même phrase que la messagerie. Pas de lien à partager : il
     répondrait « introuvable » aux particuliers qui le recevraient. */
  if (listing.audience === "pros" && viewerId && !(await isViewerActivePro(viewerId))) {
    const conversation = await findConversationForListing(listing.id, viewerId);
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] p-5">
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          <strong className="font-semibold text-[var(--ink)]">Ce lot est désormais réservé aux professionnels.</strong>{" "}
          {REPLY_BLOCK_REASONS["pros-only"]}
        </p>
        {conversation ? (
          <ButtonLink href={routes.conversation(conversation.id)} variant="secondary" className="w-full">
            Relire votre conversation
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  /* Réservé pour quelqu'un d'autre : plus de nouveau message, qui relancerait
     le vendeur pour rien. On s'inscrit, et on est prévenu avec tous les
     autres inscrits si le lot redevient disponible. La personne pour qui il
     est réservé, elle, garde son fil. */
  if (listing.status === "reserved" && (viewerId === null || listing.reservedForId !== viewerId)) {
    const [conversation, isWaiting] = viewerId
      ? await Promise.all([findConversationForListing(listing.id, viewerId), isOnWaitlist(listing.id, viewerId)])
      : [null, false];
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] p-5">
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          <strong className="font-semibold text-[var(--ink)]">Ce lot est réservé pour un autre acheteur.</strong> Le vendeur
          ne reçoit plus de nouvelles demandes à son sujet ; si la réservation tombe, tous les inscrits sont prévenus en
          même temps.
        </p>
        <WaitlistButton listingId={listing.id} isOnWaitlist={isWaiting} isBlock />
        {conversation ? (
          <ButtonLink href={routes.conversation(conversation.id)} variant="secondary" className="w-full">
            Relire votre conversation
          </ButtonLink>
        ) : null}
        <CopyLinkButton url={shareUrl} className="w-full" />
      </div>
    );
  }

  const conversation =
    listing.status === "reserved" && viewerId ? await findConversationForListing(listing.id, viewerId) : null;
  const contactHref = conversation ? routes.conversation(conversation.id) : routes.contactSeller(listing.slug);

  return (
    <div className="flex flex-col gap-3">
      {conversation ? (
        <p className="text-[length:var(--text-md)] font-semibold">Ce lot vous est réservé.</p>
      ) : null}
      <ButtonLink href={contactHref} size="lg" className="w-full">
        <Icon name="message" size={18} />
        {conversation ? "Reprendre la conversation" : "Contacter le vendeur"}
      </ButtonLink>
      <CopyLinkButton url={shareUrl} className="w-full" />
      <MobileActionBar price={listing.priceCents} href={contactHref} label="Contacter" />
    </div>
  );
}
