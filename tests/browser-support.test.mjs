import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { reachableFromClients, serverBoundaryStubs, serverStub } from "./client-graph.mjs";
import { ROOT, createProgram, diagnosticsIn } from "./compile.mjs";
import { SOURCE_ROOT } from "./sources.mjs";

/* Deux socles. Le serveur tourne sur Node 24 : Map.groupBy, toSorted ou les
   méthodes de Set y sont chez eux, et le code serveur s'en sert (le plan du
   site, le compte). Le navigateur, lui, est celui que Next 16 sert, sans
   autre polyfill que fetch, URL et Object.assign : ce qui s'exécute côté
   client s'arrête là. toSorted n'arrive qu'avec Firefox 115, et le tri des
   correspondances (lib/matching.ts), que l'aperçu d'une demande exécute dans
   le navigateur, garde donc [...].sort.

   Le test ne cherche pas des noms de méthodes, qu'un alias ou un receveur
   inattendu feraient passer : il compile tout ce qu'atteint un composant
   client avec la bibliothèque du navigateur au lieu d'esnext. Ce qui dépasse
   le socle y devient une erreur de type. */

const require = createRequire(import.meta.url);

/* Le socle, lu là où Next le lit pour compiler le code client : sa liste par
   défaut, que seul un browserslist propre au projet remplacerait. */
const NEXT_DEFAULT_FLOOR = require("next/dist/shared/lib/modern-browserslist-target.js");
const { getSupportedBrowsers } = require("next/dist/build/get-supported-browsers.js");

/* La bibliothèque du navigateur, et pourquoi celle-là. ES2022 — at,
   Object.hasOwn, la cause des erreurs — demande Chrome et Edge 93, Firefox
   92 et Safari 15.4, que le socle dépasse ; les tableaux d'ES2023 —
   toSorted, toReversed, toSpliced, with — demandent Chrome et Edge 110,
   Firefox 115 et Safari 16, que le socle n'atteint pas. Le jour où Next
   déplace son socle, le premier test le dit.

   Deux angles morts, connus : Intl.Segmenter, que la bibliothèque ES2022
   type, n'arrive qu'avec Firefox 125 ; et le DOM de TypeScript suit les
   navigateurs récents, pas le socle. */
const CLIENT_LIB = ["lib.es2022.d.ts", "lib.dom.d.ts"];
const CLIENT_EDITION = { name: "ES2022", needs: { chrome: 93, edge: 93, firefox: 92, safari: 15.4 } };
const NEXT_EDITION = { name: "ES2023", needs: { chrome: 110, edge: 110, firefox: 115, safari: 16 } };

const covers = (floor, { needs }) =>
  floor.every((entry) => {
    const [browser, version] = entry.split(" ");
    return Number(version) >= (needs[browser] ?? Infinity);
  });

/* Ce que Next donne au navigateur en plus du DOM : les process.env.…
   écrits en toutes lettres, qu'il remplace au build, et les feuilles de
   style importées. Rien de Node : Buffer ou require y sont refusés. */
const BROWSER_GLOBALS = [
  path.join(ROOT, "browser-globals.d.ts"),
  'declare const process: { readonly env: Readonly<Record<string, string | undefined>> };\ndeclare module "*.css";\n',
];

/* Une sonde compilée avec le reste, qu'aucun composant n'atteint : ce qui
   dépasse le socle doit y être refusé, ligne par ligne, et ce qui est en
   deçà accepté. Sans elle, le test passerait aussi avec esnext. */
const PROBE = [
  path.join(SOURCE_ROOT, "lib", "browser-floor-probe.ts"),
  `export const beyond = (rows: number[]) => [
  rows.toSorted(),
  Map.groupBy(rows, String),
  new Set(rows).union(new Set([1])),
  Promise.withResolvers<number>(),
  Buffer.from("BK-F08N9X"),
];
export const within = (rows: number[]) => [rows.at(-1), Object.hasOwn({ rows }, "rows"), [...rows].sort(), new Error("BK", { cause: rows })];
`,
];

/* La compilation du code client s'arrête là où son exécution s'arrête :
   un module serveur — une action, la couche données — n'y entre que par ses
   exports, typés lâchement (serverStub). Le serveur tourne sur Node 24 et
   s'en sert ; ce n'est pas au socle du navigateur de le juger. */
const BROWSER_OPTIONS = { lib: CLIENT_LIB, types: [] };

let program;
const reached = [...reachableFromClients()];
const clientProgram = () =>
  (program ??= createProgram([BROWSER_GLOBALS[0], PROBE[0], ...reached], {
    overrides: BROWSER_OPTIONS,
    texts: new Map([BROWSER_GLOBALS, PROBE, ...serverBoundaryStubs()]),
  }));

/* Les bibliothèques au-delà du socle qu'un programme a chargées : un type
   importé peut tirer une bibliothèque plus récente (les types de Node tirent
   esnext), qui rouvrirait ce que la compilation refuse. */
const beyondFloor = (compiled) =>
  compiled
    .getSourceFiles()
    .map((file) => file.fileName)
    .filter((name) => /\/lib\.(es202[3-9]|esnext)[.\w]*\.d\.ts$|\/@types\/node\//.test(name));

const describe = (diagnostic) => {
  const where = diagnostic.file
    ? `${path.relative(SOURCE_ROOT, diagnostic.file.fileName)}:${diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`
    : "options";
  return `${where} : ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
};

test("le socle est celui que Next compile, et il est entre ES2022 et ES2023", () => {
  const floor = getSupportedBrowsers(ROOT, false);
  assert.deepEqual(floor, NEXT_DEFAULT_FLOOR, "un browserslist propre au projet remplace le socle de Next");
  assert.deepEqual(
    floor.map((entry) => entry.split(" ")[0]),
    Object.keys(CLIENT_EDITION.needs),
    "Next compile pour d'autres navigateurs : complétez les éditions de ce test",
  );
  assert.ok(covers(floor, CLIENT_EDITION), `Le socle de Next (${floor.join(", ")}) ne couvre plus ${CLIENT_EDITION.name} : descendez CLIENT_LIB`);
  assert.ok(!covers(floor, NEXT_EDITION), `Le socle de Next (${floor.join(", ")}) couvre ${NEXT_EDITION.name} : CLIENT_LIB peut monter d'une édition`);
});

test("la compilation refuse ce qui dépasse le socle, et laisse le reste", () => {
  const refused = diagnosticsIn(clientProgram(), [PROBE[0]]).map((diagnostic) => describe(diagnostic).split(" : ")[0]);
  assert.deepEqual(refused, [2, 3, 4, 5, 6].map((line) => `lib/browser-floor-probe.ts:${line}`), refused.join(", "));
});

test("rien de ce qui s'exécute dans le navigateur ne dépasse le socle de Next", () => {
  /* Le module qui a motivé la règle doit être compilé, sinon le test
     passerait à vide. */
  assert.ok(reached.includes(path.join(SOURCE_ROOT, "lib", "matching.ts")), "lib/matching.ts n'est pas atteint depuis les composants clients");
  const offenders = diagnosticsIn(clientProgram(), reached).map(describe);
  assert.deepEqual(offenders, [], "Hors du socle de Next 16 : gardez l'équivalent ES2022, ou calculez côté serveur.");
  assert.deepEqual(beyondFloor(clientProgram()), [], "une bibliothèque au-delà du socle entre dans la compilation du code client");
});

test("une action peut se servir de Node : le composant qui l'appelle n'en hérite pas", () => {
  /* Le cas qui a motivé le relais : un formulaire appelle son action, qui
     lit les cookies par next/headers — dont les types tirent ceux de Node —
     et se sert de Buffer et de toSorted, chez eux sur le serveur. */
  const action = [
    path.join(SOURCE_ROOT, "app", "actions", "floor-probe.ts"),
    `"use server";
import { cookies } from "next/headers";
export async function readProbe() {
  return (await cookies()).getAll().map((cookie) => Buffer.from(cookie.value).length).toSorted();
}
`,
  ];
  const client = [
    path.join(SOURCE_ROOT, "components", "floor-probe-client.ts"),
    `"use client";
import { readProbe } from "@/app/actions/floor-probe";
export const run = async () => (await readProbe()).at(-1);
`,
  ];
  const compile = (relayed) =>
    createProgram([BROWSER_GLOBALS[0], client[0]], {
      overrides: BROWSER_OPTIONS,
      texts: new Map([BROWSER_GLOBALS, client, relayed ? [action[0], serverStub(...action)] : action]),
    });
  const relayed = compile(true);
  assert.deepEqual(diagnosticsIn(relayed, [client[0]]).map(describe), []);
  assert.deepEqual(beyondFloor(relayed), [], "le relais laisse passer les types du serveur");
  /* Falsification : sans le relais, TypeScript suit l'import jusqu'aux types
     de Node — c'est ce que le garde du test précédent aurait vu. */
  assert.ok(
    beyondFloor(compile(false)).some((name) => name.includes("/@types/node/")),
    "sans relais, les types de Node n'entrent plus : la sonde ne prouve plus rien",
  );
});
