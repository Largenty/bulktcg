import { MARK_CARD_STROKE, MARK_LAYERS, MARK_SIDE_SHADE, MARK_TOP, MARK_TOP_CARD, MARK_VIEWBOX } from "@/lib/brand-mark";
import { OG_COLOR, OG_GAME_COLOR, mixHex } from "@/lib/og-colors";

/* Le symbole pour les images générées — favicon, icône, partage. Même
   géométrie que LogoMark (lib/brand-mark), couleurs littérales de
   lib/og-colors : Satori ne lit pas les variables CSS. */
export function OgBrandMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX}>
      <polygon points={MARK_TOP} fill={OG_COLOR.chalk} />
      <polygon
        points={MARK_TOP_CARD}
        fill="none"
        stroke={mixHex(OG_COLOR.ink, OG_COLOR.chalk, 0.28)}
        strokeWidth={MARK_CARD_STROKE}
        strokeLinejoin="round"
      />
      {MARK_LAYERS.map(({ gameId, front, side }) => (
        <g key={gameId}>
          <rect {...front} fill={OG_GAME_COLOR[gameId]} />
          <polygon points={side} fill={mixHex(OG_GAME_COLOR[gameId], OG_COLOR.ink, MARK_SIDE_SHADE)} />
        </g>
      ))}
    </svg>
  );
}
