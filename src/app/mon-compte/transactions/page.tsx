import type { Metadata } from "next";
import { DealListRow } from "@/components/deal/DealListRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterTabs } from "@/components/filters/FilterTabs";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getDealsForUser } from "@/lib/data/deals";
import { requireCurrentUserId } from "@/lib/data/session";
import { DEAL_VIEW_PARAM, getDealViewUrl, matchesDealView, resolveDealView, type DealView } from "@/lib/deal-display";
import { routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Ventes et achats" };

type PageProps = { searchParams: Promise<SearchParams> };

const VIEW_LABELS: Record<DealView, string> = { ventes: "Ventes", achats: "Achats", "a-noter": "À noter" };

/* Ce qui s'est conclu, dans les deux sens, comme la page des commandes d'un
   site de vente : chaque ligne mène à son récapitulatif, et « À noter »
   rassemble ce qui attend encore votre avis. */
export default async function AccountDealsPage({ searchParams }: PageProps) {
  const userId = await requireCurrentUserId(routes.accountDeals);
  const [deals, params] = await Promise.all([getDealsForUser(userId), searchParams]);
  const view = resolveDealView(params[DEAL_VIEW_PARAM]);
  const shown = deals.filter((deal) => matchesDealView(deal, userId, view));

  const pills = [
    { href: routes.accountDeals, label: "Tout", count: deals.length, isCurrent: view === null },
    ...(Object.keys(VIEW_LABELS) as DealView[]).map((key) => ({
      href: getDealViewUrl(key),
      label: VIEW_LABELS[key],
      count: deals.filter((deal) => matchesDealView(deal, userId, key)).length,
      isCurrent: view === key,
    })),
  ];

  return (
    <>
      <SectionHeader
        size="md"
        title="Ventes et achats conclus"
        description="Une vente existe ici dès que son vendeur l'a clôturée en désignant l'acheteur. Les deux parties peuvent alors se noter, une fois chacune."
      />
      <FilterTabs label="Filtrer les ventes et achats" tabs={pills} />
      {shown.length > 0 ? (
        <ul className="flex list-none flex-col gap-3">
          {shown.map((deal) => (
            <DealListRow key={deal.id} deal={deal} viewerId={userId} />
          ))}
        </ul>
      ) : (
        <EmptyState
          title={view === "a-noter" ? "Aucun avis en attente" : "Rien de conclu pour le moment"}
          reason={
            view === "a-noter"
              ? "Vous avez noté chaque personne avec qui vous avez conclu une vente."
              : "Quand un lot part, passez-le en « Vendu » depuis vos annonces et désignez l'acheteur : la vente arrive ici, et vous pourrez vous noter l'un l'autre."
          }
          action={<ButtonLink href={routes.accountListings}>Voir mes annonces</ButtonLink>}
        />
      )}
    </>
  );
}
