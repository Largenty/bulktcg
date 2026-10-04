export type Stat = {
  label: string;
  /* Déjà formatée par lib/format : un composant n'invente pas un affichage
     de montant, et « — » doit pouvoir passer là où un nombre passerait. */
  value: string;
  hint?: string;
};

type StatListProps = {
  stats: Stat[];
  /* Sur l'ardoise du héros, les chiffres passent à la craie. */
  isInverse?: boolean;
};

/* Des chiffres en colonnes, en monospace tabulaire : ils s'alignent et se
   comparent d'un coup d'œil. */
export function StatList({ stats, isInverse = false }: StatListProps) {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-[96px]">
          <dt className={`label ${isInverse ? "text-[var(--chalk-muted)]" : "text-[var(--muted)]"}`}>{stat.label}</dt>
          <dd className="price mt-1.5 text-[length:var(--number-xl)] font-bold leading-none">{stat.value}</dd>
          {/* Un second dd et non un <p> : dans une liste de définitions, un
              groupe ne contient que ses termes et leurs descriptions. */}
          {stat.hint ? (
            <dd className={`mt-2 text-[length:var(--text-sm)] leading-snug ${isInverse ? "text-[var(--chalk-soft)]" : "text-[var(--muted)]"}`}>
              {stat.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
