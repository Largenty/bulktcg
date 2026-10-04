import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* La règle « aucune taille en dur dans un composant » était écrite dans
   CLAUDE.md et dans l'en-tête de tokens.css, et elle n'était pas tenue :
   162 tailles littérales sur quinze valeurs distinctes cohabitaient avec une
   échelle de cinq tokens dont quatre ne servaient qu'aux balises de base.css.

   Une règle qu'aucun test ne vérifie redevient fausse ; celui-ci la tient.
   Il ne juge pas du goût — il refuse seulement qu'une taille de texte ou une
   épaisseur de trait soit décidée ailleurs que dans tokens.css. */

const TOKENS_PATH = path.join(SOURCE_ROOT, "styles", "tokens.css");

const SOURCES = collectFiles(SOURCE_ROOT, /\.tsx?$/).map((file) => ({
  file: path.relative(SOURCE_ROOT, file),
  text: readFileSync(file, "utf8"),
}));

const TOKEN_NAMES = new Set(
  [...readFileSync(TOKENS_PATH, "utf8").matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(
    (match) => match[1],
  ),
);

function findAll(pattern) {
  return SOURCES.flatMap(({ file, text }) =>
    [...text.matchAll(pattern)].map((match) => `${file} : ${match[0]}`),
  );
}

test("aucune taille de texte littérale dans un composant", () => {
  const offenders = findAll(/\btext-\[[0-9][^\]]*\]/g);
  assert.deepEqual(
    offenders,
    [],
    `Ces tailles doivent passer par un pas de l'échelle de tokens.css :\n${offenders.join("\n")}`,
  );
});

test("aucune épaisseur de trait littérale dans un composant", () => {
  const offenders = findAll(/\bborder(?:-[trblxy])?-\[[0-9][^\]]*\]/g);
  assert.deepEqual(
    offenders,
    [],
    `L'épaisseur de trait est une décision unique du système (--border-width) :\n${offenders.join("\n")}`,
  );
});

/* Le garde-fou précédent se contournerait en écrivant un token qui n'existe
   pas : la classe serait acceptée, la propriété CSS vaudrait « rien », et le
   texte retomberait silencieusement à la taille héritée. */
test("toute taille référencée par un composant existe dans tokens.css", () => {
  const referenced = SOURCES.flatMap(({ file, text }) =>
    [...text.matchAll(/\[length:var\((--[a-z0-9-]+)\)\]/g)].map((match) => ({
      file,
      token: match[1],
    })),
  );

  assert.ok(referenced.length > 0, "aucune taille tokenisée trouvée — le test ne vérifie rien");

  const unknown = referenced
    .filter(({ token }) => !TOKEN_NAMES.has(token))
    .map(({ file, token }) => `${file} : ${token}`);
  assert.deepEqual(unknown, [], `Tokens de taille inconnus :\n${unknown.join("\n")}`);
});

/* L'échelle doit rester une échelle : deux pas qui finissent à la même
   valeur sont deux noms pour une seule décision, et le second se met à
   dériver. Les familles sont séparées — un prix et un paragraphe peuvent
   légitimement partager une valeur sans partager un rôle. */
test("les pas d'une même famille ont des valeurs distinctes", () => {
  const source = readFileSync(TOKENS_PATH, "utf8");
  const root = source.slice(source.indexOf(":root {"), source.indexOf("@media"));

  for (const family of ["text", "number"]) {
    const steps = [
      ...root.matchAll(new RegExp(`--(${family}-[a-z0-9-]+):\\s*([0-9.]+px);`, "g")),
    ];
    assert.ok(steps.length >= 5, `famille --${family}-* introuvable ou trop courte`);

    const seen = new Map();
    for (const [, name, value] of steps) {
      assert.ok(
        !seen.has(value),
        `--${name} et --${seen.get(value)} valent tous les deux ${value}`,
      );
      seen.set(value, name);
    }
  }
});

/* Le plancher de lisibilité : une métadonnée qu'on ne lit pas n'informe
   personne. Aucun pas de l'échelle ne descend sous 13 px — c'est là que
   vivaient les anciens 11 et 12 px des libellés en capitales. */
test("aucun pas de l'échelle de texte ne descend sous 13 px", () => {
  const source = readFileSync(TOKENS_PATH, "utf8");
  const root = source.slice(source.indexOf(":root {"), source.indexOf("@media"));
  const tooSmall = [...root.matchAll(/--(text-[a-z0-9-]+):\s*([0-9.]+)px;/g)]
    .filter(([, , value]) => Number(value) < 13)
    .map(([, name, value]) => `--${name} : ${value}px`);
  assert.deepEqual(tooSmall, [], `Pas de texte sous le plancher :\n${tooSmall.join("\n")}`);
});

/* Une variable citée par un composant et absente de tokens.css ne produit
   aucune erreur : la propriété vaut « rien », la couleur disparaît en
   silence. C'est exactement ce qui arrive quand un token est renommé et
   qu'un composant oublié le cite encore. Seules échappent à la règle les
   variables posées à l'exécution par un style en ligne ou par next/font. */
const RUNTIME_VARIABLES = new Set([
  "--ad-width",
  "--ad-height",
  "--ad-mobile-width",
  "--ad-mobile-height",
  "--fan-rotate",
  "--fan-shift",
  "--fan-lift",
  "--font-space-grotesk",
  "--font-science",
  "--font-mona",
  "--font-atkinson-mono",
]);

test("toute variable CSS citée par un composant existe", () => {
  const defined = new Set(
    [...readFileSync(TOKENS_PATH, "utf8").matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1]),
  );
  const missing = SOURCES.flatMap(({ file, text }) =>
    [...text.matchAll(/var\((--[a-z0-9-]+)/g)]
      .map((match) => match[1])
      .filter((name) => !defined.has(name) && !RUNTIME_VARIABLES.has(name) && !name.startsWith("--tw-"))
      .map((name) => `${file} : ${name}`),
  );
  assert.deepEqual([...new Set(missing)], [], `Variables inconnues :\n${[...new Set(missing)].join("\n")}`);
});
