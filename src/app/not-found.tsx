import { WayOut } from "@/components/layout/WayOut";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/routes";

/* Deux colonnes, sur toute la largeur : ce qui s'est passé, et de quoi
   repartir. Bridée à 880 px, la page laissait vide la moitié d'un grand
   écran. « Carton vide » répondait à l'ancien nom, Carton Plein ; le
   boîtier vide est celui d'une carte gradée sans sa carte. */
export default function NotFound() {
  return (
    <div className="container pb-[var(--section-gap)] pt-10 lg:pt-16">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-start lg:gap-14">
        <div>
          <p className="eyebrow text-[var(--muted)]">Erreur 404</p>
          <h1 className="display display-h1 mt-3">Boîtier vide</h1>
          <div className="mt-8">
            <EmptyState
              title="Rien à cette adresse"
              reason="Cette page n'existe pas, ou l'annonce a été retirée par son auteur. Les annonces vendues, elles, restent en ligne : leur lien a été partagé ailleurs, et il vaut mieux qu'il dise « vendu » plutôt que de tomber ici."
              action={
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href={routes.listings}>Voir les annonces</ButtonLink>
                  <ButtonLink href="/" variant="secondary">
                    Retour à l&apos;accueil
                  </ButtonLink>
                </div>
              }
            />
          </div>
        </div>
        <WayOut />
      </div>
    </div>
  );
}
