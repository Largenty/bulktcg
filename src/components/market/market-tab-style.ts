/* Le dessin de la bascule « Ventes / Recherches », écrit une fois. Sur une
   page de jeu ou de ville ce sont des onglets (MarketTabs) ; sur le hub des
   recherches, des liens entre deux pages (MarketNav). Le geste est le même,
   le dessin doit l'être. Seule la variante d'état change, aria-selected pour
   un onglet, aria-current pour un lien.

   Un interrupteur encadré, pas une rangée d'onglets soulignés : sous la
   manchette il y a déjà les intercalaires des jeux, et deux rangées
   d'onglets superposées ne disent plus laquelle commande quoi. */
export const MARKET_TAB_ROW =
  "inline-flex gap-1 rounded-[var(--radius-md)] border-[length:var(--border-width-strong)] border-[var(--ink)] bg-[var(--card)] p-1";

export const MARKET_TAB =
  "flex min-h-[40px] items-center gap-2 rounded-[var(--radius-sm)] px-3.5 text-[length:var(--text-md)] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--ink)]";

/* Le côté affiché, cerné d'encre et non rempli : l'aplat est réservé aux
   gestes. */
export const MARKET_TAB_SELECTED =
  "aria-selected:bg-[var(--tint)] aria-selected:text-[var(--ink)] aria-selected:shadow-[inset_0_0_0_var(--border-width-strong)_var(--ink)]";

export const MARKET_TAB_CURRENT =
  "aria-[current=page]:bg-[var(--tint)] aria-[current=page]:text-[var(--ink)] aria-[current=page]:shadow-[inset_0_0_0_var(--border-width-strong)_var(--ink)]";

export const MARKET_TAB_COUNT = "mono text-[length:var(--text-xs)] opacity-80";
