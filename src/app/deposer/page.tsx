import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/deposit/ListingForm";
import { Icon } from "@/components/ui/Icon";
import { canAttachPhotos } from "@/lib/data/listing-mutations";
import { getProfileById } from "@/lib/data/profiles";
import { getEditionCatalog } from "@/lib/editions";
import { requireCurrentUserId } from "@/lib/data/session";
import { getWantedBySlug, getWantedListings } from "@/lib/data/wanted";
import { toListingDefaultsFromWanted } from "@/lib/form-defaults";
import { notFound } from "next/navigation";
import { ROUTE_PARAM, routes } from "@/lib/routes";
import { firstParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Déposer une annonce",
  description:
    "Rédigez votre lot une seule fois, obtenez un lien permanent à partager où vous voulez, et changez le statut en un clic.",
  robots: { index: false, follow: true },
};

type PageProps = { searchParams: Promise<SearchParams> };

export default async function DepositPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const forWantedSlug = firstParam(params[ROUTE_PARAM.forWanted]);
  const userId = await requireCurrentUserId(forWantedSlug ? routes.depositFor(forWantedSlug) : routes.deposit);

  /* Les demandes ouvertes sont publiques : les passer au formulaire permet
     d'annoncer au vendeur qui cherche son lot dès la validation. */
  const [seller, openWantedListings, forWanted] = await Promise.all([
    getProfileById(userId),
    getWantedListings({ limit: 100 }),
    forWantedSlug ? getWantedBySlug(forWantedSlug) : Promise.resolve(null),
  ]);
  if (!seller) notFound();

  return (
    /* Toute la largeur du gabarit : le formulaire à gauche, l'aperçu et les
       options à droite. Bridée à 1 200 px, la page laissait un quart d'écran
       vide sur un moniteur de 1 600. */
    <div className="container pb-[var(--section-gap)] pt-7 lg:pt-10">
      <p className="eyebrow text-[var(--muted)]">Vendeur</p>
      <h1 className="display display-h2 mt-3">Déposer une annonce</h1>
      <p className="lead mt-4 text-[var(--ink-soft)]">
        Une fois pour toutes. Vous obtenez un lien que vous collez où vous voulez, et vous ne
        reposterez plus jamais la même annonce.
      </p>

      {forWanted ? (
        <p className="notice mt-6 flex gap-3 text-[length:var(--text-md)]">
          <Icon name="search" size={20} className="mt-0.5 shrink-0" />
          <span>
            En réponse à la demande de <strong className="font-semibold">{forWanted.buyer.username}</strong> :{" "}
            <Link href={routes.wanted(forWanted.slug)} className="text-link">
              {forWanted.title}
            </Link>
            . Le jeu et le format demandés sont déjà choisis ; une fois le lot publié, vous pourrez le lui
            proposer.
          </span>
        </p>
      ) : null}

      <div className="mt-10">
        <ListingForm
          openWantedListings={openWantedListings}
          seller={seller}
          defaults={forWanted ? toListingDefaultsFromWanted(forWanted) : undefined}
          editionCatalog={forWanted ? getEditionCatalog(forWanted.gameId) : null}
          /* L'identifiant que portera l'annonce, tiré à l'affichage : un
             double envoi retombe sur la même ligne. */
          draftId={crypto.randomUUID()}
          photoUploads={canAttachPhotos()}
          now={new Date().toISOString()}
        />
      </div>
    </div>
  );
}
