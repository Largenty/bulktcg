import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type CrossingPanelProps = {
  eyebrow: string;
  title: ReactNode;
  /* Ce que le croisement ne peut pas garantir, dit en clair. */
  note?: ReactNode;
  items: ReactNode[];
  footer?: ReactNode;
};

/* L'encadré du croisement, dans les deux sens : qui cherche ce lot, et quels
   lots répondent à cette demande. C'est la meilleure nouvelle qu'un dépôt
   puisse apporter, et elle est donnée en bloc inversé — l'emphase du site
   passe par l'ardoise, pas par une couleur de plus. */
export function CrossingPanel({ eyebrow, title, note, items, footer }: CrossingPanelProps) {
  if (items.length === 0) return null;

  return (
    <section className="on-slate rounded-[var(--radius-lg)] p-5 sm:p-6">
      <p className="label flex items-center gap-2 text-[var(--chalk-muted)]">
        <Icon name="sparkle" size={16} />
        {eyebrow}
      </p>
      <h2 className="display display-h3 mt-2">{title}</h2>
      {note ? <p className="mt-2 text-[length:var(--text-md)] text-[var(--chalk-soft)]">{note}</p> : null}

      <ul className="mt-5 flex list-none flex-col gap-2.5">
        {items.map((item, index) => (
          <li key={index} className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--slate-line)] bg-[var(--slate-raised)] p-4">
            {item}
          </li>
        ))}
      </ul>

      {footer}
    </section>
  );
}
