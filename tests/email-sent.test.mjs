import assert from "node:assert/strict";
import test from "node:test";
import { Fragment, createElement } from "react";
import { EmailSentScreen } from "../src/components/auth/EmailSentScreen.tsx";
import { MASKED_EMAIL, maskEmail } from "../src/lib/email-mask.ts";
import { render, text } from "./markup.mjs";

/* La page qui suit une inscription ou une demande de nouveau mot de passe :
   l'adresse s'y montre à demi, jamais en clair, et la démonstration y dit
   que rien ne part. */

test("une adresse se montre à demi : la première lettre, puis le domaine", () => {
  assert.equal(maskEmail("lecomptoirdukado@gmail.com"), "l•••@gmail.com");
  assert.equal(maskEmail("a@b.fr"), "a•••@b.fr");
  assert.doesNotMatch(maskEmail("julie.cartes@example.fr"), /ulie|cartes/);
  for (const value of ["pas-une-adresse", "@gmail.com", "julie@", ""]) assert.equal(maskEmail(value), null, `« ${value} » est masqué`);
});

test("le cookie se relit comme une saisie : seule une adresse masquée s'affiche", () => {
  assert.match("l•••@gmail.com", MASKED_EMAIL);
  for (const value of ["lecomptoirdukado@gmail.com", "ab•••@gmail.com", "•••@gmail.com", "l•••@gmail", "l•••@gmail.com<script>"]) {
    assert.doesNotMatch(value, MASKED_EMAIL, `« ${value} » passerait pour une adresse masquée`);
  }
});

const SCREEN = {
  sentence: (address) => createElement(Fragment, null, "Si ", address, " est valide, un lien vient d'y partir."),
  advice: ["Il arrive en quelques minutes.", "Regardez dans les indésirables."],
  actions: [
    { href: "/inscription", label: "Recommencer l'inscription" },
    { href: "/connexion", label: "Déjà confirmé ? Se connecter" },
  ],
};

test("la page montre l'adresse masquée, sinon « l'adresse saisie », et les gestes pour la suite", () => {
  const withAddress = render(createElement(EmailSentScreen, { ...SCREEN, maskedEmail: "l•••@gmail.com", demoNote: null }));
  assert.match(text(withAddress), /Si l•••@gmail\.com est valide/);
  assert.match(withAddress, /href="\/inscription"[^>]*>Recommencer l&#x27;inscription</);
  assert.match(withAddress, /href="\/connexion"/);
  assert.match(text(withAddress), /1 Il arrive en quelques minutes\. 2 Regardez dans les indésirables\./);
  const withoutAddress = render(createElement(EmailSentScreen, { ...SCREEN, maskedEmail: null, demoNote: null }));
  assert.match(text(withoutAddress), /Si l'adresse saisie est valide/);
});

test("en démonstration, la page le dit avant tout le reste", () => {
  const demo = text(render(createElement(EmailSentScreen, { ...SCREEN, maskedEmail: null, demoNote: "Site de démonstration : aucun e-mail ne part." })));
  assert.match(demo, /aucun e-mail ne part/, "la démonstration ne dit pas que rien ne part");
  assert.ok(demo.indexOf("aucun e-mail ne part") < demo.indexOf("Si l'adresse saisie"), "la note de démonstration n'est pas en tête");
  const live = text(render(createElement(EmailSentScreen, { ...SCREEN, maskedEmail: null, demoNote: null })));
  assert.doesNotMatch(live, /démonstration/);
});
