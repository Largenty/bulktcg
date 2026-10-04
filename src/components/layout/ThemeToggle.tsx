"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { readResolvedTheme, saveThemeChoice, subscribeToResolvedTheme } from "@/lib/theme";

/* L'interrupteur de l'en-tête : un clic passe du clair au sombre et
   inversement. Un nom stable et aria-pressed plutôt qu'un libellé qui change
   (« Passer en mode clair »), que les lecteurs d'écran ne relisent pas
   toujours. L'icône suit le thème en CSS (classes theme-when-*) : juste dès
   la première peinture, sans attendre l'hydratation. Le retour au réglage de
   l'appareil se fait dans le pied de page, le menu ou les paramètres. */
export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribeToResolvedTheme, () => readResolvedTheme() === "dark", () => false);

  return (
    <button type="button" aria-pressed={isDark} onClick={() => saveThemeChoice(isDark ? "light" : "dark")} className={className}>
      <Icon name="moon" size={18} className="theme-when-light" />
      <Icon name="sun" size={18} className="theme-when-dark" />
      <span className="sr-only">Mode sombre</span>
    </button>
  );
}
