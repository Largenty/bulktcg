"use client";

import { useEffect, useRef, useState } from "react";
import type { City } from "@/lib/city-label";
import { routes } from "@/lib/routes";

/* Ce que la route de suggestions répond pour une saisie : la commune qu'elle
   désigne sans ambiguïté, s'il y en a une, et la liste à proposer. */
export type CityAnswer = { query: string; match: City | null; suggestions: City[] };

const NO_ANSWER: CityAnswer = { query: "", match: null, suggestions: [] };

/* Assez pour ne pas interroger le serveur à chaque lettre d'un nom tapé
   d'un trait, assez peu pour que la liste suive la frappe. */
const TYPING_PAUSE_MS = 120;

/* Les communes que le serveur propose pour une saisie (routes.communeSuggestions) :
   le référentiel ne part pas dans le navigateur. Synchronisation avec
   l'extérieur, donc un effet, nettoyé à chaque frappe — la requête de la
   saisie précédente est abandonnée.

   `onAnswer` est prévenu de chaque réponse, même arrivée après que le champ
   a perdu le focus : « 84000 » tapé puis quitté devient Avignon quand la
   réponse arrive, comme quand le référentiel était dans la page. */
export function useCitySuggestions(query: string, isEnabled: boolean, onAnswer?: (answer: CityAnswer) => void): CityAnswer {
  const [answer, setAnswer] = useState<CityAnswer>(NO_ANSWER);
  const latestOnAnswer = useRef(onAnswer);
  useEffect(() => {
    latestOnAnswer.current = onAnswer;
  });

  const value = query.trim();
  useEffect(() => {
    if (!isEnabled || value === "") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(routes.communeSuggestions(value), { signal: controller.signal })
        .then((response) => (response.ok ? (response.json() as Promise<Omit<CityAnswer, "query">>) : null))
        .then((body) => {
          if (!body) return;
          const next = { query: value, match: body.match, suggestions: body.suggestions };
          setAnswer(next);
          latestOnAnswer.current?.(next);
        })
        /* Abandonnée par la frappe suivante, ou réseau coupé : la liste
           précédente reste, et le serveur vérifiera la commune à l'envoi. */
        .catch(() => undefined);
    }, TYPING_PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, isEnabled]);

  return answer;
}
