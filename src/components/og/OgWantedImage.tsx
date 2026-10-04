import type { GameId } from "@/types/game";
import type { WantedListing } from "@/types/wanted";
import { OgChip, OgGameChip } from "@/components/og/OgChip";
import { OgFacts, OgPlate } from "@/components/og/OgPlate";
import { OgShareFrame } from "@/components/og/OgShareFrame";
import { OgPaneStamp, PANE_LAYER } from "@/components/og/OgStamp";
import { LOT_TYPE_LABELS, WANTED_STATUS_LABELS } from "@/lib/labels";
import { OG_GAME_COLOR, OG_GAME_INK } from "@/lib/og-colors";
import { forSatori } from "@/lib/og-fonts";

/* Ce que dessine l'image de partage d'une demande de recherche — celle que
   l'acheteur colle dans un groupe Facebook. Même lecture que sa vignette :
   l'emplacement vide du lot qu'on cherche, le budget en pavé cerné, jamais
   plein — ce n'est pas un prix —, et « sans budget annoncé » plutôt qu'un
   chiffre inventé. */
export type WantedShare = {
  gameId: GameId;
  title: string;
  budgetCents: number | null;
  lines: string[];
  stamp: string | null;
};

export function wantedShare(wanted: WantedListing): WantedShare {
  const buyer = `Par @${wanted.buyer.username}${wanted.buyer.isPro ? ` · Pro${wanted.buyer.companyName ? `, ${wanted.buyer.companyName}` : ""}` : ""}`;
  return {
    gameId: wanted.gameId,
    title: wanted.title,
    budgetCents: wanted.maxPriceCents,
    lines: [
      ...(wanted.maxPriceCents === null ? ["Sans budget annoncé"] : []),
      `${wanted.city} (${wanted.postalCode})`,
      `${wanted.lotType ? LOT_TYPE_LABELS[wanted.lotType] : "Tous formats"} · jusqu'à ${wanted.maxDistanceKm}\u00a0km`,
      buyer,
    ],
    /* Une demande close reste en ligne pour qui avait le lien : l'image dit
       qu'elle est trouvée, ou abandonnée. */
    stamp: wanted.status === "open" ? null : WANTED_STATUS_LABELS[wanted.status],
  };
}

/* La couleur du jeu, et l'emplacement vide du lot qu'on cherche, en
   pointillés. */
function OgWantedPane({ share, hasBrandFonts }: { share: WantedShare; hasBrandFonts: boolean }) {
  const ink = OG_GAME_INK[share.gameId];
  return (
    <div style={{ display: "flex", ...PANE_LAYER, alignItems: "center", justifyContent: "center", background: OG_GAME_COLOR[share.gameId] }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 300,
          height: 400,
          border: `6px dashed ${ink}`,
          borderRadius: 14,
          color: ink,
          fontSize: 160,
          fontWeight: 800,
          fontFamily: hasBrandFonts ? "Science Gothic" : undefined,
        }}
      >
        ?
      </div>
      {share.stamp ? <OgPaneStamp label={share.stamp} hasBrandFonts={hasBrandFonts} /> : null}
    </div>
  );
}

export function OgWantedImage({ share, hasBrandFonts }: { share: WantedShare; hasBrandFonts: boolean }) {
  const lines = share.lines.map(forSatori);
  return (
    <OgShareFrame
      pane={<OgWantedPane share={share} hasBrandFonts={hasBrandFonts} />}
      kicker={[
        <OgChip key="wanted" label="Recherche" hasBrandFonts={hasBrandFonts} />,
        <OgGameChip key="game" gameId={share.gameId} hasBrandFonts={hasBrandFonts} />,
      ]}
      title={share.title}
      details={
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 24 }}>
          {share.budgetCents === null ? null : <OgPlate cents={share.budgetCents} isOutlined hasBrandFonts={hasBrandFonts} />}
          <OgFacts lines={lines} />
        </div>
      }
      hasBrandFonts={hasBrandFonts}
    />
  );
}
