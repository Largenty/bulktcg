import type { GameId } from "@/types/game";
import { GAME_LABELS } from "@/lib/labels";
import { OG_COLOR, OG_GAME_COLOR, OG_GAME_INK } from "@/lib/og-colors";

type OgChipProps = { label: string; hasBrandFonts: boolean; background?: string; color?: string };

/* Une étiquette de la ligne de type, en capitales larges comme sur la
   vignette. Pleine à la couleur d'un jeu ; sinon cernée de craie — « Recherche »,
   « Profil » : un choix de lecture, pas une couleur de jeu. */
export function OgChip({ label, hasBrandFonts, background, color = OG_COLOR.chalk }: OgChipProps) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        padding: "6px 14px",
        borderRadius: 4,
        border: `2px solid ${background ?? OG_COLOR.chalk}`,
        background: background ?? OG_COLOR.slate,
        color,
        fontSize: 22,
        fontWeight: 800,
        fontFamily: hasBrandFonts ? "Science Gothic" : undefined,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

export function OgGameChip({ gameId, hasBrandFonts }: { gameId: GameId; hasBrandFonts: boolean }) {
  return <OgChip label={GAME_LABELS[gameId]} hasBrandFonts={hasBrandFonts} background={OG_GAME_COLOR[gameId]} color={OG_GAME_INK[gameId]} />;
}

/* La précision grise qui suit les étiquettes : « Vrac · 400 cartes ». */
export function OgKicker({ text }: { text: string }) {
  return <div style={{ display: "flex", color: OG_COLOR.chalkMuted, fontSize: 24 }}>{text}</div>;
}
