/* Un seul bandeau global en tête du formulaire, pas un rappel d'erreur à
   trois endroits : il compte, et chaque champ dit ce qui ne va pas. */
export function FormErrorBanner({ count }: { count: number }) {
  return (
    <output aria-live="assertive" className="block empty:hidden">
      {count > 0 ? (
        <p className="notice notice-danger text-[length:var(--text-md)] font-semibold text-[var(--danger)]">
          {count === 1
            ? "Un champ demande une correction, détaillée ci-dessous."
            : `${count} champs demandent une correction, détaillées ci-dessous.`}
        </p>
      ) : null}
    </output>
  );
}
