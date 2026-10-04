"use client";

import { useId, useRef, type ReactNode } from "react";
import { MARKET_TAB, MARKET_TAB_COUNT, MARKET_TAB_ROW, MARKET_TAB_SELECTED } from "@/components/market/market-tab-style";
import { showMarketView, useMarketView, type MarketView } from "@/components/market/market-view";
import { formatCount } from "@/lib/format";

const VIEWS = ["sell", "buy"] as const satisfies readonly MarketView[];

/* Le motif d'onglets de l'APG : les flèches passent à l'onglet voisin, en
   boucle — avec deux côtés, c'est toujours l'autre —, Home au premier et
   End au dernier. Les autres touches ne font rien. */
const OTHER_VIEW: Record<MarketView, MarketView> = { sell: "buy", buy: "sell" };

function viewForKey(key: string, view: MarketView): MarketView | null {
  if (key === "ArrowRight" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowUp") return OTHER_VIEW[view];
  if (key === "Home") return VIEWS[0];
  if (key === "End") return VIEWS[1];
  return null;
}

type MarketTabsProps = {
  label: string;
  counts: Record<MarketView, number>;
  panels: Record<MarketView, ReactNode>;
  /* La manchette de la page, posée sur la même ligne que la bascule : elle
     dit de quel marché on parle, la bascule de quel côté. */
  lead?: ReactNode;
  /* Ce qui vaut pour les deux côtés — la recherche, les intercalaires des
     jeux — entre la bascule et les panneaux. */
  between?: ReactNode;
};

const TAB_LABELS: Record<MarketView, string> = { sell: "Ventes", buy: "Recherches" };

/* Les deux côtés du marché sur la même page. Les deux panneaux sont rendus
   par le serveur et vivent dans le HTML : la bascule ne va rien chercher,
   elle montre. Le panneau inactif porte `hidden`, ce qui le retire aussi de
   l'arbre d'accessibilité — le masquer en CSS l'aurait laissé lisible par un
   lecteur d'écran, qui aurait annoncé deux listes concurrentes. */
export function MarketTabs({ label, counts, panels, lead, between }: MarketTabsProps) {
  const view = useMarketView();
  const baseId = useId();
  const tabRefs = useRef<Record<MarketView, HTMLButtonElement | null>>({ sell: null, buy: null });

  /* On écrit le fragment et la vue suit : une seule source de vérité, que
     le bouton retour défait par le même chemin (voir market-view.ts). */
  function select(next: MarketView) {
    if (next === view) return;
    showMarketView(next);
    tabRefs.current[next]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const target = viewForKey(event.key, view);
    if (target === null) return;
    event.preventDefault();
    select(target);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      {lead}
      <div
        role="tablist"
        aria-label={label}
        className={MARKET_TAB_ROW}
      >
        {VIEWS.map((candidate) => (
          <button
            key={candidate}
            ref={(node) => {
              tabRefs.current[candidate] = node;
            }}
            type="button"
            role="tab"
            id={`${baseId}-${candidate}`}
            aria-selected={view === candidate}
            aria-controls={`${baseId}-${candidate}-panel`}
            /* Tabindex mobile : la tabulation entre dans la barre d'onglets
               une seule fois, les flèches circulent ensuite à l'intérieur. */
            tabIndex={view === candidate ? 0 : -1}
            onClick={() => select(candidate)}
            onKeyDown={handleKeyDown}
            className={`${MARKET_TAB} ${MARKET_TAB_SELECTED}`}
          >
            {TAB_LABELS[candidate]}
            <span className={MARKET_TAB_COUNT}>
              {formatCount(counts[candidate])}
            </span>
          </button>
        ))}
      </div>
      </div>

      {between}

      {VIEWS.map((candidate) => (
        <div
          key={candidate}
          role="tabpanel"
          id={`${baseId}-${candidate}-panel`}
          aria-labelledby={`${baseId}-${candidate}`}
          hidden={view !== candidate}
          className="pt-6"
        >
          {panels[candidate]}
        </div>
      ))}
    </>
  );
}
