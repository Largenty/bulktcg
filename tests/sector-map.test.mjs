import assert from "node:assert/strict";
import test from "node:test";
import { CITIES, citiesNear, getCityByPair, getCityBySlug, listCities } from "../src/lib/cities.ts";
import { getDistanceKm } from "../src/lib/geo.ts";
import {
  CENTER_LABEL_POSITIONS,
  MAP_HALF_SPAN_KM,
  MAX_TOWNS,
  OUTER_RING_KM,
  SECTOR_RADIUS_KM,
  buildSectorMap,
  centerLabelBox,
  dotBox,
  labelBox,
  overlaps,
  project,
  toPercent,
} from "../src/lib/sector-map.ts";
import { render, text } from "./markup.mjs";

/* La carte du secteur d'une annonce : une projection locale, les communes
   voisines, et des noms qui ne se chevauchent jamais. Sans navigateur. */

const avignon = getCityBySlug("avignon");

/* Les candidates d'une carte, comme ListingSector les prend : toutes les
   communes du dernier anneau. */
const around = (center) => citiesNear(center, OUTER_RING_KM).map((entry) => entry.city);

test("la projection garde le nord en haut, l'est à droite, et les distances réelles", () => {
  const orange = getCityBySlug("orange");
  const cavaillon = getCityBySlug("cavaillon");
  assert.ok(project(avignon, orange).y < 0, "Orange, au nord, n'est pas en haut");
  assert.ok(project(avignon, cavaillon).x > 0, "Cavaillon, à l'est, n'est pas à droite");
  for (const city of [orange, cavaillon, getCityBySlug("carpentras")]) {
    const { x, y } = project(avignon, city);
    const distance = getDistanceKm(avignon, city);
    assert.ok(Math.abs(Math.hypot(x, y) - distance) / distance < 0.01, `${city.name} : ${Math.hypot(x, y)} km au lieu de ${distance}`);
  }
  assert.deepEqual(toPercent({ x: 0, y: 0 }), { left: 50, top: 50 });
});

test("les voisines sont les plus peuplées du dernier anneau, sans la commune du centre, posées de la plus proche à la plus lointaine", () => {
  /* Prises par la distance seule parmi 34 879 communes, les voisines d'un
     village étaient des hameaux. */
  const candidates = around(avignon);
  const { towns } = buildSectorMap(avignon, candidates);
  assert.equal(towns.length, MAX_TOWNS);
  assert.ok(towns.every((town) => town.name !== "Avignon" && town.distanceKm <= OUTER_RING_KM));
  const distances = towns.map((town) => town.distanceKm);
  assert.deepEqual(distances, distances.toSorted((a, b) => a - b));
  const kept = new Set(towns.map((town) => town.slug));
  const smallest = Math.min(...candidates.filter((city) => kept.has(city.slug)).map((city) => city.population));
  const skipped = candidates.filter((city) => !kept.has(city.slug) && city.communeCode !== avignon.communeCode);
  assert.ok(skipped.every((city) => city.population <= smallest), "une commune plus peuplée que les retenues est laissée de côté");
  assert.ok(towns.some((town) => town.name === "Orange") && towns.some((town) => town.name === "Nîmes"));
  /* Autour d'Avignon, tout se dessine : la règle de priorité ne sert que
     dans les banlieues denses. */
  assert.ok(towns.every((town) => town.isDrawn));
});

test("une commune qui a des annonces passe avant les plus peuplées", () => {
  /* La carte d'une annonce montre où d'autres lots attendent, même dans un
     village. */
  const candidates = around(avignon);
  const village = candidates.filter((city) => city.communeCode !== avignon.communeCode).toSorted((a, b) => a.population - b.population)[0];
  assert.ok(village, "aucune petite commune autour d'Avignon");
  const plain = buildSectorMap(avignon, candidates);
  assert.ok(!plain.towns.some((town) => town.slug === village.slug), "le plus petit village est déjà retenu : le test ne prouverait rien");
  const { towns } = buildSectorMap(avignon, candidates, new Set([village.slug]));
  assert.ok(towns.some((town) => town.slug === village.slug), `${village.name}, qui a des annonces, n'est pas sur la carte`);
  assert.equal(towns.length, MAX_TOWNS);
});

/* Les centres de la propriété suivante : les 112 communes d'origine, des
   banlieues denses — la petite couronne, la métropole lilloise —, et des
   communes tirées au sort, toujours les mêmes (graine fixe), petites pour la
   plupart. */
const DENSE = [
  ["Montreuil", "93100"],
  ["Vincennes", "94300"],
  ["Ivry-sur-Seine", "94200"],
  ["Boulogne-Billancourt", "92100"],
  ["Saint-Ouen-sur-Seine", "93400"],
  ["Le Pré-Saint-Gervais", "93310"],
  ["Roubaix", "59100"],
  ["Tourcoing", "59200"],
  ["Villeneuve-d'Ascq", "59491"],
  ["Croix", "59170"],
  ["Mons-en-Barœul", "59370"],
].map(([name, postalCode]) => {
  const city = getCityByPair(name, postalCode);
  assert.ok(city, `${name} (${postalCode}) introuvable`);
  return city;
});

function sample(cities, count, seed) {
  let state = seed;
  const picked = [];
  while (picked.length < count) {
    state = (state * 1103515245 + 12345) % 2147483648;
    picked.push(cities[state % cities.length]);
  }
  return picked;
}

const CENTERS = [...CITIES, ...DENSE, ...sample(listCities(), 60, 20261001)];

test("aucun nom ne chevauche un autre nom ni le point d'une commune, quelle que soit la commune", () => {
  /* La propriété, chaque centre à son tour, avec toutes les communes du
     dernier anneau pour candidates. Le nom d'Avignon, posé à droite,
     recouvrait le point du Pontet. */
  assert.ok(CENTERS.some((center) => center.population < 1000), "l'échantillon ne compte aucune petite commune");
  for (const center of CENTERS) {
    const { towns, centerLabel } = buildSectorMap(center, around(center));
    /* Les points dessinés seulement : dans une banlieue dense, une voisine
       que le nom du centre masquerait n'est que dans la liste. */
    const dots = towns.map((town) => (town.isDrawn ? dotBox(town.point) : null));
    const centerBox = centerLabelBox(center.name, centerLabel);
    assert.ok(!dots.some((dot) => dot && overlaps(centerBox, dot)), `${center.name} : son nom recouvre le point d'une voisine`);
    const boxes = [centerBox];
    towns.forEach((town, index) => {
      if (!town.labelSide) return;
      const box = labelBox(town.point, town.name, town.labelSide);
      assert.ok(!boxes.some((other) => overlaps(box, other)), `${center.name} : le nom de ${town.name} en chevauche un autre`);
      assert.ok(town.isDrawn, `${center.name} : ${town.name} a un nom sans point`);
      assert.ok(!dots.some((dot, other) => dot && other !== index && overlaps(box, dot)), `${center.name} : le nom de ${town.name} recouvre un point`);
      assert.ok(box.left >= -MAP_HALF_SPAN_KM && box.right <= MAP_HALF_SPAN_KM, `${center.name} : ${town.name} sort du cadre`);
      boxes.push(box);
    });
  }
});

test("le nom de la commune du centre se pose hors de la zone, de quelque côté que ce soit", () => {
  /* Ancré au centre, il recouvrait la zone et le point du Pontet. */
  const zone = { left: -SECTOR_RADIUS_KM, right: SECTOR_RADIUS_KM, top: -SECTOR_RADIUS_KM, bottom: SECTOR_RADIUS_KM };
  for (const position of CENTER_LABEL_POSITIONS) {
    assert.ok(!overlaps(centerLabelBox("Avignon", position), zone), `« ${position} » recouvre la zone`);
  }
});

test("le lieu ouvre la carte de son secteur, sans jamais montrer d'adresse", async () => {
  const { ListingSector } = await import("../src/components/listing/ListingSector.tsx");
  /* Un composant serveur asynchrone : il lit les communes qui ont des
     annonces. */
  const markup = render(await ListingSector({ city: "Avignon", postalCode: "84000", gameId: "pokemon" }));
  /* Le bouton désigne le popover qu'il ouvre. */
  const target = markup.match(/popoverTarget="([^"]+)"/)?.[1];
  assert.ok(target && markup.includes(`id="${target}" popover="auto"`), "le bouton n'ouvre pas le popover");
  assert.match(text(markup), /Le secteur d.Avignon/, "« de Avignon » : l'élision manque");
  assert.match(text(markup), /Zone indicative/);
  /* La carte détaillée n'est qu'un lien : rien n'est chargé depuis un tiers. */
  assert.match(markup, /href="https:\/\/www\.openstreetmap\.org\/\?mlat=[\d.]+&amp;mlon=[\d.]+#map=12\/[\d.]+\/[\d.]+"/);
  assert.match(markup, /rel="noopener noreferrer"/);
  assert.doesNotMatch(markup, /<img|<iframe|tile\.openstreetmap/);
  /* Une commune inconnue du référentiel reste un texte. */
  const unknown = render(await ListingSector({ city: "Atlantide", postalCode: "99999", gameId: "pokemon" }));
  assert.doesNotMatch(unknown, /popover/);
});
