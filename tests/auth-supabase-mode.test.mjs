import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/* Le compte en phase 2, sans base : Supabase est « configuré » avec des
   valeurs factices, et fetch est remplacé par les réponses que GoTrue et
   PostgREST rendraient. Un fichier à part — un processus à part : les autres
   tests tournent en démonstration. */
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projet-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
delete process.env.DEMO_USER_ID;

const { isSupabaseMode } = await import("../src/lib/data/source.ts");
const { requestPasswordReset, signUpWithPassword } = await import("../src/lib/data/auth-mutations.ts");

const ROOT = path.resolve(import.meta.dirname, "..");
const calls = [];
let answer = () => Response.json({});
globalThis.fetch = async (input, init = {}) => {
  calls.push({ url: String(input), headers: new Headers(init.headers), next: init.next });
  return answer();
};

/* Une réponse d'erreur telle que GoTrue la rend. */
const authError = (status, code) => Response.json({ code: status, error_code: code, msg: code }, { status });

function captureLogs() {
  const lines = [];
  const originals = { info: console.info, warn: console.warn, error: console.error };
  for (const level of ["info", "warn", "error"]) console[level] = (line) => lines.push(line);
  return { lines, restore: () => Object.assign(console, originals) };
}

test("le mode Supabase est bien celui de ce fichier", () => {
  assert.equal(isSupabaseMode(), true);
});

test("mot de passe oublié : la même réponse quoi qu'il arrive à l'envoi, et avant même l'envoi", async () => {
  const outcomes = [
    ["ok", () => Response.json({})],
    /* Une adresse inscrite, demandée deux fois en moins d'une minute. */
    ["over_email_send_rate_limit", () => authError(429, "over_email_send_rate_limit")],
    /* Le SMTP intégré refuse une adresse hors de l'équipe. */
    ["email_address_not_authorized", () => authError(400, "email_address_not_authorized")],
    /* auth-js ne remonte pas toujours le code d'une erreur 5xx : le statut suffit. */
    [/^(unexpected_failure|http-500)$/, () => authError(500, "unexpected_failure")],
    ["AuthRetryableFetchError", () => Promise.reject(new TypeError("fetch failed"))],
  ];
  const logs = captureLogs();
  try {
    for (const [outcome, respond] of outcomes) {
      calls.length = 0;
      answer = respond;
      const tasks = [];
      const result = await requestPasswordReset({ email: "julie.cartes@example.fr" }, (task) => tasks.push(task));
      assert.deepEqual(result, { status: "saved", data: null }, String(outcome));
      assert.equal(calls.length, 0, "la réponse attend l'envoi : sa durée dirait si l'adresse est inscrite");
      await Promise.all(tasks.map((task) => task()));
      assert.equal(calls.length, 1, `${outcome} : la demande n'est pas partie`);
      assert.match(calls[0].url, /\/auth\/v1\/recover/);
    }
  } finally {
    logs.restore();
  }
  const logged = logs.lines.map((line) => JSON.parse(line).outcome);
  assert.equal(logged.length, outcomes.length);
  outcomes.forEach(([expected], index) => assert.match(logged[index], expected instanceof RegExp ? expected : new RegExp(`^${expected}$`)));
  assert.ok(logs.lines.every((line) => !/julie|@/.test(line)), "l'adresse est passée au journal");
});

test("le pseudo se vérifie par la clé publique, hors cache, avant de créer quoi que ce soit", async () => {
  calls.length = 0;
  answer = () => Response.json([{ id: "c0ffee00-0000-4000-8000-000000000001" }]);
  const result = await signUpWithPassword({
    username: "lecomptoirdukado",
    email: "julie.cartes@example.fr",
    password: "trois classeurs magic",
    city: "Avignon",
    postalCode: "84000",
    returnTo: "/mon-compte",
  });
  assert.deepEqual(result, { status: "invalid", fieldErrors: { username: "Ce pseudo est déjà pris." } });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rest\/v1\/profiles\?select=id&username=eq\.lecomptoirdukado/);
  assert.equal(calls[0].headers.get("apikey"), "sb_publishable_test", "la vérification du pseudo passe par la clé secrète");
  assert.equal(calls[0].next, undefined, "la vérification du pseudo lit le cache : un pseudo pris il y a une minute passerait");
});

test("un compte qui naît invalide la liste des profils en cache, à l'inscription comme à la confirmation", () => {
  /* Sans quoi sa page — et son compte — répondraient 404 jusqu'à une heure. */
  const actions = readFileSync(path.join(ROOT, "src/app/actions/auth.ts"), "utf8");
  const signUp = actions.slice(actions.indexOf("export async function signUpAction"), actions.indexOf("export async function passwordResetRequestAction"));
  assert.match(signUp, /if \(result\.status === "saved"\) \{\s*updateCachedReads\(CACHE_TAGS\.profiles\);/);
  const route = readFileSync(path.join(ROOT, "src/app/connexion/confirmation/route.ts"), "utf8");
  assert.match(route, /revalidateTag\(CACHE_TAGS\.profiles, \{ expire: 0 \}\)/);
});
