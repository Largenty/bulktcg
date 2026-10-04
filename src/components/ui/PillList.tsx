import Link from "next/link";
import type { ReactNode } from "react";
import { formatCount } from "@/lib/format";

export type PillItem = {
  href: string;
  label: string;
  /* Absent quand il n'y a rien à dénombrer. Zéro, lui, est une vraie valeur :
     « 0 annonce » est une information. */
  count?: number;
  /* Pastille de couleur posée avant le libellé. */
  leading?: ReactNode;
  isCurrent?: boolean;
};

type PillListProps = {
  items: PillItem[];
  /* Renseigné quand la liste est une navigation. Sans lui, c'est une simple
     liste de liens et l'envelopper d'un <nav> mentirait au lecteur d'écran. */
  navLabel?: string;
  /* Sur mobile, une rangée qui défile plutôt que trois lignes qui poussent
     le contenu vers le bas. */
  isScrollable?: boolean;
  className?: string;
};

/* Liste de liens en pastilles : onglets du compte, villes d'un jeu, jeux de
   l'accueil. aria-current et non aria-pressed : ce sont des liens, pas des
   boutons de filtre. */
export function PillList({ items, navLabel, isScrollable = false, className }: PillListProps) {
  const list = (
    <ul
      className={[
        "list-none",
        isScrollable ? "scroll-row -mx-[var(--container-pad)] px-[var(--container-pad)] sm:mx-0 sm:flex-wrap sm:px-0" : "flex flex-wrap gap-2.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => (
        <li key={item.href + item.label}>
          <Link
            href={item.href}
            aria-current={item.isCurrent ? "page" : undefined}
            className="pill"
          >
            {item.leading}
            {item.label}
            {item.count !== undefined ? (
              <span className="mono text-[length:var(--text-xs)] opacity-70">{formatCount(item.count)}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );

  return navLabel ? <nav aria-label={navLabel}>{list}</nav> : list;
}
