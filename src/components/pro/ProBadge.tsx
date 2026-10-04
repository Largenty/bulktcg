/* La marque d'un compte professionnel au forfait actif : trois lettres,
   toujours au même endroit — après le pseudo, ou dans le choix d'audience.
   Le texte complet est pour le lecteur d'écran : « PRO » seul, lu à voix
   haute, ne dit pas de quoi il s'agit. */
export function ProBadge({ isInverse = false }: { isInverse?: boolean }) {
  return (
    <span
      className={`label inline-flex shrink-0 items-center rounded-[var(--radius-sm)] px-1.5 py-px font-bold ${
        isInverse ? "bg-[var(--chalk)] text-[var(--on-chalk)]" : "bg-[var(--ink)] text-[var(--on-ink)]"
      }`}
    >
      <span aria-hidden="true">Pro</span>
      <span className="sr-only">Professionnel</span>
    </span>
  );
}
