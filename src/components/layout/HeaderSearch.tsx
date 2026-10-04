"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { routes } from "@/lib/routes";

/* La recherche reste sous la main sur toutes les pages : c'est le premier
   geste d'un acheteur, et le dernier recours de celui qui s'est perdu.
   Formulaire GET nu vers la liste — il marche sans JavaScript.
   Absente de l'accueil, où la grande barre du héros fait le même travail
   avec deux champs : deux recherches superposées se disputeraient l'œil. */
export function HeaderSearch() {
  const pathname = usePathname();
  if (pathname === "/") return <div className="hidden flex-1 lg:block" />;

  return (
    /* Nommée : sur une page de liste, elle côtoie la recherche de la page, et
       deux repères « recherche » sans nom ne se distinguent pas. */
    <form
      action={routes.listings}
      method="get"
      role="search"
      aria-label="Chercher sur tout le site"
      className="hidden max-w-[440px] flex-1 lg:block"
    >
      <label htmlFor="recherche-entete" className="sr-only">
        Chercher un lot
      </label>
      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          id="recherche-entete"
          name="q"
          type="search"
          placeholder="Vrac, display, EV08…"
          className="h-10 w-full rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--paper)] pl-10 pr-3 text-[length:var(--text-md)] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] hover:border-[var(--ink)] focus-visible:border-[var(--ink)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        />
      </div>
    </form>
  );
}
