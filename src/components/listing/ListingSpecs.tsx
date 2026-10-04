import type { Listing } from "@/types/listing";
import { DefinitionList, type DefinitionRow } from "@/components/ui/DefinitionList";
import { formatCardCount, formatWeight } from "@/lib/format";
import { GAME_LABELS, LOT_TYPE_LABELS } from "@/lib/labels";
import { getConditionLabel, getLanguageLabel } from "@/lib/listing-display";

/* Un champ vide affiche un tiret et rien d'autre. Un « 0 carte » sur un lot
   scellé serait faux, et une estimation serait pire. */
export function ListingSpecs({ listing }: { listing: Listing }) {
  const rows: DefinitionRow[] = [
    { label: "Jeu", value: GAME_LABELS[listing.gameId] },
    { label: "Format", value: LOT_TYPE_LABELS[listing.lotType] },
    {
      label: "Nombre de cartes",
      value: formatCardCount(listing.cardCount),
      note: "Non compté par le vendeur",
    },
    { label: "Poids", value: formatWeight(listing.weightKg), note: "Non pesé par le vendeur" },
    { label: "État", value: getConditionLabel(listing) },
    { label: "Langue", value: getLanguageLabel(listing) },
    { label: "Ville", value: `${listing.city} (${listing.postalCode})` },
    { label: "Référence", value: listing.reference },
  ];

  return <DefinitionList rows={rows} />;
}
