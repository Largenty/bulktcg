import Link from "next/link";
import { formatCount } from "@/lib/format";

export type FilterTab = { href: string; label: string; count: number; isCurrent: boolean };

/* Les filtres d'une liste, dessinés comme les intercalaires des jeux : au-
   dessus, les onglets du compte sont des pastilles, et filtrer ne doit pas
   ressembler à naviguer. Des liens — ils marchent sans JavaScript, et le
   retour arrière défait le dernier filtre. */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="mb-8">
      <ul className="dividers scroll-row -mx-[var(--container-pad)] list-none px-[var(--container-pad)] sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <li key={tab.href} className="flex">
            <Link href={tab.href} aria-current={tab.isCurrent ? "page" : undefined} className="divider">
              {tab.label}
              <span className="divider-count">{formatCount(tab.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
