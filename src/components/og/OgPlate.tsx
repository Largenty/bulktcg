import { formatPrice } from "@/lib/format";
import { OG_COLOR } from "@/lib/og-colors";

/* Un montant en pavé, comme sur la vignette : plein pour le prix d'un lot,
   cerné pour le budget d'une demande — et pour le prix d'un lot vendu, qui
   perd son aplat. Satori ne rend pas l'espace fine insécable d'Intl avant
   « € » : elle est rendue par la marge. */
export function OgPlate({ cents, isOutlined, hasBrandFonts }: { cents: number; isOutlined: boolean; hasBrandFonts: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "10px 16px 8px",
        borderRadius: 4,
        border: `4px solid ${OG_COLOR.chalk}`,
        background: isOutlined ? OG_COLOR.slate : OG_COLOR.chalk,
        fontSize: 60,
        fontWeight: 800,
        fontFamily: hasBrandFonts ? "Science Gothic" : undefined,
        color: isOutlined ? OG_COLOR.chalk : OG_COLOR.ink,
      }}
    >
      <span style={{ display: "flex" }}>{formatPrice(cents).replace(/[\s  ]*€$/, "")}</span>
      <span style={{ display: "flex", marginLeft: 12 }}>€</span>
    </div>
  );
}

/* Les lignes posées à droite du pavé, ou seules quand il n'y en a pas : la
   première en clair, les suivantes plus discrètes. Elles prennent la place
   qui reste, et y passent à la ligne au lieu de sortir de l'image. */
export function OgFacts({ lines }: { lines: string[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
      {lines.map((line, index) => (
        <div
          key={line}
          style={{ display: "flex", fontSize: index === 0 ? 30 : 24, fontWeight: index === 0 ? 600 : 400, color: index === 0 ? OG_COLOR.chalkSoft : OG_COLOR.chalkMuted }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
