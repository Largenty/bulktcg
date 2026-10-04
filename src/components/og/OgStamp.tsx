import { OG_COLOR } from "@/lib/og-colors";

/* Le tampon des images de partage, celui de la vignette : l'état écrit en
   toutes lettres, posé de biais comme sur une table de brocante — « Vendu »,
   « Réservé », « Trouvé ». Sans lui, un lot vendu collé dans un groupe se
   lisait comme une offre à saisir. */
export function OgStamp({ label, hasBrandFonts }: { label: string; hasBrandFonts: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "14px 30px 12px",
        border: `6px solid ${OG_COLOR.ink}`,
        borderRadius: 8,
        background: OG_COLOR.card,
        color: OG_COLOR.ink,
        fontFamily: hasBrandFonts ? "Science Gothic" : undefined,
        fontWeight: 800,
        fontSize: 64,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        transform: "rotate(-8deg)",
      }}
    >
      {label}
    </div>
  );
}

/* Satori ne lit pas le raccourci « inset » : un calque couvre la colonne de
   gauche par ses coordonnées. */
export const PANE_LAYER = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" } as const;

/* Le tampon centré sur la colonne de gauche. */
export function OgPaneStamp({ label, hasBrandFonts }: { label: string; hasBrandFonts: boolean }) {
  return (
    <div style={{ display: "flex", ...PANE_LAYER, alignItems: "center", justifyContent: "center" }}>
      <OgStamp label={label} hasBrandFonts={hasBrandFonts} />
    </div>
  );
}
