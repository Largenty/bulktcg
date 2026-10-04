import assert from "node:assert/strict";
import { withKnownCommune } from "../src/lib/schemas/commune.ts";
import { COMMUNE_ERROR } from "../src/lib/schemas/profile-form.ts";
import test from "node:test";
import { createElement } from "react";
import { passwordResetRequestAction, signInAction, signUpAction } from "../src/app/actions/auth.ts";
import { INITIAL_AUTH_FORM_STATE } from "../src/lib/auth-form-state.ts";
import { routes } from "../src/lib/routes.ts";
import { newPasswordSchema, passwordResetRequestSchema, signInSchema, signUpSchema } from "../src/lib/schemas/auth-form.ts";
import { render } from "./markup.mjs";

/* Les formulaires du compte : ce que le schéma accepte, ce que l'action
   rend, et les garde-fous des champs. Le même schéma valide dans le
   navigateur et sur le serveur ; ici, c'est le serveur qu'on interroge. */

const formData = (entries) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
};

const SIGN_UP = { username: "julie_cartes", email: "julie@example.fr", password: "trois classeurs magic", city: "Avignon", postalCode: "84000" };

test("l'adresse est normalisée : une majuscule du téléphone ne crée pas un second compte", () => {
  assert.equal(signInSchema.parse({ email: "  Julie@Example.FR ", password: "x" }).email, "julie@example.fr");
  assert.equal(passwordResetRequestSchema.safeParse({ email: "pas-une-adresse" }).success, false);
  assert.equal(passwordResetRequestSchema.safeParse({ email: `${"a".repeat(250)}@x.fr` }).success, false, "une adresse démesurée passe");
});

test("un nouveau mot de passe fait 12 caractères au moins, 128 au plus, et n'est jamais rogné", () => {
  assert.equal(newPasswordSchema.safeParse({ password: "court" }).success, false);
  assert.equal(newPasswordSchema.safeParse({ password: "x".repeat(129) }).success, false);
  /* Une espace fait partie du mot de passe : la retirer changerait celui
     qu'on a choisi. */
  assert.equal(newPasswordSchema.parse({ password: " une phrase de passe " }).password, " une phrase de passe ");
});

test("la connexion ne révèle aucune règle de mot de passe, mais borne la saisie", () => {
  assert.equal(signInSchema.safeParse({ email: "julie@example.fr", password: "court" }).success, true);
  assert.equal(signInSchema.safeParse({ email: "julie@example.fr", password: "" }).success, false);
  assert.equal(signInSchema.safeParse({ email: "julie@example.fr", password: "x".repeat(129) }).success, false);
});

test("l'inscription refuse un mot de passe qui reprend l'adresse ou le pseudo, et une commune inconnue", () => {
  assert.equal(signUpSchema.safeParse(SIGN_UP).success, true);
  const repeats = signUpSchema.safeParse({ ...SIGN_UP, password: "julie_cartes2026!" });
  assert.equal(repeats.success, false);
  assert.equal(repeats.error.issues[0].path[0], "password");
  assert.equal(withKnownCommune(signUpSchema, COMMUNE_ERROR).safeParse({ ...SIGN_UP, city: "Atlantide", postalCode: "99999" }).success, false);
  /* Le pseudo suit la règle du profil : il finit dans le filigrane. */
  assert.equal(signUpSchema.safeParse({ ...SIGN_UP, username: "Julie Cartes" }).success, false);
});

/* La redirection d'une action, telle que Next la lève : son adresse est
   dans le digest (« NEXT_REDIRECT;replace;/inscription/e-mail-envoye;307; »). */
async function redirectOf(pending) {
  try {
    await pending;
  } catch (error) {
    if (typeof error?.digest === "string" && error.digest.startsWith("NEXT_REDIRECT;")) return error.digest.split(";")[2];
    throw error;
  }
  assert.fail("l'action n'a pas redirigé");
}

test("l'action revalide côté serveur et ne rend jamais le mot de passe", async () => {
  const refused = await signInAction(INITIAL_AUTH_FORM_STATE, formData({ email: "pas-une-adresse", password: "secret" }));
  assert.equal(refused.result.status, "invalid");
  assert.ok(refused.result.fieldErrors.email);
  assert.ok(!("password" in refused.values), "le mot de passe revient dans l'état du formulaire");
  assert.ok(!JSON.stringify(refused).includes("secret"));
  /* L'adresse revient, pour que le formulaire vidé par React la retrouve. */
  assert.equal(refused.values.email, "pas-une-adresse");
  /* Un refus de l'inscription reste sur le formulaire. */
  const invalidSignUp = await signUpAction(INITIAL_AUTH_FORM_STATE, formData({ ...SIGN_UP, password: "court" }));
  assert.equal(invalidSignUp.result.status, "invalid");
});

test("une inscription acceptée mène à la page qui dit qu'un lien part, sans l'adresse ni le mot de passe dans l'URL", async () => {
  /* La réponse sous le bouton laissait croire que rien ne s'était passé. En
     démonstration aussi : la page y dit que rien n'est créé. */
  const destination = await redirectOf(signUpAction(INITIAL_AUTH_FORM_STATE, formData(SIGN_UP)));
  assert.equal(destination, routes.signUpSent);
  assert.doesNotMatch(destination, /julie|example|classeurs/);
});

test("mot de passe oublié : la même page, que l'adresse ait un compte ou non", async () => {
  const known = await redirectOf(passwordResetRequestAction(INITIAL_AUTH_FORM_STATE, formData({ email: "julie@example.fr" })));
  const unknown = await redirectOf(passwordResetRequestAction(INITIAL_AUTH_FORM_STATE, formData({ email: "personne@example.fr" })));
  assert.equal(known, routes.passwordResetSent);
  assert.equal(unknown, known);
  /* Une adresse mal formée reste sur le formulaire, avec son erreur. */
  const refused = await passwordResetRequestAction(INITIAL_AUTH_FORM_STATE, formData({ email: "pas-une-adresse" }));
  assert.equal(refused.result.status, "invalid");
});

test("les champs portent leurs garde-fous : autocomplétion juste, ni majuscule ni correction, longueurs bornées", async () => {
  const { SignInForm } = await import("../src/components/auth/SignInForm.tsx");
  const { SignUpForm } = await import("../src/components/auth/SignUpForm.tsx");
  const signIn = render(createElement(SignInForm));
  const signUp = render(createElement(SignUpForm));
  const input = (markup, id) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? "";

  assert.match(input(signIn, "email"), /type="email"/);
  assert.match(input(signIn, "email"), /autoComplete="username"/);
  assert.match(input(signIn, "email"), /autoCapitalize="none"/);
  assert.match(input(signIn, "email"), /maxLength="254"/);
  assert.match(input(signIn, "password"), /autoComplete="current-password"/);
  assert.match(input(signUp, "password"), /autoComplete="new-password"/);
  assert.match(input(signUp, "password"), /minLength="12"/);
  /* Le pseudo n'est pas l'identifiant : le gestionnaire de mots de passe ne
     doit pas l'enregistrer à la place de l'adresse. */
  assert.match(input(signUp, "username"), /autoComplete="nickname"/);
  /* Sur les champs d'identifiants : autocomplete=off empêcherait les
     gestionnaires de mots de passe, qui rendent les mots de passe longs
     possibles. (La commune, elle, a sa propre liste de suggestions.) */
  for (const field of [input(signIn, "email"), input(signIn, "password"), input(signUp, "username"), input(signUp, "email"), input(signUp, "password")]) {
    assert.doesNotMatch(field, /autoComplete="off"/);
  }
  assert.match(signIn, /href="\/mot-de-passe-oublie"/);
});
