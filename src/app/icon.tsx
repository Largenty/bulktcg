import { ImageResponse } from "next/og";
import { OgBrandMark } from "@/components/og/OgBrandMark";
import { ICON_SIZES } from "@/lib/icon-sizes";
import { OG_COLOR } from "@/lib/og-colors";

/* Deux tailles du même favicon, écrites dans lib/icon-sizes.ts : next.config.ts
   y lit les adresses qu'il garde en cache. */
export function generateImageMetadata() {
  return ICON_SIZES.map((side) => ({ id: String(side), size: { width: side, height: side }, contentType: "image/png" }));
}

/* La brique sur un carré d'ardoise. Sans ce fond, sa face supérieure couleur
   craie disparaissait sur un onglet clair. */
export default async function Icon({ id }: { id: Promise<string> }) {
  const side = Number(await id);
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: OG_COLOR.slate,
          borderRadius: Math.round(side * 0.22),
        }}
      >
        <OgBrandMark size={Math.round(side * 0.875)} />
      </div>
    ),
    { width: side, height: side },
  );
}
