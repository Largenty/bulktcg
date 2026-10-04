import type { WantedListing } from "@/types/wanted";
import { DefinitionList } from "@/components/ui/DefinitionList";
import { Icon } from "@/components/ui/Icon";
import { formatCardCount, formatPrice } from "@/lib/format";
import { gameColorVariable, gameInkVariable } from "@/lib/game-style";
import { GAME_LABELS, LOT_TYPE_LABELS, UNKNOWN_VALUE } from "@/lib/labels";

/* Des titres de section plus petits que le titre de la demande, comme sur
   une fiche d'annonce. */
const SECTION_TITLE = "display mb-4 text-[length:var(--text-xl)]";

/* La demande elle-même : l'emplacement vide du lot qu'on cherche, en tête le
   bandeau à la couleur du jeu, puis ses critères et ce que l'acheteur en
   dit. « Peu importe » est une réponse ; un budget non annoncé, une
   absence, qui s'écrit « — ». */
export function WantedDetails({ wanted }: { wanted: WantedListing }) {
  const criteria = [
    { label: "Jeu", value: GAME_LABELS[wanted.gameId] },
    { label: "Format", value: wanted.lotType === null ? "Peu importe" : LOT_TYPE_LABELS[wanted.lotType] },
    { label: "Volume minimum", value: wanted.minCardCount === null ? "Peu importe" : formatCardCount(wanted.minCardCount) },
    {
      label: "Budget maximum",
      value: wanted.maxPriceCents === null ? UNKNOWN_VALUE : formatPrice(wanted.maxPriceCents),
      note: "Pas de budget annoncé",
    },
    { label: "Point de départ", value: `${wanted.city} (${wanted.postalCode})` },
    { label: "Se déplace jusqu'à", value: `${wanted.maxDistanceKm} km` },
  ];

  return (
    <article className="min-w-0 self-start overflow-hidden rounded-[var(--radius-xl)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] [grid-area:details]">
      <p
        className="label flex items-center gap-2 px-5 py-3 font-semibold sm:px-8"
        style={{ backgroundColor: gameColorVariable(wanted.gameId), color: gameInkVariable(wanted.gameId) }}
      >
        <Icon name="search" size={16} strokeWidth={2.4} />
        Demande de recherche · {GAME_LABELS[wanted.gameId]}
      </p>
      <div className="flex flex-col gap-9 p-5 sm:p-8">
        <section>
          <h2 className={SECTION_TITLE}>Ce qui est cherché</h2>
          <DefinitionList rows={criteria} columns={3} isCompact />
        </section>
        <section>
          <h2 className={SECTION_TITLE}>Ce qu&apos;en dit l&apos;acheteur</h2>
          <p className="whitespace-pre-line text-[length:var(--text-body)] leading-relaxed">{wanted.description}</p>
        </section>
      </div>
    </article>
  );
}
