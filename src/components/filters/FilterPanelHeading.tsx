/* Le titre du panneau « Affiner » et, dès qu'un critère est choisi, son
   « Tout effacer ». Ventes et demandes n'effacent pas les mêmes paramètres :
   chaque panneau dit lesquels. */
export function FilterPanelHeading({ hasActiveFilters, onClearAll }: { hasActiveFilters: boolean; onClearAll: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="display display-h3">Affiner</h2>
      {hasActiveFilters ? (
        <button type="button" onClick={onClearAll} className="text-link text-[length:var(--text-sm)] text-[var(--ink-soft)]">
          Tout effacer
        </button>
      ) : null}
    </div>
  );
}
