import assert from "node:assert/strict";
import test from "node:test";
import robots, { AI_TRAINING_CRAWLERS, LINK_PREVIEW_BOTS } from "../src/app/robots.ts";

/* robots.txt lu comme le lit un robot (RFC 9309) : le groupe qui porte le
   nom du robot, sinon « * » ; dans ce groupe, la règle la plus longue qui
   correspond l'emporte, et à longueur égale, l'autorisation. « * » vaut
   n'importe quelle suite, « $ » la fin de l'adresse. Un test qui relirait
   les lignes du fichier ne dirait pas ce qu'un robot en fait. */

const { rules } = robots();

function groupFor(agent) {
  const groups = [rules].flat().map((rule) => ({
    agents: [rule.userAgent ?? "*"].flat().map((name) => name.toLowerCase()),
    allow: [rule.allow ?? []].flat(),
    disallow: [rule.disallow ?? []].flat(),
  }));
  return groups.find((group) => group.agents.includes(agent.toLowerCase())) ?? groups.find((group) => group.agents.includes("*"));
}

function toPattern(rule) {
  const isAnchored = rule.endsWith("$");
  const body = (isAnchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${isAnchored ? "$" : ""}`);
}

function isAllowed(agent, path) {
  const group = groupFor(agent);
  const longest = (list) => list.filter((rule) => rule !== "" && toPattern(rule).test(path)).reduce((best, rule) => Math.max(best, rule.length), -1);
  const disallow = longest(group.disallow);
  return disallow === -1 || longest(group.allow) >= disallow;
}

const PUBLIC_PAGES = ["/", "/annonces", "/pokemon", "/pokemon/avignon", "/annonces/vrac-400-cartes-pokemon-avignon-01", "/recherches", "/profil/lecomptoirdukado"];

test("les robots d'entraînement n'ont droit qu'à la page d'accueil", () => {
  for (const agent of AI_TRAINING_CRAWLERS) {
    assert.ok(isAllowed(agent, "/"), `${agent} ne voit plus l'accueil`);
    for (const path of PUBLIC_PAGES.slice(1)) assert.ok(!isAllowed(agent, path), `${agent} lit ${path}`);
  }
});

test("les moteurs de recherche, ceux des assistants compris, lisent tout ce qui est public", () => {
  for (const agent of ["Googlebot", "Bingbot", "OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "PerplexityBot"]) {
    for (const path of PUBLIC_PAGES) assert.ok(isAllowed(agent, path), `${agent} ne lit pas ${path}`);
  }
});

test("les combinaisons de filtres ne s'explorent pas, la pagination si", () => {
  assert.ok(!isAllowed("Googlebot", "/pokemon?etat=NM&tri=recent"));
  assert.ok(!isAllowed("Googlebot", "/annonces?q=classeur"));
  assert.ok(!isAllowed("Googlebot", "/pokemon/avignon?rayon=25"));
  assert.ok(!isAllowed("Googlebot", "/recherches?jeu=magic"));
  assert.ok(isAllowed("Googlebot", "/pokemon?page=2"));
  assert.ok(isAllowed("Googlebot", "/annonces?page=3"));
});

test("les images de partage, les icônes et l'optimiseur d'images restent ouverts", () => {
  /* Ils portent un paramètre : une règle « /*? » les aurait coupés, et avec
     eux l'aperçu d'une annonce collée sur Facebook. */
  for (const agent of ["Googlebot", "facebookexternalhit", "WhatsApp"]) {
    for (const path of ["/annonces/vrac-400-cartes-pokemon-avignon-01/opengraph-image/1som3eh?a286e5d41651270a", "/icon/192?679453bc1a5980b0", "/_next/image?url=%2Fx.webp&w=640&q=75"]) {
      assert.ok(isAllowed(agent, path), `${agent} ne peut pas lire ${path}`);
    }
  }
});

test("les images de partage des pages de jeu et de ville restent lisibles par Google", () => {
  /* « /pokemon/*? » écarte les combinaisons de filtres d'une page de ville ;
     il écartait aussi son image de partage, qui porte une empreinte. */
  for (const path of ["/pokemon/avignon/opengraph-image/3f2a?06eff6b64931f29c", "/pokemon/opengraph-image/9c1d?06eff6b64931f29c"]) {
    assert.ok(isAllowed("Googlebot", path), `Googlebot ne lit pas ${path}`);
  }
  /* Les combinaisons de filtres, elles, restent fermées. */
  assert.ok(!isAllowed("Googlebot", "/pokemon/avignon?rayon=25"));
});

test("les robots d'aperçu lisent une recherche partagée, jamais l'espace d'un compte", () => {
  for (const agent of LINK_PREVIEW_BOTS) {
    assert.ok(isAllowed(agent, "/pokemon?etat=NM"), `${agent} ne prévisualise pas une recherche partagée`);
    assert.ok(isAllowed(agent, "/annonces/vrac-400-cartes-pokemon-avignon-01"));
    assert.ok(!isAllowed(agent, "/mon-compte/annonces"));
  }
  /* Aucun robot d'aperçu n'est traité comme un robot d'entraînement. */
  const training = new Set(AI_TRAINING_CRAWLERS.map((agent) => agent.toLowerCase()));
  for (const agent of LINK_PREVIEW_BOTS) assert.ok(!training.has(agent.toLowerCase()), `${agent} est dans la liste d'entraînement`);
});

test("l'espace d'un compte n'est ouvert à aucun robot", () => {
  for (const path of ["/mon-compte", "/messages/c-01", "/deposer", "/connexion", "/mot-de-passe-oublie", "/notifications"]) {
    assert.ok(!isAllowed("Googlebot", path), `Googlebot lit ${path}`);
  }
});
