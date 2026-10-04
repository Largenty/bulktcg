import { ImageResponse } from "next/og";
import { OgBrandMark } from "@/components/og/OgBrandMark";
import { OG_COLOR } from "@/lib/og-colors";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/* L'icône d'écran d'accueil : iOS arrondit lui-même les coins, le carré
   d'ardoise reste donc plein. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: OG_COLOR.slate }}>
        <OgBrandMark size={150} />
      </div>
    ),
    size,
  );
}
