"use client";

import { useEffect } from "react";

/* Monté une fois, ne rend rien. Un lien d'ancre — le lien d'évitement,
   #contenu — ajoute une entrée d'historique que le navigateur crée sans état,
   et le routeur de Next ignore le retour vers une entrée sans état : filtrer
   après le lien d'évitement, puis revenir, ramenait l'adresse sans la liste.
   Réécrite par history.replaceState, que Next intègre à son routeur, l'entrée
   reçoit l'arbre de la page affichée, qui est bien le sien.

   Une entrée restée sans état parce qu'on a suivi une ancre avant
   l'hydratation n'est pas rattrapée au retour : elle appartient à la page
   d'arrivée, que l'entrée suivante — reprise par Next à l'hydratation — a
   déjà restaurée quand on y revient pas à pas. Seul un saut de plusieurs
   entrées d'un coup la laisserait périmée, et la seule réparation serait de
   recharger la page. */
export function FragmentHistorySync() {
  useEffect(() => {
    const adopt = () => {
      if (window.history.state === null) window.history.replaceState(null, "", window.location.href);
    };
    window.addEventListener("hashchange", adopt);
    return () => window.removeEventListener("hashchange", adopt);
  }, []);

  return null;
}
