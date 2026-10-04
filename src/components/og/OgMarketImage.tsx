import type { GameId } from "@/types/game";
import type { City } from "@/lib/cities";
import { OgGameChip, OgKicker } from "@/components/og/OgChip";
import { OgFacts } from "@/components/og/OgPlate";
import { OgShareFrame } from "@/components/og/OgShareFrame";
import { PANE_LAYER } from "@/components/og/OgStamp";
import { formatPrice } from "@/lib/format";
import { atCity, capitalize, countLabel } from "@/lib/french";
import { GAME_LABELS, gamePhrases } from "@/lib/labels";
import { OG_GAME_COLOR, OG_GAME_INK } from "@/lib/og-colors";
import { forSatori } from "@/lib/og-fonts";
import { CITY_PAGE_NEARBY_KM } from "@/lib/seo";

/* Ce que dessine l'image de partage d'une page de marché — un jeu, ou un jeu
   dans une ville. Des chiffres réels, datés par l'adresse de l'image : sa
   version change avec eux, et un aperçu ne garde jamais un compte périmé.
   Jamais sans ligne : la première complète le texte alternatif de l'image. */
export type MarketShare = { gameId: GameId; place: string | null; kicker: string; title: string; lines: [string, ...string[]] };

export function gameShare(
  gameId: GameId,
  { listingCount, wantedCount, prices }: { listingCount: number; wantedCount: number; prices: number[] },
): MarketShare {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const offer =
    listingCount === 0
      ? "Aucun lot en ligne pour l'instant"
      : `${countLabel(listingCount, "lot")} en ligne, ${min === max ? `à ${formatPrice(min)}` : `de ${formatPrice(min)} à ${formatPrice(max)}`}`;
  return {
    gameId,
    place: null,
    kicker: "Petites annonces",
    title: `${capitalize(gamePhrases(gameId).cards)} d'occasion`,
    lines: [offer, wantedCount > 0 ? `${countLabel(wantedCount, "acheteur")} en recherche` : "Aucun acheteur en recherche pour l'instant"],
  };
}

/* `placeName` : le nom de la page, avec son département pour un homonyme
   (« Valence (Drôme) ») ; le surtitre porte déjà le code postal. */
export function cityShare(
  gameId: GameId,
  city: Pick<City, "name" | "postalCode">,
  { inCity, nearby, wanted }: { inCity: number; nearby: number; wanted: number },
  placeName = city.name,
): MarketShare {
  const around = `à moins de ${CITY_PAGE_NEARBY_KM}\u00a0km`;
  const offer = inCity > 0 ? `${countLabel(inCity, "lot")} ${atCity(city.name)}` : `Aucun lot ${atCity(city.name)} pour l'instant`;
  const neighbours = nearby > 0 ? `${countLabel(nearby, inCity > 0 ? "autre" : "lot")} ${around}` : null;
  return {
    gameId,
    place: city.name,
    kicker: `${city.name} (${city.postalCode})`,
    title: `${capitalize(gamePhrases(gameId).cards)} d'occasion ${atCity(placeName)}`,
    lines: [
      offer,
      ...(neighbours ? [neighbours] : []),
      wanted > 0
        ? `${countLabel(wanted, "acheteur")} ${wanted > 1 ? "viendraient" : "viendrait"} jusqu'ici`
        : "Aucun acheteur en recherche dans le secteur",
    ],
  };
}

/* La colonne de gauche : la couleur du jeu, son nom, et la ville. */
function OgMarketPane({ share, hasBrandFonts }: { share: MarketShare; hasBrandFonts: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        ...PANE_LAYER,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "0 40px",
        background: OG_GAME_COLOR[share.gameId],
        color: OG_GAME_INK[share.gameId],
      }}
    >
      <div style={{ display: "flex", fontFamily: hasBrandFonts ? "Science Gothic" : undefined, fontWeight: 800, fontSize: 56, textTransform: "uppercase" }}>
        {GAME_LABELS[share.gameId]}
      </div>
      {share.place ? <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{share.place}</div> : null}
    </div>
  );
}

export function OgMarketImage({ share, hasBrandFonts }: { share: MarketShare; hasBrandFonts: boolean }) {
  return (
    <OgShareFrame
      pane={<OgMarketPane share={share} hasBrandFonts={hasBrandFonts} />}
      kicker={[<OgGameChip key="game" gameId={share.gameId} hasBrandFonts={hasBrandFonts} />, <OgKicker key="kicker" text={forSatori(share.kicker)} />]}
      title={share.title}
      details={<OgFacts lines={share.lines.map(forSatori)} />}
      hasBrandFonts={hasBrandFonts}
    />
  );
}
