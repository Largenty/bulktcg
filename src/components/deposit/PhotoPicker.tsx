"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoAllowance } from "@/components/deposit/PhotoAllowance";
import { PhotoDropzone } from "@/components/deposit/PhotoDropzone";
import { PhotoTile } from "@/components/deposit/PhotoTile";
import { Icon } from "@/components/ui/Icon";
import type { DraftPhoto } from "@/lib/listing-draft";
import { convertPhotos } from "@/lib/photo-convert";
import { createLocalPhotoRef, moveItem, selectPhotoFiles } from "@/lib/photo-files";
import { FREE_PHOTOS, MAX_PHOTOS } from "@/lib/site";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type PhotoPickerProps = {
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
  /* L'option « 8 photos » est prise — cochée, ou payée à la modification. */
  hasExtra: boolean;
  onRequestExtra: () => void;
  /* Prévenu quand une conversion commence et finit : le formulaire retient
     sa publication d'ici là, sans quoi elle partirait sans les photos. */
  onPreparingChange?: (isPreparing: boolean) => void;
  watermark: string;
  error?: string;
};

function revoke(photo: DraftPhoto) {
  if (photo.previewUrl.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
}

/* Les photos, en premier : c'est ce qu'un acheteur regarde d'abord, et ce
   qui décide un vendeur à finir son annonce. On glisse, on choisit, on
   ordonne ; la première est la couverture.

   Chaque photo est convertie à l'arrivée (lib/photo-convert) : recadrée au
   format 4:3 du visuel, réduite, en WebP. L'aperçu montre donc exactement ce
   qui partira.

   En démonstration, les fichiers restent sur l'appareil — l'aperçu les
   montre, rien ne part. Avec Cloudflare Images (phase 3), lib/photo-upload
   les envoie avant la publication, et seules leurs références partent avec
   le formulaire ; d'ici là, avec la base, PhotoSection ne propose pas ce
   sélecteur. */
export function PhotoPicker({ photos, onChange, hasExtra, onRequestExtra, onPreparingChange, watermark, error }: PhotoPickerProps) {
  const max = hasExtra ? MAX_PHOTOS : FREE_PHOTOS;
  const photosRef = useRef(photos);
  const [rejections, setRejections] = useState<string[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);

  /* Les URL blob tiennent de la mémoire jusqu'à ce qu'on les rende : celles
     encore affichées sont libérées quand le formulaire disparaît. */
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach(revoke), []);

  async function add(files: File[]) {
    const { accepted, rejected } = selectPhotoFiles(files, max - photos.length);
    setRejections(rejected);
    if (accepted.length === 0) return;
    setIsPreparing(true);
    onPreparingChange?.(true);
    const { converted, rejected: unreadable } = await convertPhotos(accepted);
    setIsPreparing(false);
    onPreparingChange?.(false);
    setRejections([...rejected, ...unreadable]);
    /* Relu après la conversion : une photo a pu être retirée entre-temps. */
    const current = photosRef.current;
    onChange([
      ...current,
      ...converted
        .slice(0, max - current.length)
        .map((file) => ({ ref: createLocalPhotoRef(), previewUrl: URL.createObjectURL(file), name: file.name })),
    ]);
  }

  function remove(photo: DraftPhoto) {
    revoke(photo);
    onChange(photos.filter((candidate) => candidate !== photo));
  }

  const describedBy = error ? "photos-error" : "photos-hint";

  return (
    <div className="flex flex-col gap-4" role="group" aria-labelledby="photos-label" aria-describedby={describedBy}>
      <div className="flex items-baseline justify-between gap-3">
        <p id="photos-label" className="text-[length:var(--text-md)] font-semibold">
          Photos<span className="ml-1 text-[var(--danger)]" aria-hidden="true">*</span>
        </p>
        <p className="mono text-[length:var(--text-sm)] text-[var(--muted)]">
          {photos.length} / {max}
        </p>
      </div>

      {photos.length > 0 ? (
        <ul className="grid list-none grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.ref}
              photo={photo}
              index={index}
              count={photos.length}
              onMove={(to) => onChange(moveItem(photos, index, to))}
              onRemove={() => remove(photo)}
              isOverAllowance={index >= max}
            />
          ))}
        </ul>
      ) : null}

      {photos.length < max ? (
        <PhotoDropzone onFiles={add} describedBy={describedBy} hasError={Boolean(error)} />
      ) : null}

      {isPreparing ? (
        <p role="status" className="text-[length:var(--text-sm)] text-[var(--muted)]">
          Préparation des photos : recadrage au format de l&apos;annonce et conversion en WebP…
        </p>
      ) : null}

      <PhotoAllowance count={photos.length} hasExtra={hasExtra} onRequestExtra={onRequestExtra} />

      {error ? (
        <p id="photos-error" className="flex items-start gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--danger)]">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
      {rejections.length > 0 ? (
        <ul role="status" className="notice notice-warn list-none text-[length:var(--text-sm)]">
          {rejections.map((rejection) => (
            <li key={rejection}>{rejection}</li>
          ))}
        </ul>
      ) : null}
      <p id="photos-hint" className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
        La première photo est la couverture. {FREE_PHOTOS} photos sont gratuites, {MAX_PHOTOS} avec l&apos;option. Le
        filigrane <span className="mono">{watermark}</span> est posé sur chacune. Vos fichiers restent sur votre appareil : {DEMO_MODE_REASON}.
      </p>
    </div>
  );
}
