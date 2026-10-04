import Image from "next/image";
import type { GameId } from "@/types/game";
import type { ListingPhoto } from "@/types/listing";
import { PhotoBlock } from "@/components/listing/PhotoBlock";
import { hashString } from "@/lib/random";

type ListingImageProps = {
  gameId: GameId;
  photo: ListingPhoto | undefined;
  alt: string;
  /* Ratio CSS fixe, par exemple "4 / 3". Absent quand c'est le conteneur, par
     ses classes, qui décide du format — la vignette est carrée sur mobile et
     en 4:3 au-delà. */
  ratio?: string;
  sizes: string;
  /* La photo du premier écran — celle de la fiche, qui fait le LCP : chargée
     d'emblée et en priorité haute. Next 16 a retiré `priority`, qui la
     préchargeait par un <link> sans fetchpriority ; elle est dans le HTML
     initial, et l'analyseur d'avance du navigateur la trouve seul. */
  isPriority?: boolean;
  /* Filigrane : la ligne de crédit en bas de la photo. Absent sur les
     miniatures, où il serait illisible et couvrirait la moitié de l'image. */
  watermark?: string;
  /* Le filigrane se retire sous 640 px quand la photo y devient miniature. */
  isWatermarkHiddenOnMobile?: boolean;
  isFaded?: boolean;
  /* « Sans photo » par défaut. Une autre mention — « Photos retirées » —
     est plus longue : elle ne se montre que dans un grand emplacement. */
  emptyLabel?: string;
  className?: string;
};

/* La photo d'une annonce, avec son emplacement abstrait dessous : le bloc
   reste visible pendant le chargement et sert de rendu complet quand
   l'annonce n'a aucune photo. Il le dit alors en toutes lettres — sans la
   mention, on attend une image qui ne viendra pas.

   Sans photo, la graine vient du texte alternatif (le titre, le plus
   souvent) : avec une graine fixe, toutes les annonces sans photo
   montraient le même motif.

   Rien que des <span> : la miniature d'une galerie est un bouton, qui
   n'admet que du contenu phrasé. .photo-frame les fait bloc. */
export function ListingImage({
  gameId,
  photo,
  alt,
  ratio,
  sizes,
  isPriority = false,
  watermark,
  isWatermarkHiddenOnMobile = false,
  isFaded = false,
  emptyLabel,
  className,
}: ListingImageProps) {
  return (
    <span
      className={["photo-frame relative overflow-hidden", isFaded ? "opacity-60 saturate-[0.3]" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      <PhotoBlock gameId={gameId} seed={photo?.seed ?? hashString(alt || gameId)} className="absolute inset-0" />
      {photo?.url ? (
        <Image
          src={photo.url}
          alt={alt}
          fill
          sizes={sizes}
          loading={isPriority ? "eager" : "lazy"}
          fetchPriority={isPriority ? "high" : undefined}
          className="object-cover"
        />
      ) : (
        <span className={`label ${emptyLabel ? "lot-window-empty lot-window-empty-wide" : "lot-window-empty"}`}>{emptyLabel ?? "Sans photo"}</span>
      )}
      {watermark && photo?.url ? (
        /* Le contenu du filigrane est déjà lu ailleurs — nom du vendeur et
           référence de l'annonce — d'où l'aria-hidden. */
        <span aria-hidden="true" className={`watermark-strip ${isWatermarkHiddenOnMobile ? "hidden sm:flex" : ""}`}>
          <span className="watermark">{watermark}</span>
        </span>
      ) : null}
    </span>
  );
}
