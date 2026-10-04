import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { PersistenceNote } from "../src/components/account/PersistenceNote.tsx";
import { settle } from "../src/components/ui/useMutation.ts";
import { isAccepted, isTransientFailure } from "../src/lib/data/mutation-result.ts";
import { render, text } from "./markup.mjs";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Une écriture vue du navigateur. Une action serveur est une requête
   réseau : coupure, délai, serveur redéployé entre deux clics — elle peut
   rejeter sans rendre de compte rendu. Onze composants l'attendaient sans
   rien rattraper, et le rejet remontait jusqu'à error.tsx, qui remplaçait
   la page : le dépôt saisi disparaissait avec elle. */

test("une action qui rejette devient un compte rendu « failed », pas une page d'erreur", async () => {
  const logged = [];
  const original = console.error;
  console.error = (error) => logged.push(error);
  try {
    const outcome = await settle(() => Promise.reject(new TypeError("Failed to fetch")));
    assert.deepEqual(outcome, { status: "failed", retryable: true });
    /* Rattrapée, pas avalée : la trace reste dans la console. */
    assert.equal(logged.length, 1);
  } finally {
    console.error = original;
  }
  const saved = await settle(async () => ({ status: "saved", data: { path: "/annonces/x" } }));
  assert.deepEqual(saved, { status: "saved", data: { path: "/annonces/x" } });
});

test("seule une demande acceptée fait avancer l'écran ; un échec passager garde le geste", () => {
  assert.ok(isAccepted({ status: "saved", data: null }));
  assert.ok(isAccepted({ status: "not-persisted", data: null }));
  for (const status of ["invalid", "unauthenticated", "not-found"]) {
    assert.ok(!isAccepted({ status, fieldErrors: {} }), `${status} passe pour accepté`);
  }
  assert.ok(isTransientFailure({ status: "failed", retryable: true }));
  assert.ok(isTransientFailure({ status: "rate-limited", retryAfterSeconds: 30 }));
  /* Un refus que recommencer ne changera pas n'invite pas à recommencer. */
  assert.ok(!isTransientFailure({ status: "failed", retryable: false }));
  assert.ok(!isTransientFailure({ status: "not-found" }));
});

test("l'échec et le débit se disent en clair, avec le délai arrondi vers le haut", () => {
  const note = (result) => text(render(createElement(PersistenceNote, { result, action: "publier l'annonce" })));
  assert.match(note({ status: "failed", retryable: true }), /n'a pas abouti \(publier l'annonce\).*Rien n'a été enregistré.*réessayez/);
  assert.match(note({ status: "failed", retryable: false }), /n'a pas pu être traitée.*rien n'a été enregistré/);
  assert.match(note({ status: "rate-limited", retryAfterSeconds: 45 }), /Réessayez dans 45 secondes/);
  assert.match(note({ status: "rate-limited", retryAfterSeconds: 61 }), /Réessayez dans 2 minutes/);
  assert.match(note({ status: "rate-limited", retryAfterSeconds: 3601 }), /Réessayez dans 2 heures/);
});

test("aucun composant n'attend une action serveur sans passer par useMutation", () => {
  /* Les formulaires d'authentification font exception, à dessein : ils
     passent par useActionState et un vrai POST, et fonctionnent sans
     JavaScript. */
  const components = path.join(SOURCE_ROOT, "components");
  const offenders = collectFiles(components, /\.tsx?$/)
    .filter((file) => !file.includes(`${path.sep}auth${path.sep}`) && !file.endsWith(`${path.sep}useMutation.ts`))
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return /\buseTransition\b|\bstartTransition\(\s*async/.test(source);
    })
    .map((file) => path.relative(components, file));
  assert.deepEqual(offenders, []);
});

test("chaque écran d'erreur réessaie en relisant les données, et le compte comme la messagerie gardent leur gabarit", () => {
  /* reset() efface l'erreur sans rien relire : une base indisponible
     retombait à l'identique au premier clic sur « Réessayer ». retry()
     relit les données et refait le rendu. */
  const app = path.join(SOURCE_ROOT, "app");
  const screens = collectFiles(app, /^error\.tsx$/);
  assert.ok(screens.length >= 3, "les écrans d'erreur ont disparu");
  for (const file of screens) {
    /* Le code seul : un commentaire peut expliquer pourquoi reset() ne
       suffisait pas. */
    const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.match(source, /\bretry\b/, `${path.relative(app, file)} ne réessaie pas`);
    assert.doesNotMatch(source, /\breset\b/, `${path.relative(app, file)} efface l'erreur sans relire`);
  }
  /* Une lecture ratée dans un onglet du compte ou un fil ne remplace plus
     tout le gabarit : identité, onglets et liste des conversations restent. */
  for (const segment of ["mon-compte", "messages"]) {
    assert.ok(screens.includes(path.join(app, segment, "error.tsx")), `${segment} n'a pas sa limite d'erreur`);
  }
});
