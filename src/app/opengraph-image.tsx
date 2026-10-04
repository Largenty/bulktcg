import { ImageResponse } from "next/og";
import { NAMED_GAME_IDS } from "@/types/game";
import { OgBrandMark } from "@/components/og/OgBrandMark";
import { GAME_LABELS } from "@/lib/labels";
import { OG_COLOR, OG_GAME_COLOR, OG_TRANCHE } from "@/lib/og-colors";
import { loadOpenGraphFonts } from "@/lib/og-fonts";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — lots, vrac et scellé de cartes à collectionner`;

/* L'image de partage du site lui-même : ce qu'on voit quand quelqu'un colle
   l'adresse de l'accueil dans un groupe. La marque, la promesse, les jeux. */
export default async function OpenGraphImage() {
  const fonts = await loadOpenGraphFonts();
  const hasBrandFonts = fonts.length > 0;
  const label = hasBrandFonts ? "Science Gothic" : undefined;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: OG_COLOR.slate }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, padding: "0 84px" }}>
          <OgBrandMark size={260} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: label, fontSize: 118, lineHeight: 1, color: OG_COLOR.chalk }}>
              <span style={{ fontWeight: 800 }}>BULK</span>
              <span style={{ fontWeight: 400 }}>TCG</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 40, lineHeight: 1.2, color: OG_COLOR.chalkSoft, fontFamily: hasBrandFonts ? "Space Grotesk" : undefined, fontWeight: 600 }}>
              <span style={{ display: "flex" }}>Lots, vrac et scellé de cartes à collectionner,</span>
              <span style={{ display: "flex" }}>de la main à la main.</span>
            </div>
            {/* Satori ignore « gap » sur une ligne qui passe à la ligne : les
                marges portent l'espacement, et chaque jeu a sa pastille. */}
            <div style={{ display: "flex", flexWrap: "wrap", marginTop: 26, maxWidth: 700, fontSize: 22, color: OG_COLOR.chalkMuted, fontFamily: label, fontWeight: 800, textTransform: "uppercase" }}>
              {NAMED_GAME_IDS.map((gameId) => (
                <span key={gameId} style={{ display: "flex", alignItems: "center", marginRight: 26, marginBottom: 8 }}>
                  <span style={{ display: "flex", width: 14, height: 14, borderRadius: 3, background: OG_GAME_COLOR[gameId], marginRight: 10 }} />
                  {GAME_LABELS[gameId]}
                </span>
              ))}
              {/* « Autre » n'est pas un jeu : il se dit, sans pastille. */}
              <span style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>+ autres jeux</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", height: 14 }}>
          {OG_TRANCHE.map((color) => (
            <div key={color} style={{ display: "flex", flex: 1, background: color }} />
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: hasBrandFonts ? fonts : undefined },
  );
}
