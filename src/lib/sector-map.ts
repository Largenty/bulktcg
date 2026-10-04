import type { City } from "@/lib/cities";
import { getDistanceKm } from "@/lib/geo";

/* La carte du secteur d'une annonce, calculée sans fond de carte : la
   commune au centre, une zone autour d'elle — jamais l'adresse, qui se
   convient dans la conversation —, des anneaux de distance et des communes
   voisines : celles qui ont des annonces, puis les plus peuplées du dernier
   anneau. Pas de tuiles, pas de bibliothèque, aucune requête vers un tiers :
   un dessin, rendu par le serveur.

   Fonctions pures, en kilomètres : le composant les pose dans un SVG et
   place les noms par-dessus en pourcentages ; tests/sector-map.test.mjs
   les vérifie sans navigateur. */

/* La zone du rendez-vous : un secteur, pas un point. Les coordonnées du
   référentiel sont celles d'un centre-ville approché. */
export const SECTOR_RADIUS_KM = 5;
/* Le dernier anneau borne les voisines : au-delà, on n'est plus dans le
   secteur. */
export const OUTER_RING_KM = 50;
export const RING_DISTANCES_KM = [10, 25, OUTER_RING_KM] as const;
/* Le cadre s'arrête un peu au-delà du dernier anneau. */
export const MAP_HALF_SPAN_KM = 56;
/* Huit noms au plus : sur les 34 879 communes, le dernier anneau en compte
   des centaines autour d'une banlieue. La liste sous la carte donne celles
   qu'on a retenues, avec leur distance. */
export const MAX_TOWNS = 8;

/* Un nom sur la carte occupe une boîte estimée en kilomètres, pour une
   carte large d'environ 480 px : 13 px de texte y valent 1,6 km par
   caractère et 4 km de haut. L'estimation suffit à écarter deux noms qui se
   chevaucheraient ; la liste sous la carte, elle, les donne tous. */
const LABEL_KM_PER_CHAR = 1.6;
const LABEL_HEIGHT_KM = 4;
const LABEL_GAP_KM = 1.5;

export type Point = { x: number; y: number };

export type SectorTown = {
  /* Le slug de la page de la commune : deux voisines peuvent porter le même
     nom. */
  slug: string;
  name: string;
  distanceKm: number;
  point: Point;
  /* Le côté où poser le nom, ou null quand il ne tient nulle part sans en
     chevaucher un autre : le point reste, le nom est dans la liste. */
  labelSide: "right" | "left" | null;
  /* Faux quand le nom de la commune du centre recouvrirait son point : dans
     une banlieue dense, le centre a la priorité, et la voisine n'est plus
     que dans la liste sous la carte. */
  isDrawn: boolean;
};

export type SectorMap = {
  towns: SectorTown[];
  centerLabel: CenterLabelPosition;
};

/* Projection locale équirectangulaire : à l'échelle d'un secteur de 50 km,
   l'erreur est de l'ordre du mètre. Nord en haut. */
export function project(center: { latitude: number; longitude: number }, target: { latitude: number; longitude: number }): Point {
  const kmPerDegreeLongitude = 111.32 * Math.cos((center.latitude * Math.PI) / 180);
  return {
    x: (target.longitude - center.longitude) * kmPerDegreeLongitude,
    y: (center.latitude - target.latitude) * 110.574,
  };
}

/* Un point de la carte en pourcentage du cadre, pour y poser un nom en
   HTML : le texte garde alors l'échelle typographique du site. */
export function toPercent(point: Point): { left: number; top: number } {
  const span = MAP_HALF_SPAN_KM * 2;
  return { left: ((point.x + MAP_HALF_SPAN_KM) / span) * 100, top: ((point.y + MAP_HALF_SPAN_KM) / span) * 100 };
}

export type Box = { left: number; right: number; top: number; bottom: number };

/* Le nom de la commune du centre se pose sous la zone, sinon au-dessus, à
   droite ou à gauche : la première place où aucune voisine n'a son point.
   À droite d'abord, il recouvrait celui du Pontet, à 4 km d'Avignon ; sous
   la zone seulement, il recouvrait ceux de la banlieue de Paris. Un nom ne
   recouvre jamais le point d'une autre commune. */
export const CENTER_LABEL_POSITIONS = ["below", "above", "right", "left"] as const;
export type CenterLabelPosition = (typeof CENTER_LABEL_POSITIONS)[number];
const CENTER_LABEL_GAP_KM = 1.5;
const DOT_KM = 1;

const CENTER_OFFSET_KM = SECTOR_RADIUS_KM + CENTER_LABEL_GAP_KM;

export function centerLabelBox(name: string, position: CenterLabelPosition): Box {
  const width = name.length * LABEL_KM_PER_CHAR;
  switch (position) {
    case "below":
      return { left: -width / 2, right: width / 2, top: CENTER_OFFSET_KM, bottom: CENTER_OFFSET_KM + LABEL_HEIGHT_KM };
    case "above":
      return { left: -width / 2, right: width / 2, top: -CENTER_OFFSET_KM - LABEL_HEIGHT_KM, bottom: -CENTER_OFFSET_KM };
    case "right":
      return { left: CENTER_OFFSET_KM, right: CENTER_OFFSET_KM + width, top: -LABEL_HEIGHT_KM / 2, bottom: LABEL_HEIGHT_KM / 2 };
    case "left":
      return { left: -CENTER_OFFSET_KM - width, right: -CENTER_OFFSET_KM, top: -LABEL_HEIGHT_KM / 2, bottom: LABEL_HEIGHT_KM / 2 };
  }
}

/* Le point où ancrer le nom du centre, contre la zone, du côté choisi : le
   composant l'aligne selon ce côté (sector-map.css). */
export function centerLabelAnchor(position: CenterLabelPosition): Point {
  switch (position) {
    case "below":
      return { x: 0, y: CENTER_OFFSET_KM };
    case "above":
      return { x: 0, y: -CENTER_OFFSET_KM };
    case "right":
      return { x: CENTER_OFFSET_KM, y: 0 };
    case "left":
      return { x: -CENTER_OFFSET_KM, y: 0 };
  }
}

export function dotBox(point: Point): Box {
  return { left: point.x - DOT_KM, right: point.x + DOT_KM, top: point.y - DOT_KM, bottom: point.y + DOT_KM };
}

export function labelBox(point: Point, name: string, side: "right" | "left"): Box {
  const width = name.length * LABEL_KM_PER_CHAR;
  const left = side === "right" ? point.x + LABEL_GAP_KM : point.x - LABEL_GAP_KM - width;
  return { left, right: left + width, top: point.y - LABEL_HEIGHT_KM / 2, bottom: point.y + LABEL_HEIGHT_KM / 2 };
}

export const overlaps = (first: Box, second: Box) =>
  first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;

const inFrame = (box: Box) =>
  box.left >= -MAP_HALF_SPAN_KM && box.right <= MAP_HALF_SPAN_KM && box.top >= -MAP_HALF_SPAN_KM && box.bottom <= MAP_HALF_SPAN_KM;

/* Les voisines qu'on retient, parmi les communes du dernier anneau : celles
   qui ont des annonces (`populatedSlugs`), de la plus proche à la plus
   lointaine, puis les plus peuplées. Prises par la distance seule, les plus
   proches d'un village seraient des hameaux dont personne ne connaît le nom.
   Une égalité se tranche par la distance, puis par le slug : la carte d'une
   commune est la même à chaque rendu. */
function byPriority(populatedSlugs: ReadonlySet<string>) {
  return (left: { city: City; distanceKm: number }, right: { city: City; distanceKm: number }) => {
    const leftPopulated = populatedSlugs.has(left.city.slug);
    const rightPopulated = populatedSlugs.has(right.city.slug);
    if (leftPopulated !== rightPopulated) return leftPopulated ? -1 : 1;
    if (leftPopulated) return left.distanceKm - right.distanceKm || left.city.slug.localeCompare(right.city.slug);
    return right.city.population - left.city.population || left.distanceKm - right.distanceKm || left.city.slug.localeCompare(right.city.slug);
  };
}

export function buildSectorMap(center: City, cities: readonly City[], populatedSlugs: ReadonlySet<string> = new Set()): SectorMap {
  const nearby = cities
    .filter((city) => city.communeCode !== center.communeCode)
    .map((city) => ({ city, distanceKm: getDistanceKm(center, city), point: project(center, city) }))
    .filter(({ distanceKm }) => distanceKm <= OUTER_RING_KM)
    .toSorted(byPriority(populatedSlugs))
    .slice(0, MAX_TOWNS)
    /* Les noms se placent ensuite de la plus proche à la plus lointaine. */
    .toSorted((left, right) => left.distanceKm - right.distanceKm || left.city.slug.localeCompare(right.city.slug))
    .map((town) => ({ ...town, dot: dotBox(town.point) }));

  /* Le nom du centre d'abord, là où aucun point ne le gêne ; puis les
     voisines, de la plus proche à la plus lointaine, dans la place qui reste
     — sans chevaucher un nom ni le point d'une autre commune. Chaque voisine
     porte son point et s'il reste dessiné : rien ne se recolle par le rang. */
  const collisions = (position: CenterLabelPosition) =>
    nearby.filter(({ dot }) => overlaps(centerLabelBox(center.name, position), dot)).length;
  const centerLabel = CENTER_LABEL_POSITIONS.reduce((best, position) => (collisions(position) < collisions(best) ? position : best));
  const centerBox = centerLabelBox(center.name, centerLabel);
  const candidates = nearby.map((town) => ({ ...town, isDrawn: !overlaps(centerBox, town.dot) }));
  const placed: Box[] = [centerBox];
  const towns = candidates.map((town) => {
    const { city, distanceKm, point, isDrawn } = town;
    const isFree = (box: Box) =>
      inFrame(box) &&
      !placed.some((other) => overlaps(box, other)) &&
      !candidates.some((other) => other !== town && other.isDrawn && overlaps(box, other.dot));
    const labelSide = isDrawn ? ((["right", "left"] as const).find((side) => isFree(labelBox(point, city.name, side))) ?? null) : null;
    if (labelSide) placed.push(labelBox(point, city.name, labelSide));
    return { slug: city.slug, name: city.name, distanceKm, point, labelSide, isDrawn };
  });

  return { towns, centerLabel };
}
