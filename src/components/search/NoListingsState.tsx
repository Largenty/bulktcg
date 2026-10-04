import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { countLabel } from "@/lib/french";

type NoListingsStateProps = {
  page: number;
  pageCount: number;
  activeFilterCount: number;
  /* Où ramène « Revenir à la première page ». */
  resetHref: string;
  /* L'action propre à la page, quand la première page est vide. */
  emptyAction: ReactNode;
};

/* Une recherche sans résultat est un écran à part entière, avec une action :
   il dit pourquoi — une page au-delà de la dernière, des critères trop
   serrés, ou rien en ligne — et comment en sortir. */
export function NoListingsState({ page, pageCount, activeFilterCount, resetHref, emptyAction }: NoListingsStateProps) {
  if (page > 1) {
    return (
      <EmptyState
        title="Cette page n'existe pas"
        reason={`La recherche ne compte que ${countLabel(pageCount, "page")}.`}
        action={
          <ButtonLink href={resetHref} variant="secondary">
            Revenir à la première page
          </ButtonLink>
        }
      />
    );
  }
  return (
    <EmptyState
      title="Rien ne correspond"
      reason={
        activeFilterCount > 0
          ? `Aucune annonce en ligne ne répond à ${activeFilterCount === 1 ? "votre critère" : `vos ${activeFilterCount} critères`}. Les annonces vendues sont exclues de la liste.`
          : "Aucune annonce n'est en ligne pour cette recherche."
      }
      action={emptyAction}
    />
  );
}
