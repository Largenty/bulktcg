import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/* Vrai une fois la page prise en main par React, faux au rendu du serveur
   et pendant l'hydratation : de quoi ne montrer qu'avec JavaScript un
   contrôle qui ne sert qu'avec lui, sans désaccord d'hydratation. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
