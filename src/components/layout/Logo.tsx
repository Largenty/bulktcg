import Link from "next/link";
import {
  MARK_CARD_STROKE,
  MARK_LAYERS,
  MARK_OUTLINE,
  MARK_OUTLINE_STROKE,
  MARK_SIDE_SHADE,
  MARK_TOP,
  MARK_TOP_CARD,
  MARK_VIEWBOX,
} from "@/lib/brand-mark";
import { gameColorVariable } from "@/lib/game-style";
import { SITE_NAME } from "@/lib/site";

/* Le symbole : une brique de cartes dont la tranche porte les couleurs des
   jeux (voir lib/brand-mark). C'est un objet imprimé : sa carte du dessus
   reste blanche et ses ombres d'encre, quel que soit le thème. Sur l'en-tête
   blanc, un contour le détache ; il suit l'encre de la page. */
export function LogoMark({ size = 36, isOutlined = false }: { size?: number; isOutlined?: boolean }) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
      <polygon points={MARK_TOP} fill="var(--print-white)" />
      <polygon
        points={MARK_TOP_CARD}
        fill="none"
        stroke="var(--print-ink)"
        strokeOpacity="0.28"
        strokeWidth={MARK_CARD_STROKE}
        strokeLinejoin="round"
      />
      {MARK_LAYERS.map(({ gameId, front, side }) => {
        const color = gameColorVariable(gameId);
        return (
          <g key={gameId}>
            <rect {...front} fill={color} />
            <polygon
              points={side}
              fill={`color-mix(in srgb, ${color} ${MARK_SIDE_SHADE * 100}%, var(--print-ink))`}
            />
          </g>
        );
      })}
      {isOutlined ? (
        <polygon
          points={MARK_OUTLINE}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={MARK_OUTLINE_STROKE}
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

/* Le logotype : un seul mot, « BULK » en graisse pleine et « TCG » en
   graisse légère, de la même couleur. Le gris essayé d'abord éteignait la
   moitié du nom. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={["logo-word", className].filter(Boolean).join(" ")}>
      Bulk<span className="logo-word-light">TCG</span>
    </span>
  );
}

/* Dans l'en-tête : blanc en clair, ardoise en sombre — le logotype prend
   l'encre de la page, et le symbole son contour. */
export function Logo() {
  return (
    <Link
      href="/"
      aria-label={`${SITE_NAME}, accueil`}
      className="group inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)]"
    >
      <span className="transition-transform duration-150 group-hover:-translate-y-0.5">
        <LogoMark size={34} isOutlined />
      </span>
      <Wordmark className="text-[var(--ink)]" />
    </Link>
  );
}
