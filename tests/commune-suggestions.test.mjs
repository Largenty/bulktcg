import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/communes/suggestions/route.ts";
import { reachableFromClients, SOURCES } from "./client-graph.mjs";

/* La route qui nourrit le champ commune pendant la frappe, et la frontière
   qui la rend nécessaire : le référentiel ne part jamais dans le
   navigateur. */

async function ask(query) {
  const response = GET(new Request(`http://localhost/communes/suggestions?q=${encodeURIComponent(query)}`));
  return { response, body: await response.json() };
}

test("un nom propose ses communes, et n'en choisit aucune quand il en désigne plusieurs", async () => {
  const { body } = await ask("valence");
  assert.equal(body.match, null, "trois communes s'appellent Valence : le champ attend qu'on choisisse");
  assert.equal(body.suggestions[0].departmentCode, "26", "la plus peuplée d'abord");
  assert.ok(body.suggestions.some((city) => city.departmentCode === "82"));
  assert.ok(body.suggestions.length <= 6);
});

test("une saisie qui désigne une seule commune la rend, pour que le champ la retienne", async () => {
  assert.equal((await ask("84000")).body.match.name, "Avignon");
  assert.equal((await ask("Carpentras")).body.match.postalCode, "84200");
  assert.equal((await ask("Valence (82400)")).body.match.departmentCode, "82");
});

test("la réponse ne dit rien de personnel : elle se garde un jour, et ne s'indexe pas", async () => {
  const { response } = await ask("avi");
  assert.match(response.headers.get("cache-control") ?? "", /public, max-age=86400/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
});

test("une saisie vide ou démesurée ne coûte rien", async () => {
  assert.deepEqual((await ask("")).body, { match: null, suggestions: [] });
  const { body } = await ask("a".repeat(5000));
  assert.deepEqual(body.suggestions, []);
});

test("aucun module qui s'exécute dans le navigateur n'importe le référentiel", () => {
  /* « server-only » ferait échouer le build ; ce test le dit plus tôt, et
     nomme le fichier. Un import de type est effacé à la compilation. */
  const valueImport = /^import\s+(?!type\b)[^;]*from\s+["']@\/lib\/(cities|communes\/[\w-]+)["']/m;
  const offenders = [...reachableFromClients()].filter((file) => valueImport.test(SOURCES.get(file) ?? ""));
  assert.deepEqual(offenders, []);
  const sample = 'import { searchCities } from "@/lib/cities";';
  assert.ok(valueImport.test(sample), "le motif reconnaît un import de valeur");
  assert.ok(!valueImport.test('import type { City } from "@/lib/cities";'), "et laisse passer un import de type");
});

test("la recherche « Où » sur un homonyme dit quelle commune elle a prise, et propose les autres", async () => {
  const { createElement } = await import("react");
  const { render, text } = await import("./markup.mjs");
  const { CityNotice } = await import("../src/components/city/CityNotice.tsx");
  const { resolveCity } = await import("../src/lib/cities.ts");
  const markup = render(createElement(CityNotice, { resolution: resolveCity("Valence"), basePath: "/annonces", params: { ville: "Valence" } }));
  assert.match(text(markup), /Plusieurs communes s'appellent Valence : la liste est centrée sur Valence \(26000, Drôme\)/);
  /* Chaque autre porte « Nom (code) » : le nom seul retomberait sur la même. */
  assert.match(markup, /href="\/annonces\?ville=Valence\+%2882400%29"/);
  assert.equal(render(createElement(CityNotice, { resolution: resolveCity("Carpentras"), basePath: "/annonces", params: {} })), "", "un nom unique ne dit rien");
});
