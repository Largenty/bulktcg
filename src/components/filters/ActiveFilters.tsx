import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { getEditionById } from "@/lib/editions";
import { formatPrice } from "@/lib/format";
import { CONDITION_SHORT_LABELS, LANGUAGE_SHORT_LABELS, LOT_TYPE_LABELS, TAG_LABELS } from "@/lib/labels";
import { QUERY_PARAM, buildListingHref, type ResolvedListingSearch } from "@/lib/listing-query";
import type { SearchParams } from "@/lib/search-params";

type ActiveFiltersProps = {
  basePath: string;
  params: SearchParams;
  resolved: ResolvedListingSearch;
};

type Chip = { label: string; remove: Record<string, null> };

/* Chaque critère appliqué, en pastille qu'un clic retire. Ce sont des liens :
   ils marchent sans JavaScript et le retour arrière les défait. Le jeu n'y
   figure pas — il porte le titre de la page, on ne le « retire » pas d'ici. */
function buildChips({ query, origin, radiusKm }: ResolvedListingSearch): Chip[] {
  const chips: Chip[] = [];
  if (query.search) chips.push({ label: `« ${query.search} »`, remove: { [QUERY_PARAM.search]: null } });
  if (origin) {
    chips.push({
      label: `${origin.name} · ${radiusKm} km`,
      remove: { [QUERY_PARAM.city]: null, [QUERY_PARAM.radius]: null },
    });
  }
  if (query.lotType) chips.push({ label: LOT_TYPE_LABELS[query.lotType], remove: { [QUERY_PARAM.lotType]: null } });
  if (query.editionId) {
    const edition = getEditionById(query.editionId);
    chips.push({ label: edition ? `Série ${edition.code}` : "Série", remove: { [QUERY_PARAM.edition]: null } });
  }
  if (query.tag) chips.push({ label: TAG_LABELS[query.tag], remove: { [QUERY_PARAM.tag]: null } });
  if (query.condition) {
    chips.push({ label: `État ${CONDITION_SHORT_LABELS[query.condition]}`, remove: { [QUERY_PARAM.condition]: null } });
  }
  if (query.language) {
    chips.push({ label: `Langue ${LANGUAGE_SHORT_LABELS[query.language]}`, remove: { [QUERY_PARAM.language]: null } });
  }
  if (query.minPriceCents !== undefined) {
    chips.push({ label: `Dès ${formatPrice(query.minPriceCents)}`, remove: { [QUERY_PARAM.minPrice]: null } });
  }
  if (query.maxPriceCents !== undefined) {
    chips.push({ label: `Jusqu'à ${formatPrice(query.maxPriceCents)}`, remove: { [QUERY_PARAM.maxPrice]: null } });
  }
  if (query.openToTrade) chips.push({ label: "Ouvert à l'échange", remove: { [QUERY_PARAM.trade]: null } });
  return chips;
}

export function ActiveFilters({ basePath, params, resolved }: ActiveFiltersProps) {
  const chips = buildChips(resolved);
  if (chips.length === 0) return null;

  const keep = new Set<string>([QUERY_PARAM.game, QUERY_PARAM.sort]);
  const clearAll = Object.fromEntries(
    Object.keys(params)
      .filter((key) => !keep.has(key))
      .map((key) => [key, null]),
  );

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filtres appliqués" role="group">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={buildListingHref(basePath, params, chip.remove)}
          className="pill pill-sm border-[var(--ink)] bg-[var(--card)]"
          aria-label={`Retirer le filtre ${chip.label}`}
        >
          {chip.label}
          <Icon name="close" size={14} strokeWidth={2.4} />
        </Link>
      ))}
      <Link href={buildListingHref(basePath, params, clearAll)} className="text-link ml-1 text-[length:var(--text-sm)]">
        Tout effacer
      </Link>
    </div>
  );
}
