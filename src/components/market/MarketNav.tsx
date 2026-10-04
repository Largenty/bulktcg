import Link from "next/link";
import { MARKET_TAB, MARKET_TAB_COUNT, MARKET_TAB_CURRENT, MARKET_TAB_ROW } from "@/components/market/market-tab-style";
import { formatCount } from "@/lib/format";

type MarketNavItem = { href: string; label: string; count: number; isCurrent?: boolean };

/* La bascule « Ventes / Recherches » quand ses deux côtés sont deux pages :
   des liens, marqués aria-current, dessinés comme les onglets de MarketTabs. */
export function MarketNav({ label, items }: { label: string; items: MarketNavItem[] }) {
  return (
    <nav aria-label={label}>
      <ul className={`list-none ${MARKET_TAB_ROW}`}>
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.isCurrent ? "page" : undefined}
              className={`${MARKET_TAB} ${MARKET_TAB_CURRENT}`}
            >
              {item.label}
              <span className={MARKET_TAB_COUNT}>{formatCount(item.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
