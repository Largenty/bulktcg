import { OgBrandMark } from "@/components/og/OgBrandMark";
import { OG_COLOR, OG_TRANCHE } from "@/lib/og-colors";

/* Le pied de toute image de partage : la marque, la promesse, et la tranche
   qui signe le site. Satori ne lit que des styles en ligne et des valeurs
   littérales (lib/og-colors). */
export function OgBrandBar({ hasBrandFonts, tagline = "En main propre, sans envoi" }: { hasBrandFonts: boolean; tagline?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 56px",
          background: OG_COLOR.slateRaised,
          fontSize: 24,
          color: OG_COLOR.chalkSoft,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: hasBrandFonts ? "Science Gothic" : undefined, fontSize: 28, color: OG_COLOR.chalk }}>
          <OgBrandMark size={40} />
          <span style={{ fontWeight: 800 }}>BULK</span>
          <span style={{ fontWeight: 400, marginLeft: -12 }}>TCG</span>
        </span>
        <span style={{ display: "flex" }}>{tagline}</span>
      </div>
      <div style={{ display: "flex", height: 10 }}>
        {OG_TRANCHE.map((color) => (
          <div key={color} style={{ display: "flex", flex: 1, background: color }} />
        ))}
      </div>
    </div>
  );
}
