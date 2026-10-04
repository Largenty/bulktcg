import type { Metadata } from "next";
import Link from "next/link";
import { WantedForm } from "@/components/deposit/WantedForm";
import { notFound } from "next/navigation";
import { getListings } from "@/lib/data/listings";
import { toMatchCandidates } from "@/lib/match-candidate";
import { getProfileById } from "@/lib/data/profiles";
import { requireCurrentUserId } from "@/lib/data/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Déposer une recherche",
  description:
    "Dites ce que vous cherchez, jusqu'où vous vous déplacez et votre budget. Les vendeurs du secteur le verront au moment de déposer leur lot.",
  robots: { index: false, follow: true },
};

export default async function DepositWantedPage() {
  /* Les lots en ligne sont publics : les passer au formulaire permet de
     montrer à l'acheteur ce qui répond déjà à sa demande dès la validation,
     sans aller-retour serveur. C'est le croisement du dépôt d'annonce, pris
     dans l'autre sens. */
  const userId = await requireCurrentUserId(routes.depositWanted);
  const [buyer, activeListings] = await Promise.all([getProfileById(userId), getListings({ limit: 200 })]);
  if (!buyer) notFound();

  return (
    /* Toute la largeur du gabarit, comme le dépôt d'annonce : le formulaire à
       gauche, l'aperçu de la demande à droite. */
    <div className="container pb-[var(--section-gap)] pt-7 lg:pt-10">
      <p className="eyebrow text-[var(--muted)]">Acheteur</p>
      <h1 className="display display-h2 mt-3">Déposer une recherche</h1>
      <p className="lead mt-4 text-[var(--ink-soft)]">
        Un vendeur qui dépose un lot correspondant le verra au moment de publier. Vous fermez la
        demande en un clic dès que vous avez trouvé — plus besoin de repasser fermer cinq posts
        dans cinq groupes.
      </p>
      <p className="mt-3 text-[length:var(--text-md)] text-[var(--muted)]">
        Vous avez un lot à vendre ?{" "}
        <Link href={routes.deposit} className="text-link text-[var(--ink)]">
          Déposer une annonce
        </Link>
      </p>

      <div className="mt-10">
        {/* draftId : l'identifiant que portera la demande, tiré à
            l'affichage — un double envoi retombe sur la même ligne. */}
        <WantedForm
          activeListings={toMatchCandidates(activeListings, userId)}
          buyer={buyer}
          draftId={crypto.randomUUID()}
          now={new Date().toISOString()}
        />
      </div>
    </div>
  );
}
