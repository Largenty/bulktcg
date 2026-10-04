import { notFound, redirect } from "next/navigation";
import { ContactForm } from "@/components/messages/ContactForm";
import { ListingContextCard } from "@/components/messages/ContextCard";
import { NewMessageLayout as Layout } from "@/components/messages/NewMessageLayout";
import { WaitlistButton } from "@/components/listing/WaitlistButton";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { findConversationForListing } from "@/lib/data/conversations";
import { getListingForViewer } from "@/lib/data/listings";
import { isOnWaitlist } from "@/lib/data/waitlist";
import { isExpired } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";

/* « Contacter le vendeur », depuis une fiche : écrire à propos de ce lot —
   ou, s'il n'attend plus de demande, dire pourquoi et quoi faire. */
export async function ContactSellerView({ slug, viewerId }: { slug: string; viewerId: string }) {
  const listing = await getListingForViewer(slug, viewerId);
  if (!listing) notFound();

  /* Écrire deux fois au même vendeur pour le même lot reprend le fil. */
  const existing = await findConversationForListing(listing.id, viewerId);
  if (existing) redirect(routes.conversation(existing.id));

  const aside = <ListingContextCard listing={listing} />;

  if (listing.seller.id === viewerId) {
    return (
      <Layout title="C'est votre annonce" aside={aside}>
        <EmptyState
          title="Vous ne pouvez pas vous écrire"
          reason="Les acheteurs vous contactent depuis cette fiche. Pour changer le statut ou le prix, passez par votre compte."
          action={<ButtonLink href={routes.accountListings}>Gérer mes annonces</ButtonLink>}
        />
      </Layout>
    );
  }

  /* Expirée : son vendeur ne l'a pas prolongée, et ne la vend peut-être
     plus. Qui avait déjà écrit a été renvoyé vers son fil juste au-dessus. */
  if (isExpired(listing, Date.now())) {
    return (
      <Layout title="Cette annonce n'est plus en ligne" aside={aside}>
        <EmptyState
          title="Le vendeur ne reçoit plus de demandes à son sujet"
          reason="Il ne l'a pas prolongée : le lot est peut-être parti ailleurs. D'autres lots du même jeu sont peut-être en ligne près de chez vous."
          action={<ButtonLink href={routes.game(listing.gameId)}>Voir les lots en ligne</ButtonLink>}
        />
      </Layout>
    );
  }

  /* Réservé : plus de nouvelle conversation, la liste d'attente à la place.
     Qui avait déjà écrit a été renvoyé vers son fil juste au-dessus. */
  if (listing.status === "reserved" && listing.reservedForId !== viewerId) {
    return (
      <Layout title="Ce lot est réservé" aside={aside}>
        <div className="flex flex-col gap-4">
          <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
            {listing.seller.username} l&apos;a réservé pour un autre acheteur et ne reçoit plus de nouvelles demandes à son
            sujet. Si la réservation tombe, tous les inscrits sont prévenus en même temps.
          </p>
          <WaitlistButton listingId={listing.id} isOnWaitlist={await isOnWaitlist(listing.id, viewerId)} />
        </div>
      </Layout>
    );
  }

  if (listing.status === "sold") {
    return (
      <Layout title="Ce lot est parti" aside={aside}>
        <EmptyState
          title="Le vendeur ne reçoit plus de demandes"
          reason="Ce lot a été vendu. D'autres lots du même jeu sont peut-être en ligne près de chez vous."
          action={<ButtonLink href={routes.game(listing.gameId)}>Voir les lots en ligne</ButtonLink>}
        />
      </Layout>
    );
  }

  return (
    <Layout title={<>Écrire à <span className="display-user">{listing.seller.username}</span></>} aside={aside}>
      <ContactForm
        listingId={listing.id}
        sellerName={listing.seller.username}
        initialBody={`Bonjour, votre lot « ${listing.title} » m'intéresse.`}
      />
    </Layout>
  );
}
