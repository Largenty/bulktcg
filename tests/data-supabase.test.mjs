import assert from "node:assert/strict";
import test from "node:test";
import { confirmEmailLink, signOut } from "../src/lib/data/auth-mutations.ts";
import { toMutationFailure } from "../src/lib/data/mutation-result.ts";
import { adminClient, isSupabaseMode, publicClient, userClient } from "../src/lib/data/source.ts";
import { sessionCookieOptions } from "../src/lib/data/supabase.ts";
import { performWrite } from "../src/lib/data/write-seam.ts";
import { readEmailLink } from "../src/lib/email-link.ts";
import { readSupabaseConfig } from "../src/lib/env.ts";

/* La plomberie de la phase 2 : le mode de la source, les cookies de
   session, la traduction des échecs, l'écriture dans les deux phases, et
   le lien reçu par e-mail. Les tests tournent sans variables Supabase :
   c'est la démonstration, qui ne doit pas bouger d'un pouce. */

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://projet.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exemple",
  SUPABASE_SECRET_KEY: "sb_secret_exemple",
};

test("Supabase n'est configuré qu'avec ses trois variables, et la démonstration sinon", () => {
  assert.equal(readSupabaseConfig({}), null);
  assert.equal(readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "" }), null);
  assert.deepEqual(readSupabaseConfig(SUPABASE), {
    url: SUPABASE.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: SUPABASE.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey: SUPABASE.SUPABASE_SECRET_KEY,
  });
  assert.throws(() => readSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE.NEXT_PUBLIC_SUPABASE_URL }), /configuré à moitié/);
  /* Les tests eux-mêmes tournent en démonstration : sans quoi ils
     liraient la vraie base. */
  assert.equal(isSupabaseMode(), false);
});

test("en démonstration, aucun client Supabase ne naît : la démonstration lit TABLES", async () => {
  assert.throws(() => publicClient(), /Supabase n'est pas configuré/);
  assert.throws(() => adminClient(), /Supabase n'est pas configuré/);
  await assert.rejects(userClient(), /Supabase n'est pas configuré/);
});

test("les cookies de session ne se lisent que côté serveur, et sont Secure en HTTPS", () => {
  /* httpOnly : ni une régie publicitaire ni une XSS ne liraient la session
     (audit E1). Secure en HTTPS seulement : en http://localhost, tous les
     navigateurs ne gardent pas un cookie Secure. */
  assert.deepEqual(sessionCookieOptions(true), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  assert.deepEqual(sessionCookieOptions(false), { httpOnly: true, secure: false, sameSite: "lax", path: "/" });
});

test("un échec de la base devient un statut que l'écran sait dire", () => {
  const cases = [
    [{ code: "23514", message: "check" }, { status: "invalid", fieldErrors: { form: "Une valeur ne respecte pas les règles du site." } }],
    [{ code: "23505", message: "duplicate" }, { status: "invalid", fieldErrors: { form: "Cet élément existe déjà." } }],
    [{ code: "23503", message: "fk" }, { status: "invalid", fieldErrors: { form: "Une valeur renvoie à un élément inconnu\u00a0: commune, série ou lot." } }],
    /* Interdit et introuvable se confondent : dire « interdit » confirmerait
       que l'objet existe. */
    [{ code: "42501", message: "rls" }, { status: "not-found" }],
    [{ code: "P0002", message: "no data" }, { status: "not-found" }],
    [{ code: "PGRST116", message: "0 rows" }, { status: "not-found" }],
    [{ code: "PGRST301", message: "jwt expired" }, { status: "unauthenticated" }],
    [{ code: "session_not_found", status: 403 }, { status: "unauthenticated" }],
    [{ code: "57014", message: "timeout" }, { status: "failed", retryable: true }],
    [{ code: "08006", message: "connection" }, { status: "failed", retryable: true }],
    [{ code: "40001", message: "serialization" }, { status: "failed", retryable: true }],
    [{ name: "AuthRetryableFetchError", status: 0 }, { status: "failed", retryable: true }],
    [new TypeError("fetch failed"), { status: "failed", retryable: true }],
    [{ status: 503 }, { status: "failed", retryable: true }],
    [{ status: 429, code: "over_request_rate_limit" }, { status: "rate-limited", retryAfterSeconds: 60 }],
    [{ status: 429, code: "over_email_send_rate_limit" }, { status: "rate-limited", retryAfterSeconds: 60 }],
    [{ code: "XX000", message: "internal" }, { status: "failed", retryable: false }],
    [null, { status: "failed", retryable: false }],
  ];
  for (const [error, expected] of cases) assert.deepEqual(toMutationFailure(error), expected, JSON.stringify(error));
  /* Le message du champ concerné, quand l'appelant le connaît. */
  const fieldFor = (code) => (code === "23505" ? { slug: "Ce lien permanent est déjà pris." } : null);
  assert.deepEqual(toMutationFailure({ code: "23505" }, fieldFor), { status: "invalid", fieldErrors: { slug: "Ce lien permanent est déjà pris." } });
});

test("une écriture de démonstration passe par la couture et dit qu'elle n'est pas enregistrée, sans rien exécuter", async () => {
  let executed = false;
  const result = await performWrite("listings.status", { id: "l-01", status: "sold" }, { status: "sold" }, () => {
    executed = true;
    return Promise.resolve({ error: null });
  });
  assert.deepEqual(result, { status: "not-persisted", data: { status: "sold" } });
  assert.equal(executed, false, "la démonstration a exécuté une requête");
});

test("le lien reçu par e-mail se lit comme une saisie", () => {
  const params = (query) => new URLSearchParams(query);
  const hash = "pkce_3f8a9c0d1e2b4a5f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5";
  assert.deepEqual(readEmailLink(params(`token_hash=${hash}&type=email`)), { tokenHash: hash, type: "email" });
  assert.deepEqual(readEmailLink(params(`token_hash=${hash}&type=recovery`)), { tokenHash: hash, type: "recovery" });
  assert.deepEqual(readEmailLink(params(`token_hash=${hash}&type=signup`)), { tokenHash: hash, type: "signup" });
  for (const query of [
    `token_hash=${hash}`,
    `token_hash=${hash}&type=magiclink`,
    `token_hash=${hash}&type=invite`,
    "type=email",
    "token_hash=court&type=email",
    `token_hash=${hash}%3Cscript%3E&type=email`,
    `token_hash=${"a".repeat(300)}&type=email`,
  ]) {
    assert.equal(readEmailLink(params(query)), null, query);
  }
});

test("en démonstration, un lien reçu par e-mail ne confirme rien, et la déconnexion ne ferme rien", async () => {
  /* Il n'y a pas d'e-mail en démonstration : un tel lien mène à la page qui
     dit qu'il n'est plus valable. Et la session de démonstration reste. */
  assert.equal(await confirmEmailLink({ tokenHash: "a".repeat(32), type: "email" }), null);
  await signOut();
});
