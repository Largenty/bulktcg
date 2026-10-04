import type { Listing } from "@/types/listing";
import { OgGameChip, OgKicker } from "@/components/og/OgChip";
import { OgListingFooter } from "@/components/og/OgListingFooter";
import { OgShareFrame } from "@/components/og/OgShareFrame";
import { OgPaneStamp, PANE_LAYER } from "@/components/og/OgStamp";
import { EXPIRED_LABEL, LOT_TYPE_LABELS } from "@/lib/labels";
import { getVolumeLabel } from "@/lib/listing-display";
import { OG_COLOR, OG_GAME_COLOR } from "@/lib/og-colors";
import { SHARE_IMAGE_SIZE, SHARE_PANE_WIDTH, forSatori } from "@/lib/og-fonts";
import { buildWatermarkLabel } from "@/lib/watermark";

type OgListingImageProps = {
  listing: Listing;
  /* Le tampon : « Vendu », « Réservé », « Expirée » — ou rien, en ligne et
     disponible (getListingStateLabel). */
  state: string | null;
  /* La photo de couverture déjà ré-encodée (lib/og-fonts), ou null : la
     fenêtre garde alors la couleur du jeu. */
  photo: string | null;
  hasBrandFonts: boolean;
};

/* La photo, et ce que la vignette y pose : un voile sur un lot vendu, le
   tampon de l'état, et le filigrane du vendeur — une image reprise par un
   autre se trahit à ce pseudo. */
function OgPhotoPane({ listing, state, photo, hasBrandFonts }: OgListingImageProps) {
  return (
    <div style={{ display: "flex", ...PANE_LAYER, background: OG_GAME_COLOR[listing.gameId] }}>
      {photo ? (
        <img src={photo} alt="" width={SHARE_PANE_WIDTH} height={SHARE_IMAGE_SIZE.height} style={{ objectFit: "cover", width: SHARE_PANE_WIDTH, height: SHARE_IMAGE_SIZE.height }} />
      ) : null}
      {listing.status === "sold" || state === EXPIRED_LABEL ? (
        <div style={{ display: "flex", ...PANE_LAYER, background: OG_COLOR.slate, opacity: 0.45 }} />
      ) : null}
      {state !== null ? <OgPaneStamp label={state} hasBrandFonts={hasBrandFonts} /> : null}
      <div style={{ display: "flex", position: "absolute", left: 0, bottom: 0, padding: "8px 16px", background: OG_COLOR.slate, color: OG_COLOR.chalkSoft, fontSize: 22 }}>
        {buildWatermarkLabel(listing)}
      </div>
    </div>
  );
}

/* L'image de partage d'une annonce, celle que Facebook et WhatsApp
   montrent quand le vendeur colle son lien : la photo, le jeu, le titre, le
   prix, la commune. */
export function OgListingImage({ listing, state, photo, hasBrandFonts }: OgListingImageProps) {
  return (
    <OgShareFrame
      pane={<OgPhotoPane listing={listing} state={state} photo={photo} hasBrandFonts={hasBrandFonts} />}
      kicker={[
        <OgGameChip key="game" gameId={listing.gameId} hasBrandFonts={hasBrandFonts} />,
        <OgKicker key="volume" text={forSatori(`${LOT_TYPE_LABELS[listing.lotType]} · ${getVolumeLabel(listing)}`)} />,
      ]}
      title={listing.title}
      details={<OgListingFooter listing={listing} hasBrandFonts={hasBrandFonts} />}
      hasBrandFonts={hasBrandFonts}
    />
  );
}
