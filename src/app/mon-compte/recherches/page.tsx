import type { Metadata } from "next";
import { BuyerWantedRow } from "@/components/wanted/BuyerWantedRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterTabs } from "@/components/filters/FilterTabs";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { STAGE_PARAM, getWantedStageUrl, resolveWantedStage } from "@/lib/account-stages";
import { requireCurrentUserId } from "@/lib/data/session";
import { countListingsMatchingWanted, getWantedListingsByBuyer } from "@/lib/data/wanted";
import { countLabel } from "@/lib/french";
import { WANTED_STATUS_LABELS } from "@/lib/labels";
import { WANTED_STATUSES, type WantedListing } from "@/types/wanted";
import { routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Mes recherches" };

type PageProps = { searchParams: Promise<SearchParams> };

export default async function AccountWantedPage({ searchParams }: PageProps) {
  const userId = await requireCurrentUserId(routes.accountWanted);
  const [wantedListings, params] = await Promise.all([getWantedListingsByBuyer(userId), searchParams]);
  const stage = resolveWantedStage(params[STAGE_PARAM]);

  /* Le croisement inverse, compté une fois par demande : ce qui est déjà en
     ligne et y répond. Sans lui, une demande de recherche ne serait qu'un
     panneau d'affichage que personne ne relit. */
  const matchCounts = new Map(
    await Promise.all(
      wantedListings.map(async (wanted) => [wanted.id, await countListingsMatchingWanted(wanted)] as const),
    ),
  );
  const row = (wanted: WantedListing) => (
    <BuyerWantedRow key={wanted.id} wanted={wanted} matchCount={matchCounts.get(wanted.id) ?? 0} />
  );

  const openWanted = wantedListings.filter((wanted) => wanted.status === "open");
  const closedWanted = wantedListings.filter((wanted) => wanted.status !== "open");
  const stageWanted = stage ? wantedListings.filter((wanted) => wanted.status === stage) : [];

  const pills = [
    { href: routes.accountWanted, label: "Tout", count: wantedListings.length, isCurrent: stage === null },
    ...WANTED_STATUSES.map((status) => ({
      href: getWantedStageUrl(status),
      label: WANTED_STATUS_LABELS[status],
      count: wantedListings.filter((wanted) => wanted.status === status).length,
      isCurrent: stage === status,
    })),
  ];

  return (
    <>
      <FilterTabs label="Étapes des recherches" tabs={pills} />
      {stage ? (
        <>
          <SectionHeader
            size="md"
            title={WANTED_STATUS_LABELS[stage]}
            description={`${countLabel(stageWanted.length, "demande")} à cette étape.`}
          />
          {stageWanted.length > 0 ? (
            <ul className="flex list-none flex-col gap-3">{stageWanted.map(row)}</ul>
          ) : (
            <EmptyState title="Aucune demande à cette étape" reason="Le compteur au-dessus suit chaque changement de statut." />
          )}
        </>
      ) : (
        <>
          <SectionHeader
            size="md"
            title="En recherche"
            description="Un vendeur qui dépose un lot correspondant le voit au moment de publier. Quand vous avez trouvé, un clic sur « Trouvé » ferme la demande sans supprimer la page."
          />
          {openWanted.length > 0 ? (
            <ul className="flex list-none flex-col gap-3">{openWanted.map(row)}</ul>
          ) : (
            <EmptyState
              title="Aucune recherche ouverte"
              reason="Déposer ce que vous cherchez évite de repasser chaque jour sur la liste : les vendeurs du secteur le voient au moment de publier leur lot."
              action={<ButtonLink href={routes.depositWanted}>Déposer une recherche</ButtonLink>}
            />
          )}
          {closedWanted.length > 0 ? (
            <div className="mt-12">
              <SectionHeader
                size="md"
                title="Fermées"
                description={`${countLabel(closedWanted.length, "demande close", "demandes closes")}. Elles restent ici : rouvrir coûte un clic, et leur lien continue de répondre pour ceux qui l'avaient gardé.`}
              />
              <ul className="flex list-none flex-col gap-3">{closedWanted.map(row)}</ul>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
