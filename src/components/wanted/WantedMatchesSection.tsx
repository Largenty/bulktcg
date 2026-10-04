import type { Listing } from "@/types/listing";
import type { WantedListing } from "@/types/wanted";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { gamePhrases, withGame } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* Sous une demande, les lots déjà en ligne qui y répondent : le croisement
   qui justifie tout le reste. Sans résultat, la page dit pourquoi et mène
   aux lots du jeu, plutôt qu'une grille vide. */
export function WantedMatchesSection({ wanted, listings }: { wanted: WantedListing; listings: Listing[] }) {
  return (
    <section className="mt-[var(--section-gap)]">
      <SectionHeader
        eyebrow="Déjà en ligne"
        title="Ce qui correspond"
        size="md"
        description="Croisement automatique sur le jeu, le format, le budget et la distance acceptée."
      />
      {listings.length > 0 ? (
        <ListingGrid listings={listings} priorityCount={0} />
      ) : (
        <EmptyState
          title="Rien ne correspond aujourd'hui"
          reason={`Aucun ${withGame("lot", wanted.gameId)} en ligne ne rentre dans ce budget et ce rayon de ${wanted.maxDistanceKm} km.`}
          action={
            <ButtonLink href={routes.game(wanted.gameId)} variant="secondary">
              Voir {gamePhrases(wanted.gameId).all}
            </ButtonLink>
          }
        />
      )}
    </section>
  );
}
