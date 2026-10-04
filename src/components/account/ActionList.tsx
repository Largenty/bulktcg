import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export type AccountAction = {
  /* Le nombre est le sujet de la phrase : c'est lui qui décide si la ligne
     mérite d'exister. Une ligne à zéro n'est pas affichée — un tableau de
     bord qui liste ce qu'il n'y a pas à faire n'est plus lu. */
  count: number;
  sentence: string;
  href: string;
  linkLabel: string;
};

type ActionListProps = {
  actions: AccountAction[];
  /* Ce qu'on écrit quand tout est à zéro. Jamais une liste vide muette. */
  emptyLabel: string;
};

export function ActionList({ actions, emptyLabel }: ActionListProps) {
  const pending = actions.filter((action) => action.count > 0);

  if (pending.length === 0) {
    return (
      <p className="notice notice-success flex items-center gap-3 text-[length:var(--text-lg)] leading-relaxed">
        <Icon name="check" size={22} className="shrink-0 text-[var(--success)]" />
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="grid list-none gap-3 lg:grid-cols-3">
      {pending.map((action) => (
        <li key={action.href + action.sentence}>
          <Link
            href={action.href}
            className="group flex h-full flex-col gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-5 transition-colors hover:border-[var(--ink)]"
          >
            <span className="price text-[length:var(--number-2xl)] font-bold leading-none">{action.count}</span>
            <span className="flex-1 text-[length:var(--text-lg)] leading-snug">{action.sentence}</span>
            <span className="inline-flex items-center gap-1.5 text-[length:var(--text-md)] font-semibold">
              <span className="text-link">{action.linkLabel}</span>
              <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
