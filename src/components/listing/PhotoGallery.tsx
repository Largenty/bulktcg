"use client";

import { useState } from "react";
import type { GameId } from "@/types/game";
import type { ListingPhoto } from "@/types/listing";
import { ListingImage } from "@/components/listing/ListingImage";
import { Icon } from "@/components/ui/Icon";

type PhotoGalleryProps = {
  gameId: GameId;
  photos: ListingPhoto[];
  title: string;
  watermark: string;
  /* Ce que dit l'emplacement sans photo : « Sans photo » par défaut,
     « Photos retirées » une fois l'annonce archivée — elle en avait. */
  emptyLabel?: string;
};

const NAV_BUTTON =
  "absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-[var(--radius-sm)] bg-[var(--card)] text-[var(--ink)] shadow-[var(--shadow-md)] transition-transform hover:scale-105";

/* La photo en grand, les flèches pour passer à la suivante, les miniatures
   pour sauter. Sans photo, l'emplacement aux couleurs du jeu reste : un
   cadre vide dirait moins que lui. */
export function PhotoGallery({ gameId, photos, title, watermark, emptyLabel }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const count = photos.length;
  const activePhoto = photos[activeIndex] ?? photos[0];

  function go(delta: number) {
    setActiveIndex((index) => (index + delta + count) % count);
  }

  return (
    <div className="flex flex-col gap-3">
      <figure className="relative overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)]">
        <ListingImage
          gameId={gameId}
          photo={activePhoto}
          alt={count > 0 ? `${title} — photo ${activeIndex + 1} sur ${count}` : title}
          ratio="4 / 3"
          sizes="(max-width: 1024px) 100vw, 760px"
          isPriority
          watermark={count > 0 ? watermark : undefined}
          emptyLabel={emptyLabel}
        />
        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(-1)} className={`${NAV_BUTTON} left-3`}>
              <Icon name="chevronLeft" size={20} strokeWidth={2.4} />
              <span className="sr-only">Photo précédente</span>
            </button>
            <button type="button" onClick={() => go(1)} className={`${NAV_BUTTON} right-3`}>
              <Icon name="chevronRight" size={20} strokeWidth={2.4} />
              <span className="sr-only">Photo suivante</span>
            </button>
          </>
        ) : null}
        {/* Sans photo, l'emplacement le dit lui-même : le compteur ne
            répéterait que « aucune ». */}
        {count > 0 ? (
          <figcaption
            aria-live="polite"
            className="label absolute right-2.5 top-2.5 z-20 rounded-[var(--radius-sm)] bg-[var(--card)] px-2.5 py-1 text-[var(--ink)]"
          >
            Photo {activeIndex + 1} sur {count}
          </figcaption>
        ) : null}
      </figure>

      {count > 1 ? (
        <div role="group" aria-label={`Photos de l'annonce ${title}`} className="scroll-row -mx-[var(--container-pad)] px-[var(--container-pad)] sm:mx-0 sm:px-0">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              aria-pressed={index === activeIndex}
              aria-label={`Afficher la photo ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={[
                "w-[76px] overflow-hidden rounded-[var(--radius-md)] border-[length:var(--border-width-strong)] transition-colors",
                index === activeIndex ? "border-[var(--ink)]" : "border-transparent opacity-80 hover:opacity-100",
              ].join(" ")}
            >
              <ListingImage gameId={gameId} photo={photo} alt="" ratio="1 / 1" sizes="76px" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
