import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { MARKET_FRAGMENT } from "@/lib/routes";

/* Le côté du marché qu'on regarde. Le fragment de l'adresse le porte (voir
   MARKET_FRAGMENT), et c'est sa seule vérité : la bascule s'y abonne comme à
   n'importe quelle source extérieure (useSyncExternalStore). */
export type MarketView = "sell" | "buy";

/* La vue que dit un fragment, ou null quand il n'en dit rien. Sans fragment,
   la page est telle qu'on y arrive : les ventes. Tout autre fragment —
   #contenu, que pose le lien d'évitement — n'appartient pas à la bascule. */
function viewOfFragment(fragment: string): MarketView | null {
  if (fragment === MARKET_FRAGMENT.buy) return "buy";
  if (fragment === MARKET_FRAGMENT.sell || fragment === "") return "sell";
  return null;
}

/* La dernière vue qu'un fragment a dite. Un fragment étranger laisse la
   bascule où elle est : lu comme « pas les recherches », #contenu renvoyait
   aux ventes la personne au clavier qui venait de choisir les recherches. */
let lastView: MarketView = "sell";

function readAddressView(): MarketView {
  lastView = viewOfFragment(window.location.hash.slice(1)) ?? lastView;
  return lastView;
}

/* La vue qu'une navigation emporte vers sa page d'arrivée, notée au départ.
   Next n'écrit la nouvelle adresse qu'en affichant la page : pendant le
   rendu de celle-ci, window.location est encore l'adresse quittée, et son
   fragment ne dit rien de la page qui arrive. */
let departure: { from: string; path: string; view: MarketView } | null = null;

/* Note la vue qu'emporte une navigation vers `url`, et rend `url`. Les
   intercalaires s'en servent. Les filtres n'en ont pas besoin : ils restent
   sur le même chemin, où l'ancien fragment dit déjà l'onglet ouvert. */
export function departFor(url: string): string {
  const target = new URL(url, window.location.href);
  departure = { from: window.location.href, path: target.pathname, view: viewOfFragment(target.hash.slice(1)) ?? "sell" };
  return url;
}

/* Arrivée : la note a servi, et ne doit pas resservir au prochain départ
   de la même adresse vers la même page. */
function forgetDeparture(path: string): void {
  if (departure?.path === path) departure = null;
}

/* La vue de la page d'adresse `path`. Tant que l'adresse ne l'a pas
   rejointe, c'est celle que la navigation a emportée, sinon les ventes : un
   lien ordinaire n'emporte rien. Lire l'ancien fragment ouvrait la page
   d'arrivée sur les recherches le temps d'une image. */
function readMarketView(path: string): MarketView {
  if (window.location.pathname === path) return readAddressView();
  return departure !== null && departure.path === path && departure.from === window.location.href ? departure.view : "sell";
}

/* Le serveur ne voit pas le fragment : il rend les ventes, et l'hydratation
   passe ensuite à la vue de l'adresse. */
const serverMarketView = (): MarketView => "sell";

const listeners = new Set<() => void>();

/* Le navigateur prévient par hashchange quand le fragment change sous ses
   propres gestes — retour arrière, lien d'ancre. Une bascule écrite par
   showMarketView ne l'émet pas : elle prévient elle-même. */
function subscribeToMarketView(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("hashchange", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("hashchange", onChange);
  };
}

/* Le fragment qu'un filtre ou un intercalaire emporte vers l'adresse
   suivante : celui de la bascule, et aucun autre. #contenu, posé par le lien
   d'évitement, ne dit rien de la liste suivante ; l'onglet qu'il a laissé
   ouvert, si — sans lui, filtrer les demandes juste après l'avoir suivi
   rouvrirait les ventes. Sans bascule dans la page, seul un fragment de la
   bascule déjà dans l'adresse passe. */
export function carriedMarketFragment(): string {
  const fragment = window.location.hash.slice(1);
  if (fragment === MARKET_FRAGMENT.sell || fragment === MARKET_FRAGMENT.buy) return `#${fragment}`;
  return listeners.size > 0 && readAddressView() === "buy" ? `#${MARKET_FRAGMENT.buy}` : "";
}

/* Montre une vue, en une entrée d'historique que le retour arrière défait.
   history.pushState, et non location.assign : Next recopie son propre état
   dans l'entrée ajoutée. Celle de location.assign n'en avait aucun, le
   routeur ignorait le retour vers elle, et un filtre posé ensuite quittait
   l'adresse sans quitter la liste. */
export function showMarketView(view: MarketView): void {
  window.history.pushState(null, "", `#${MARKET_FRAGMENT[view]}`);
  for (const notify of listeners) notify();
}

/* La vue affichée. usePathname() donne le chemin de la page qui se rend —
   la nouvelle, pendant une navigation —, quand window.location est encore
   l'adresse quittée : c'est ainsi qu'on sait l'adresse en retard.

   Next branche son intégration à l'historique dans un effet : une bascule
   faite juste après l'hydratation, avant elle, écrit une entrée sans état,
   que le retour arrière ignorerait. React vide les effets en attente avant
   tout nouveau rendu — quand celui de la bascule s'achève, Next est prêt, et
   réécrire l'entrée lui fait recopier l'arbre de la page. */
export function useMarketView(): MarketView {
  const path = usePathname();
  const view = useSyncExternalStore(subscribeToMarketView, () => readMarketView(path), serverMarketView);
  useEffect(() => {
    if (window.history.state === null) window.history.replaceState(null, "", window.location.href);
  }, [view]);
  useEffect(() => {
    forgetDeparture(path);
  }, [path]);
  return view;
}
