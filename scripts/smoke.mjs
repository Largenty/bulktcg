/* Parcours interactifs sur le site construit.
   Complète les captures : une capture ne dit pas si un bouton répond.
   Prérequis : npm run build puis npx next start -p 3117.

   Les parcours vivent dans scripts/smoke/, un module par domaine ; ce
   fichier les joue dans l'ordre où ils ont été écrits. Cet ordre compte :
   plusieurs parcours reprennent la page là où le précédent l'a laissée — un
   formulaire rempli, un onglet ouvert, un défilement. Chaque appel joue une
   suite de parcours consécutifs d'un même domaine : en déplacer un, c'est
   d'abord vérifier ce que son premier parcours attend de la page. */
import * as accessibility from "./smoke/accessibility.mjs";
import * as account from "./smoke/account.mjs";
import * as lifecycle from "./smoke/lifecycle.mjs";
import * as proStatus from "./smoke/pro-status.mjs";
import * as consoleChecks from "./smoke/console.mjs";
import * as ads from "./smoke/ads.mjs";
import * as csp from "./smoke/csp.mjs";
import * as deposit from "./smoke/deposit.mjs";
import * as editions from "./smoke/editions.mjs";
import * as harness from "./smoke/harness.mjs";
import * as listings from "./smoke/listings.mjs";
import * as messaging from "./smoke/messaging.mjs";
import * as mobile from "./smoke/mobile.mjs";
import * as navigation from "./smoke/navigation.mjs";
import * as perf from "./smoke/perf.mjs";
import * as photos from "./smoke/photos.mjs";
import * as pro from "./smoke/pro.mjs";
import * as sector from "./smoke/sector.mjs";
import * as seo from "./smoke/seo.mjs";
import * as sticky from "./smoke/sticky.mjs";
import * as templates from "./smoke/templates.mjs";
import * as theme from "./smoke/theme.mjs";
import * as wanted from "./smoke/wanted.mjs";

/* Les suites, nommées « module.suite », dans l'ordre où elles se jouent. */
const SUITES = [
  ["listings.searchFiltersAndPagination", listings.searchFiltersAndPagination],
  ["listings.cardBand", listings.cardBand],
  ["ads.slots", ads.slots],
  ["listings.customSelect", listings.customSelect],
  ["account.statusSwitch", account.statusSwitch],
  ["deposit.listingForm", deposit.listingForm],
  ["photos.gallery", photos.gallery],
  ["navigation.skipLink", navigation.skipLink],
  ["listings.servedAndIndexed", listings.servedAndIndexed],
  ["harness.trackedRequests", harness.trackedRequests],
  ["photos.loadingAndWatermark", photos.loadingAndWatermark],
  ["wanted.publicList", wanted.publicList],
  ["account.dashboard", account.dashboard],
  ["wanted.cityAndDeposit", wanted.cityAndDeposit],
  ["templates.rightEdge", templates.rightEdge],
  ["listings.otherGame", listings.otherGame],
  ["ads.noneOnAccount", ads.noneOnAccount],
  ["account.longPseudo", account.longPseudo],
  ["editions.filters", editions.filters],
  ["editions.inListingForm", editions.inListingForm],
  ["editions.fromServer", editions.fromServer],
  ["editions.search", editions.search],
  ["navigation.gamesMenu", navigation.gamesMenu],
  ["navigation.marketTabs", navigation.marketTabs],
  ["pro.offer", pro.offer],
  ["deposit.options", deposit.options],
  ["templates.home", templates.home],
  ["wanted.filters", wanted.filters],
  ["listings.gamePageFilters", listings.gamePageFilters],
  ["sticky.columns", sticky.columns],
  ["listings.gamePageSearchAndIndexing", listings.gamePageSearchAndIndexing],
  ["templates.edgesAndHeadings", templates.edgesAndHeadings],
  ["theme.darkMode", theme.darkMode],
  ["navigation.searchBarFocus", navigation.searchBarFocus],
  ["account.signInPages", account.signInPages],
  ["photos.credit", photos.credit],

  /* ----------------------------------------------------------------
     Défauts relevés à l'audit de septembre 2026. Chacun de ces parcours
     aurait attrapé le défaut qu'il porte dans son nom.
     ---------------------------------------------------------------- */

  ["mobile.phoneScreens", mobile.phoneScreens],
  ["messaging.contact", messaging.contact],
  ["deposit.formAudit", deposit.formAudit],
  ["listings.searchAudit", listings.searchAudit],
  ["account.slateTab", account.slateTab],
  ["messaging.threads", messaging.threads],
  ["account.dealsAndProfiles", account.dealsAndProfiles],
  ["lifecycle.expiryAndArchive", lifecycle.expiryAndArchive],
  ["proStatus.proStatus", proStatus.proStatus],
  ["navigation.headerWidths", navigation.headerWidths],
  ["photos.noPhotoLabel", photos.noPhotoLabel],
  ["messaging.inbox", messaging.inbox],
  ["templates.pageTitleStep", templates.pageTitleStep],
  ["theme.inkRoles", theme.inkRoles],
  ["templates.containerHeadline", templates.containerHeadline],
  ["seo.sharing", seo.sharing],
  ["sector.map", sector.map],
  ["perf.prefetch", perf.prefetch],
  ["accessibility.audit", accessibility.audit],
  ["csp.policy", csp.policy],
  ["console.quiet", consoleChecks.quiet],
];

/* SMOKE_ONLY=deposit.formAudit,theme joue les suites nommées — ou toutes
   celles d'un module — sans le reste : un parcours corrigé se revérifie en
   quelques secondes au lieu de rejouer les 165. L'ordre reste celui de la
   liste ; une suite qui reprend la page là où la précédente l'a laissée se
   demande avec elle. */
const only = (process.env.SMOKE_ONLY ?? "").split(",").map((name) => name.trim()).filter(Boolean);
const selected = only.length === 0 ? SUITES : SUITES.filter(([name]) => only.some((wanted) => name === wanted || name.startsWith(`${wanted}.`)));
if (selected.length === 0) {
  console.error(`SMOKE_ONLY ne désigne aucune suite : ${only.join(", ")}. Suites connues : ${SUITES.map(([name]) => name).join(", ")}`);
  process.exit(2);
}
for (const [, run] of selected) await run();
await harness.finish();
