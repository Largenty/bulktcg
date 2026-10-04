import type { CSSProperties } from "react";
import type { GameId } from "@/types/game";
import { Icon } from "@/components/ui/Icon";
import { citiesNear, getCityByPair } from "@/lib/cities";
import { getActiveCommuneSlugs } from "@/lib/data/listings";
import { formatDistance } from "@/lib/format";
import { fromCity } from "@/lib/french";
import { gameColorVariable } from "@/lib/game-style";
import {
  MAP_HALF_SPAN_KM,
  OUTER_RING_KM,
  RING_DISTANCES_KM,
  SECTOR_RADIUS_KM,
  buildSectorMap,
  centerLabelAnchor,
  toPercent,
} from "@/lib/sector-map";

type ListingSectorProps = {
  city: string;
  postalCode: string;
  gameId: GameId;
};

const SPAN = MAP_HALF_SPAN_KM * 2;

/* Le lieu d'une annonce, qui ouvre la carte de son secteur : la commune,
   une zone autour d'elle aux couleurs du jeu — jamais l'adresse —, les
   anneaux de 10, 25 et 50 km et les communes voisines. Un popover natif :
   ni script, ni bibliothèque de cartes, ni requête vers un tiers ; la carte
   détaillée d'OpenStreetMap n'est qu'un lien. Sans coordonnées connues, le
   lieu reste un texte. Les voisines : celles qui ont des annonces, puis les
   plus peuplées du dernier anneau (lib/sector-map.ts). */
export async function ListingSector({ city: cityName, postalCode, gameId }: ListingSectorProps) {
  const city = getCityByPair(cityName, postalCode);
  if (!city) return <span>{`${cityName} (${postalCode})`}</span>;

  const around = citiesNear(city, OUTER_RING_KM).map((entry) => entry.city);
  const { towns, centerLabel } = buildSectorMap(city, around, await getActiveCommuneSlugs());
  const popoverId = `secteur-${city.slug}`;
  const coordinates = `${city.latitude.toFixed(4)}/${city.longitude.toFixed(4)}`;
  const openStreetMapUrl = `https://www.openstreetmap.org/?mlat=${city.latitude.toFixed(4)}&mlon=${city.longitude.toFixed(4)}#map=12/${coordinates}`;

  return (
    <>
      <button type="button" popoverTarget={popoverId} className="sector-trigger">
        <Icon name="pin" size={16} />
        {`${city.name} (${postalCode})`}
        <span className="sr-only"> — voir le secteur sur une carte</span>
      </button>

      <div id={popoverId} popover="auto" role="dialog" aria-labelledby={`${popoverId}-titre`} className="sector-popover">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={`${popoverId}-titre`} className="display display-h3">
            Le secteur {fromCity(city.name)}
          </h2>
          <button type="button" popoverTarget={popoverId} popoverTargetAction="hide" aria-label="Fermer la carte" className="btn btn-quiet btn-sm">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="sector-map" style={{ "--sector-color": gameColorVariable(gameId) } as CSSProperties}>
          <svg viewBox={`${-MAP_HALF_SPAN_KM} ${-MAP_HALF_SPAN_KM} ${SPAN} ${SPAN}`} aria-hidden="true">
            {RING_DISTANCES_KM.map((km) => (
              <circle key={km} cx={0} cy={0} r={km} className="sector-ring" />
            ))}
            <circle cx={0} cy={0} r={SECTOR_RADIUS_KM} className="sector-zone" />
            {towns
              .filter((town) => town.isDrawn)
              .map((town) => (
                <circle key={town.slug} cx={town.point.x} cy={town.point.y} r={0.9} className="sector-town" />
              ))}
            <circle cx={0} cy={0} r={1.2} className="sector-center" />
          </svg>
          <div aria-hidden="true" className="mono text-[length:var(--text-xs)] text-[var(--muted)]">
            {RING_DISTANCES_KM.map((km) => {
              const position = toPercent({ x: 0, y: -km });
              return (
                <span key={km} className="sector-ring-label" style={{ left: `${position.left}%`, top: `${position.top}%` }}>
                  {`${km}\u00a0km`}
                </span>
              );
            })}
          </div>
          <div aria-hidden="true" className="text-[length:var(--text-sm)]">
            <span className="sector-label font-semibold" data-side={centerLabel} style={{ left: "50%", top: `${toPercent(centerLabelAnchor(centerLabel)).top}%` }}>
              {city.name}
            </span>
            {towns.map((town) => {
              if (!town.labelSide) return null;
              const position = toPercent(town.point);
              return (
                <span key={town.slug} className="sector-label text-[var(--ink-soft)]" data-town="" data-side={town.labelSide} style={{ left: `${position.left}%`, top: `${position.top}%` }}>
                  {town.name}
                </span>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          {`Zone indicative de ${SECTOR_RADIUS_KM}\u00a0km autour du centre ${fromCity(city.name)}\u00a0: le lieu exact du rendez-vous se convient dans la conversation, jamais sur la page.`}
        </p>
        {towns.length > 0 ? (
          <p className="mt-2 text-[length:var(--text-md)] leading-relaxed">
            {`À moins de ${OUTER_RING_KM}\u00a0km\u00a0: `}
            {towns.map((town) => `${town.name} (${formatDistance(town.distanceKm)})`).join(", ")}.
          </p>
        ) : null}
        <a href={openStreetMapUrl} target="_blank" rel="noopener noreferrer" className="text-link mt-3 inline-flex items-center gap-1.5 text-[length:var(--text-md)]">
          Ouvrir la carte détaillée sur OpenStreetMap
          <Icon name="external" size={16} />
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      </div>
    </>
  );
}
