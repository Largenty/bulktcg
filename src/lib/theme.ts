/* Le thème clair ou sombre.

   Le choix de l'utilisateur vit dans localStorage : « light », « dark », ou
   rien — suivre l'appareil. Un script inline, dans <head>, le lit et pose
   data-theme sur <html> AVANT la première peinture, mais seulement pour un
   choix explicite. En « système », il n'écrit rien : la media query de
   tokens.css suit l'appareil, y compris quand il bascule pendant la visite
   (réglage automatique du soir), sans écouteur JavaScript. Et sans
   JavaScript du tout — script bloqué, page d'erreur racine — elle suit
   encore l'appareil. */

export const THEME_STORAGE_KEY = "theme";

export type ThemeChoice = "system" | "light" | "dark";

/* Chaîne exécutée telle quelle dans le navigateur : ES5, sans dépendance. */
export const THEME_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_STORAGE_KEY}");if(c==="light"||c==="dark")document.documentElement.setAttribute("data-theme",c)}catch(e){}})()`;

export function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/* Le choix en vigueur, lu sur <html> : juste même si le stockage est bloqué. */
export function readAppliedChoice(): ThemeChoice {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "light" || value === "dark" ? value : "system";
}

export function applyThemeAttribute(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/* Pose le thème et retient le choix. « system » efface la clé : le site suit
   alors de nouveau l'appareil. Les transitions sont coupées le temps de deux
   images : sinon les boutons (120 ms) changeraient de couleur après la page. */
export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* Stockage bloqué : le choix vaut pour cette page. */
  }
  const root = document.documentElement;
  root.setAttribute("data-theme-switching", "");
  applyThemeAttribute(choice);
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute("data-theme-switching")));
}

export function subscribeToAppliedChoice(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function readResolvedTheme(): "light" | "dark" {
  const choice = readAppliedChoice();
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function subscribeToResolvedTheme(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const stop = subscribeToAppliedChoice(onChange);
  query.addEventListener("change", onChange);
  return () => {
    stop();
    query.removeEventListener("change", onChange);
  };
}
