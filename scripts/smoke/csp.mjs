/* La politique de sécurité du contenu, telle que le navigateur la reçoit :
   aucun script ne s'exécute sans le nonce de sa réponse, aucune page ne
   déclenche de violation, et un script glissé dans le HTML reste lettre
   morte. Le prix — chaque page rendue à la demande — ne s'étend pas à ce qui
   ne porte aucun script : icônes, images de partage, plan de site. */
import assert from "node:assert/strict";
import { BASE, browser, check } from "./harness.mjs";
import { OWN_LISTING } from "./fixtures.mjs";
import { visit } from "./helpers.mjs";

/* Un gabarit de chaque sorte, dont ceux qui étaient prérendus au build, et
   une page 404. */
const PAGES = [
  "/",
  "/pokemon",
  "/pokemon/avignon",
  `/annonces/${OWN_LISTING}`,
  "/profil/lecomptoirdukado",
  "/recherches",
  "/deposer",
  "/connexion",
  "/mon-compte",
  "/securite",
  "/page-inexistante",
];

/* Les directives d'une politique, chacune avec ses sources. */
const directivesOf = (policy) =>
  new Map(policy.split(";").map((directive) => directive.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...sources]) => [name, sources]));

/* Le nonce de la réponse, et chaque balise <script> du HTML avec le sien. Un
   bloc de données (JSON-LD) ne s'exécute pas : la CSP ne le regarde pas. */
async function scriptsOf(path) {
  const response = await fetch(`${BASE}${path}`);
  const policy = response.headers.get("content-security-policy") ?? "";
  const nonce = (directivesOf(policy).get("script-src") ?? []).find((source) => source.startsWith("'nonce-"))?.slice(7, -1) ?? null;
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)]
    .map(([tag, attributes]) => ({ tag, type: attributes.match(/\btype="([^"]*)"/)?.[1], nonce: attributes.match(/\bnonce="([^"]*)"/)?.[1] }))
    .filter(({ type }) => !/json/.test(type ?? ""));
  return { policy, nonce, scripts };
}

/* Les en-têtes de requête que le proxy lit ou que Next interprète. Un client
   les choisit tous : aucun ne doit lui valoir une page sans CSP, ni lui faire
   choisir le nonce. Seul le préchargement du routeur — « RSC » et
   « Next-Router-Prefetch » valant 1 tous les deux — est écarté du proxy : il
   doit rester du flux RSC, jamais une page. « RSC » mal formé, Next sert la
   page : « 0 », « true », ou « 1, 1 », deux en-têtes joints. */
const REQUEST_VARIANTS = [
  {},
  { "next-router-prefetch": "1" },
  { "next-router-segment-prefetch": "/_tree" },
  { purpose: "prefetch" },
  { "sec-purpose": "prefetch;prerender" },
  { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" },
  { rsc: "1", "next-router-prefetch": "1" },
  { rsc: "0", "next-router-prefetch": "1" },
  { rsc: "true", "next-router-prefetch": "1" },
  { rsc: "1, 1", "next-router-prefetch": "1" },
];
const FORGED_NONCE = "Zm91cm5pcGFybGVjbGllbnQ=";

/* Consigne chaque violation dans la page, dès sa naissance. */
function recordViolations() {
  window.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__cspViolations.push(`${event.effectiveDirective} ← ${event.blockedURI || "en ligne"} ${event.sample}`.trim());
  });
}

export async function policy() {
  await check("chaque page reçoit une seule CSP, sans 'unsafe-inline' ni eval pour les scripts, et un nonce neuf", async () => {
    for (const path of PAGES) {
      const [first, second] = [await scriptsOf(path), await scriptsOf(path)];
      /* Deux en-têtes arriveraient ici joints par une virgule : le navigateur
         appliquerait les deux, et celui sans nonce refuserait tout. */
      assert.equal(first.policy.match(/default-src/g)?.length, 1, `${path} : ${first.policy || "aucune CSP"}`);
      const scripts = directivesOf(first.policy).get("script-src") ?? [];
      assert.ok(!scripts.includes("'unsafe-inline'") && !scripts.includes("'unsafe-eval'"), `${path} : script-src ${scripts.join(" ")}`);
      assert.ok(first.nonce, `${path} : aucun nonce dans script-src`);
      assert.notEqual(second.nonce, first.nonce, `${path} : le même nonce sert deux réponses`);
    }
  });

  await check("toute réponse HTML porte la CSP, quels que soient les en-têtes de la requête, et jamais le nonce qu'elle fournit", async () => {
    /* La page demandée avec le seul « Next-Router-Prefetch » sortait en HTML,
       sans CSP, et ses scripts portaient le nonce glissé dans x-nonce. */
    const forged = { "x-nonce": FORGED_NONCE, "content-security-policy": `script-src 'nonce-${FORGED_NONCE}'` };
    for (const variant of REQUEST_VARIANTS) {
      for (const path of ["/pokemon", "/page-inexistante"]) {
        const label = `${path} ${JSON.stringify(variant)}`;
        const response = await fetch(`${BASE}${path}`, { headers: { ...variant, ...forged } });
        const type = response.headers.get("content-type") ?? "";
        const body = await response.text();
        if (variant.rsc === "1") {
          assert.match(type, /^text\/x-component/, `${label} : ${type}`);
          continue;
        }
        assert.match(type, /^text\/html/, `${label} : ${type}`);
        const policy = response.headers.get("content-security-policy") ?? "";
        assert.equal(policy.match(/default-src/g)?.length, 1, `${label} : ${policy || "aucune CSP"}`);
        assert.ok(!body.includes(FORGED_NONCE), `${label} : la page porte le nonce fourni par la requête`);
      }
    }
  });

  await check("tout script de la page porte le nonce de sa réponse", async () => {
    /* Le flux RSC de Next, son amorce, ses morceaux et le script de thème.
       Une page figée au build aurait gardé des scripts sans nonce, que la CSP
       refuse : la page ne s'hydraterait plus. */
    for (const path of PAGES) {
      const { nonce, scripts } = await scriptsOf(path);
      assert.ok(scripts.length >= 3, `${path} : ${scripts.length} script(s) seulement`);
      const strays = scripts.filter((script) => script.nonce !== nonce).map(({ tag }) => tag.slice(0, 80));
      assert.deepEqual(strays, [], `${path} : scripts sans le nonce de la réponse`);
    }
  });

  await check("aucune page ne déclenche de violation, et toutes s'hydratent", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-FR" });
    await context.addInitScript(recordViolations);
    const tab = await context.newPage();
    try {
      for (const path of PAGES) {
        await visit(tab, path);
        // eslint-disable-next-line bulktcg/playwright-locators -- prouver une absence de violation : chaque script doit être arrivé
        await tab.waitForLoadState("networkidle");
        /* window.next existe quand l'amorce de Next a tourné, et le flux RSC
           en ligne quand ses scripts ont été admis. */
        const state = await tab.evaluate(() => ({ started: typeof window.next?.version === "string", flight: Array.isArray(self.__next_f), violations: window.__cspViolations }));
        assert.ok(state.started && state.flight, `${path} : Next n'a pas démarré`);
        assert.deepEqual(state.violations, [], `${path} : violation de CSP`);
      }
      /* Une navigation côté client charge d'autres morceaux, insérés par le
         script de Next : 'strict-dynamic' doit les admettre. */
      await visit(tab, "/");
      await tab.locator("a.divider").nth(1).click();
      await tab.waitForURL((url) => url.pathname !== "/");
      // eslint-disable-next-line bulktcg/playwright-locators -- même preuve après la navigation : ses morceaux doivent être arrivés
      await tab.waitForLoadState("networkidle");
      assert.deepEqual(await tab.evaluate(() => window.__cspViolations), [], "violation après une navigation côté client");
    } finally {
      await context.close();
    }
  });

  await check("un script glissé dans le HTML sans le nonce ne s'exécute pas", async () => {
    /* Ce que 'unsafe-inline' laissait passer : une injection dans la page. La
       réponse garde ses en-têtes, seule la page reçoit le script en plus. */
    const context = await browser.newContext();
    await context.addInitScript(recordViolations);
    await context.route(`${BASE}/securite`, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace("</body>", "<script>window.__injected = true</script></body>");
      await route.fulfill({ response, body });
    });
    const tab = await context.newPage();
    try {
      await visit(tab, "/securite");
      // eslint-disable-next-line bulktcg/playwright-locators -- prouver que le script injecté ne s'exécute pas : la page doit avoir tout chargé
      await tab.waitForLoadState("networkidle");
      const state = await tab.evaluate(() => ({ injected: window.__injected === true, started: typeof window.next?.version === "string", violations: window.__cspViolations }));
      assert.equal(state.injected, false, "le script injecté s'est exécuté");
      assert.ok(state.started, "la page elle-même ne démarre plus");
      assert.ok(state.violations.some((violation) => violation.startsWith("script-src")), `aucune violation relevée : ${state.violations.join(" | ")}`);
    } finally {
      await context.close();
    }
  });

  await check("ce qui ne porte aucun script reste statique : icônes, images de partage, plan de site", async () => {
    const listing = await (await fetch(`${BASE}/annonces/${OWN_LISTING}`)).text();
    const shareImage = new URL(listing.match(/<meta property="og:image" content="([^"]+)"/)[1]).pathname;
    for (const path of ["/icon/32", "/apple-icon", "/opengraph-image", shareImage, "/sitemap.xml", "/robots.txt"]) {
      await fetch(`${BASE}${path}`);
      const response = await fetch(`${BASE}${path}`);
      assert.equal(response.status, 200, `${path} : ${response.status}`);
      assert.match(response.headers.get("x-nextjs-cache") ?? "", /^(HIT|STALE)$/, `${path} n'est plus servi depuis le cache`);
    }
  });
}
