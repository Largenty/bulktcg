/* Fabrique src/app/fonts/science-gothic-caps.woff2, la seule Science Gothic
   que le site sert : les capitales, les chiffres et la ponctuation, sur les
   seuls axes employés. Voir science-gothic.config.mjs pour le pourquoi de
   chaque borne.

     node scripts/fonts/subset-science-gothic.mjs

   La police source (2,7 Mo) n'est pas versionnée : elle est téléchargée
   depuis google/fonts à un commit figé, vérifiée par son empreinte SHA-256,
   et gardée en cache dans node_modules/.cache. Le résultat, lui, l'est, avec
   la licence OFL qui doit l'accompagner. À relancer quand la configuration
   change ; tests/fonts.test.mjs dit si le fichier servi suffit encore. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";
import { AXES, CHARACTERS, FEATURES, LICENSE_OUTPUT, NAME_IDS, OUTPUT, SOURCE } from "./science-gothic.config.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const CACHE = path.join(ROOT, "node_modules", ".cache", "bulktcg-fonts");

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadSource() {
  const cached = path.join(CACHE, `science-gothic-${SOURCE.sha256.slice(0, 12)}.ttf`);
  if (existsSync(cached) && sha256(readFileSync(cached)) === SOURCE.sha256) return readFileSync(cached);
  const source = await download(SOURCE.url);
  const digest = sha256(source);
  if (digest !== SOURCE.sha256) {
    throw new Error(`Empreinte inattendue pour la police source : ${digest}. Le fichier a changé en amont ; vérifiez-le avant de mettre à jour la configuration.`);
  }
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(cached, source);
  return source;
}

const source = await loadSource();
const subset = await subsetFont(source, CHARACTERS, {
  targetFormat: "woff2",
  variationAxes: AXES,
  keepFeatures: FEATURES,
  preserveNameIds: NAME_IDS,
});

writeFileSync(path.join(ROOT, OUTPUT), subset);
writeFileSync(path.join(ROOT, LICENSE_OUTPUT), await download(SOURCE.licenseUrl));
console.log(`${OUTPUT} : ${subset.length} octets (source : ${source.length} octets)`);
