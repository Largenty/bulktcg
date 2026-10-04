import type { Listing } from "@/types/listing";
import { AdSlot } from "@/components/ads/AdSlot";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { Pagination } from "@/components/search/Pagination";
import { QUERY_PARAM } from "@/lib/listing-query";
import type { SearchParams } from "@/lib/search-params";

/* La coupure tombe après deux rangées pleines : assez bas pour que la
   grille se lise d'abord, assez haut pour que l'encart soit vu. Ce nombre
   ne place que l'encart dans la liste lue par un lecteur d'écran ; à
   l'écran, c'est la rangée qui le place (.grid-insert), et il ne sert qu'à
   décider si la page a assez d'annonces pour en porter un. */
const MID_GRID_AD_AFTER = 6;

type ListingResultsProps = {
  listings: Listing[];
  page: number;
  pageCount: number;
  distanceByListingId?: Map<string, number>;
  searchParams: SearchParams;
  /* Où pointe la pagination. */
  basePath: string;
  /* Absent sur une page sans inventaire publicitaire : la grille reste
     alors d'un seul tenant. */
  midAdSlotId?: string;
};

export function ListingResults({
  listings,
  page,
  pageCount,
  distanceByListingId,
  searchParams,
  basePath,
  midAdSlotId,
}: ListingResultsProps) {
  const hasMidAd = midAdSlotId !== undefined && listings.length > MID_GRID_AD_AFTER;
  return (
    <>
      <ListingGrid
        listings={listings}
        distanceByListingId={distanceByListingId}
        density="compact"
        insert={
          hasMidAd && midAdSlotId
            ? { after: MID_GRID_AD_AFTER, node: <AdSlot format="banner" slotId={midAdSlotId} className="my-2" /> }
            : undefined
        }
      />

      <Pagination
        basePath={basePath}
        searchParams={searchParams}
        currentPage={page}
        pageCount={pageCount}
        pageParam={QUERY_PARAM.page}
      />
    </>
  );
}
