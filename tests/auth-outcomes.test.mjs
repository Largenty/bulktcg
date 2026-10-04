import assert from "node:assert/strict";
import test from "node:test";
import { EMAIL_LINK_WINDOW_SECONDS, authLogRecord, openedByRecentEmailLink, signUpAnswer, signUpDestination } from "../src/lib/data/auth-outcomes.ts";
import { routes } from "../src/lib/routes.ts";

/* Ce que le compte répond à partir des réponses de Supabase Auth : ce que
   la personne voit ne doit jamais dire si une adresse a un compte, et ce
   que le serveur consigne ne doit jamais porter l'adresse. */

test("une inscription répond la même chose, que l'adresse ait un compte ou non", () => {
  const outcome = { sessionOpened: false };
  const fresh = signUpAnswer(null, outcome);
  assert.deepEqual(fresh, { status: "saved", data: outcome });
  for (const error of [
    { code: "user_already_exists", status: 422 },
    { code: "email_exists", status: 422 },
    /* Un lien renvoyé à une adresse non confirmée : un par minute. */
    { code: "over_email_send_rate_limit", status: 429 },
    /* Le SMTP intégré n'écrit qu'à l'équipe du projet. */
    { code: "email_address_not_authorized", status: 400 },
    /* Un envoi qui échoue : Supabase répond 500, pour une adresse neuve seulement. */
    { code: "unexpected_failure", status: 500 },
  ]) {
    assert.deepEqual(signUpAnswer(error, outcome), fresh, `${error.code} se distingue d'une adresse neuve`);
  }
});

test("les erreurs qui tiennent au formulaire, et pas à un compte existant, restent dites", () => {
  assert.equal(signUpAnswer({ code: "weak_password", status: 422 }, null).status, "invalid");
  assert.deepEqual(Object.keys(signUpAnswer({ code: "weak_password", status: 422 }, null).fieldErrors), ["password"]);
  assert.deepEqual(Object.keys(signUpAnswer({ code: "email_address_invalid", status: 400 }, null).fieldErrors), ["email"]);
  /* Le réseau, et le débit de tout le site — compté sur l'adresse IP du
     serveur — ne disent rien d'une adresse. */
  assert.deepEqual(signUpAnswer({ name: "AuthRetryableFetchError", status: 0 }, null), { status: "failed", retryable: true });
  assert.equal(signUpAnswer({ code: "over_request_rate_limit", status: 429 }, null).status, "rate-limited");
});

test("le journal dit l'issue réelle, jamais l'adresse", () => {
  const email = "julie.cartes@example.fr";
  const cases = [
    [null, { level: "info", event: "auth.passwordReset", outcome: "ok", domain: "example.fr" }],
    [{ code: "over_email_send_rate_limit", status: 429 }, { level: "warn", event: "auth.passwordReset", outcome: "over_email_send_rate_limit", domain: "example.fr" }],
    [{ code: "unexpected_failure", status: 500 }, { level: "error", event: "auth.passwordReset", outcome: "unexpected_failure", domain: "example.fr" }],
    [{ name: "AuthRetryableFetchError", status: 0 }, { level: "error", event: "auth.passwordReset", outcome: "AuthRetryableFetchError", domain: "example.fr" }],
  ];
  for (const [error, expected] of cases) {
    const record = authLogRecord("auth.passwordReset", email, error);
    assert.deepEqual(record, expected);
    assert.doesNotMatch(JSON.stringify(record), /julie|@/, "l'adresse est passée au journal");
  }
});

test("seul un lien reçu par e-mail depuis moins d'une heure permet de changer le mot de passe sans l'ancien", () => {
  /* Supabase inscrit « otp » pour le lien de récupération comme pour celui
     de l'inscription, « password » pour une connexion par mot de passe —
     mesuré sur le projet. */
  const now = 1_790_000_000;
  const opened = (method, age) => ({ amr: [{ method, timestamp: now - age }] });
  assert.equal(openedByRecentEmailLink(opened("otp", 0), now), true);
  assert.equal(openedByRecentEmailLink(opened("otp", EMAIL_LINK_WINDOW_SECONDS), now), true);
  assert.equal(openedByRecentEmailLink(opened("otp", EMAIL_LINK_WINDOW_SECONDS + 1), now), false, "un lien d'il y a plus d'une heure suffit encore");
  assert.equal(openedByRecentEmailLink(opened("password", 0), now), false, "une session ouverte par mot de passe change le mot de passe sans l'ancien");
  assert.equal(openedByRecentEmailLink({ amr: [{ method: "password", timestamp: now }, { method: "otp", timestamp: now - 7200 }] }, now), false);
  /* L'ancienne forme, sans heure, ne prouve rien de récent ; une heure dans
     le futur non plus. */
  assert.equal(openedByRecentEmailLink({ amr: ["otp"] }, now), false);
  assert.equal(openedByRecentEmailLink(opened("otp", -3600), now), false);
  assert.equal(openedByRecentEmailLink({}, now), false);
  assert.equal(openedByRecentEmailLink(null, now), false);
});

test("une inscription acceptée mène à la page de l'e-mail envoyé, ou là où l'on allait si la session est déjà ouverte", () => {
  /* La session s'ouvre tout de suite quand « Confirm email » est coupé dans
     le tableau de bord : il n'y a alors aucun lien à attendre. */
  assert.equal(signUpDestination({ sessionOpened: false }, "/deposer"), routes.signUpSent);
  assert.equal(signUpDestination({ sessionOpened: true }, "/deposer"), "/deposer");
});
