"use client";

import { Icon } from "@/components/ui/Icon";
import type { DraftPhoto } from "@/lib/listing-draft";

type PhotoTileProps = {
  photo: DraftPhoto;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  /* Au-delà des photos gratuites, l'option décochée : la photo reste, marquée,
     jusqu'à ce que le vendeur la retire ou reprenne l'option. */
  isOverAllowance?: boolean;
};

const TOOL =
  "grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--card)] text-[var(--ink)] shadow-[var(--shadow-sm)] hover:bg-[var(--tint)] disabled:opacity-40";

/* Une photo choisie, avec de quoi la déplacer et la retirer au clavier comme
   à la souris : des boutons nommés, pas un glisser-déposer qu'un lecteur
   d'écran ne sait pas faire. */
export function PhotoTile({ photo, index, count, onMove, onRemove, isOverAllowance = false }: PhotoTileProps) {
  const position = index + 1;

  return (
    <li className="relative overflow-hidden rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--tint)]">
      {/* Une <img> simple : l'URL est un blob local, que l'optimiseur
          d'images de Next ne sait pas lire. */}
      <img
        src={photo.previewUrl}
        alt={`Photo ${position} : ${photo.name}`}
        className={`aspect-square w-full object-cover ${isOverAllowance ? "opacity-40" : ""}`}
      />
      {isOverAllowance ? (
        <span className="label absolute bottom-2 left-2 rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--ink)] bg-[var(--card)] px-2 py-0.5 text-[var(--ink)]">
          Hors forfait
        </span>
      ) : null}
      {index === 0 ? (
        <span className="label absolute left-2 top-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-2 py-0.5 text-[var(--on-ink)]">
          Couverture
        </span>
      ) : null}
      <div className="absolute right-2 top-2 flex gap-1.5">
        <button type="button" onClick={onRemove} className={TOOL}>
          <Icon name="close" size={16} />
          <span className="sr-only">Retirer la photo {position}</span>
        </button>
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1.5">
        <button type="button" onClick={() => onMove(index - 1)} disabled={index === 0} className={TOOL}>
          <Icon name="chevronLeft" size={16} />
          <span className="sr-only">Avancer la photo {position}</span>
        </button>
        <button type="button" onClick={() => onMove(index + 1)} disabled={index === count - 1} className={TOOL}>
          <Icon name="chevronRight" size={16} />
          <span className="sr-only">Reculer la photo {position}</span>
        </button>
      </div>
    </li>
  );
}
