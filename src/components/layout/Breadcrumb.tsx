import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type Crumb = { href?: string; label: string };

/* Le fil d'Ariane : d'où vient la page, et un chemin de retour qui ne
   dépend pas du bouton du navigateur. Le dernier maillon, la page courante,
   n'est pas un lien. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-5 lg:mb-7">
      <ol className="flex list-none flex-wrap items-center gap-1.5 text-[length:var(--text-sm)] text-[var(--muted)]">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {index > 0 ? <Icon name="chevronRight" size={14} /> : null}
            {item.href ? (
              <Link href={item.href} className="underline-offset-4 hover:text-[var(--ink)] hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-[var(--ink-soft)]">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
