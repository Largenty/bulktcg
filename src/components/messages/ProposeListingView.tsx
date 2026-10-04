import { notFound } from "next/navigation";
import { WantedContextCard } from "@/components/messages/ContextCard";
import { NewMessageLayout as Layout } from "@/components/messages/NewMessageLayout";
import { ProposeForm, type ProposalCandidate } from "@/components/messages/ProposeForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getListingsBySeller } from "@/lib/data/listings";
import { getWantedBySlug } from "@/lib/data/wanted";
import { formatPrice } from "@/lib/format";
import { explainMismatch, matchesWantedCriteria } from "@/lib/matching";
import { routes } from "@/lib/routes";

/* « J'ai ce lot », depuis une demande de recherche : proposer l'une de ses
   annonces, classées de la plus sûre à celle qui ne répond pas — et dire
   pourquoi —, ou déposer d'abord le lot. */
export async function ProposeListingView({ slug, viewerId }: { slug: string; viewerId: string }) {
  const wanted = await getWantedBySlug(slug);
  if (!wanted) notFound();
  const aside = <WantedContextCard wanted={wanted} />;

  if (wanted.buyer.id === viewerId || wanted.status !== "open") {
    return (
      <Layout title={wanted.buyer.id === viewerId ? "C'est votre demande" : "Demande fermée"} aside={aside}>
        <EmptyState
          title={wanted.buyer.id === viewerId ? "Les vendeurs vous écrivent d'ici" : "Cette demande n'attend plus de proposition"}
          reason={
            wanted.buyer.id === viewerId
              ? "Quand un vendeur propose un lot, la conversation arrive dans votre messagerie."
              : "Son auteur a trouvé, ou a arrêté de chercher."
          }
          action={<ButtonLink href={routes.wantedListings}>Voir les demandes ouvertes</ButtonLink>}
        />
      </Layout>
    );
  }

  /* Les lots publics du vendeur seulement : l'acheteur doit pouvoir ouvrir
     celui qu'on lui propose, et un lot réservé aux pros lui répondrait
     introuvable. */
  const myListings = await getListingsBySeller(viewerId);
  const candidates: ProposalCandidate[] = myListings
    .filter((listing) => listing.gameId === wanted.gameId && listing.status === "available")
    .map((listing) => {
      const outcome = matchesWantedCriteria(listing, wanted);
      return {
        id: listing.id,
        title: listing.title,
        price: formatPrice(listing.priceCents),
        fit: outcome === null ? "outside" : outcome.certainty,
        note: outcome === null ? explainMismatch(listing, wanted) : outcome.unverified,
      } satisfies ProposalCandidate;
    })
    .sort((left, right) => ["certain", "probable", "outside"].indexOf(left.fit) - ["certain", "probable", "outside"].indexOf(right.fit));

  if (candidates.length === 0) {
    return (
      <Layout title="Proposer un lot" aside={aside}>
        <EmptyState
          title="Déposez d'abord ce lot"
          reason={`Une proposition porte sur une annonce : c'est elle que ${wanted.buyer.username} ouvrira. Le formulaire sera pré-rempli avec le jeu et le format demandés.`}
          action={<ButtonLink href={routes.depositFor(wanted.slug)}>Déposer ce lot</ButtonLink>}
        />
      </Layout>
    );
  }

  return (
    <Layout title={<>Proposer un lot à <span className="display-user">{wanted.buyer.username}</span></>} aside={aside}>
      <ProposeForm
        wantedId={wanted.id}
        buyerName={wanted.buyer.username}
        candidates={candidates}
        initialBody={`Bonjour, j'ai vu votre recherche « ${wanted.title} ». J'ai un lot qui pourrait vous intéresser.`}
      />
    </Layout>
  );
}
