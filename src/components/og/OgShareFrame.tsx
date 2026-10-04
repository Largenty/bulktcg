import type { ReactNode } from "react";
import { OgBrandBar } from "@/components/og/OgBrandBar";
import { OG_COLOR } from "@/lib/og-colors";
import { SHARE_PANE_WIDTH } from "@/lib/og-fonts";

/* Un titre de 90 caractères, la limite du formulaire, tenait sur cinq
   lignes et passait sous le prix : la taille descend avec la longueur. */
export function titleSize(title: string): number {
  if (title.length > 72) return 46;
  if (title.length > 54) return 54;
  return 62;
}

type OgShareFrameProps = {
  /* La colonne de gauche, 520 × 630 : la photo d'un lot, la couleur d'un
     jeu, les initiales d'un compte. */
  pane: ReactNode;
  /* La ligne de type : étiquettes, puis précision. Un tableau et non un
     fragment : Satori n'aplatit pas un fragment, et l'espacement du rang
     sautait. */
  kicker: ReactNode[];
  title: string;
  /* Ce qui se lit au-dessus de la barre de marque : un prix, un lieu. */
  details: ReactNode;
  hasBrandFonts: boolean;
};

/* Le gabarit de toutes les images de partage : la même lecture qu'une
   vignette — le type, le titre, le chiffre, le lieu — et la même signature
   au pied. */
export function OgShareFrame({ pane, kicker, title, details, hasBrandFonts }: OgShareFrameProps) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: OG_COLOR.slate }}>
      <div style={{ display: "flex", position: "relative", width: SHARE_PANE_WIDTH, height: "100%" }}>{pane}</div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "52px 56px 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>{kicker}</div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: titleSize(title),
              lineHeight: 1.04,
              fontWeight: 600,
              fontFamily: hasBrandFonts ? "Space Grotesk" : undefined,
              letterSpacing: "-0.01em",
              color: OG_COLOR.chalk,
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", padding: "0 56px 34px" }}>{details}</div>
          <OgBrandBar hasBrandFonts={hasBrandFonts} />
        </div>
      </div>
    </div>
  );
}
