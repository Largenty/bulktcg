import { formatPrice } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { EXTRA_PHOTOS_PRICE_CENTS, FREE_PHOTOS, MAX_PHOTOS } from "@/lib/site";

type PhotoAllowanceProps = {
  count: number;
  /* L'option est prise : cochée, ou déjà payée à la modification. */
  hasExtra: boolean;
  onRequestExtra: () => void;
};

/* Trois photos sont gratuites. Le sélecteur le dit au moment où ça compte —
   quand les trois sont posées — et propose l'option à côté des photos, au
   lieu de refuser la quatrième sans explication. Si l'option est décochée
   après coup, il dit combien de photos elle portait. */
export function PhotoAllowance({ count, hasExtra, onRequestExtra }: PhotoAllowanceProps) {
  if (hasExtra || count < FREE_PHOTOS) return null;
  const over = count - FREE_PHOTOS;

  return (
    <div role="status" className="notice flex flex-wrap items-center justify-between gap-3 text-[length:var(--text-md)]">
      <p className="min-w-0 flex-1">
        {over > 0
          ? `${countLabel(over, "photo")} au-delà des ${FREE_PHOTOS} gratuites : gardez-les avec l'option, ou retirez-les.`
          : `Les ${FREE_PHOTOS} photos gratuites sont posées. L'option en ouvre ${MAX_PHOTOS - FREE_PHOTOS} de plus.`}
      </p>
      {/* La zone de dépôt a disparu : ce bouton reprend son identifiant, que
          le focus rejoint quand la validation refuse les photos en trop. */}
      <button id="photo-picker" type="button" onClick={onRequestExtra} className="btn btn-secondary btn-sm">
        Passer à {MAX_PHOTOS} photos · {formatPrice(EXTRA_PHOTOS_PRICE_CENTS)}
      </button>
    </div>
  );
}
