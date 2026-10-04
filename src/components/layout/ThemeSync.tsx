"use client";

import { useEffect, useLayoutEffect } from "react";
import { THEME_STORAGE_KEY, applyThemeAttribute, readStoredChoice } from "@/lib/theme";

/* Monté une fois, ne rend rien. En développement, le double montage de React
   efface les attributs que le script de <head> avait posés sur <html> : on
   les repose avant la peinture. Et un choix fait dans un autre onglet
   s'applique ici aussi. */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyThemeAttribute(readStoredChoice());
  }, []);

  useEffect(() => {
    const follow = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) applyThemeAttribute(readStoredChoice());
    };
    window.addEventListener("storage", follow);
    return () => window.removeEventListener("storage", follow);
  }, []);

  return null;
}
