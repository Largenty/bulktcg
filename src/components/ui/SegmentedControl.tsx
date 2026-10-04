"use client";

export type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  /* Nomme ce qui change, pas le contrôle : « Statut de l'annonce Vrac 400
     cartes » est utile au lecteur d'écran, « Groupe de boutons » ne l'est pas. */
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  isDisabled?: boolean;
};

/* Un choix parmi trois, tous visibles en permanence : on voit d'un coup d'œil
   où en est l'annonce, et le changement coûte un clic. Une liste déroulante
   cacherait l'état derrière une ouverture.
   Boutons à aria-pressed plutôt qu'un groupe de radios : rien n'est soumis,
   chaque bouton déclenche une action immédiate. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  isDisabled = false,
}: SegmentedControlProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <div
      role="group"
      aria-label={label}
      /* Les segments passent à la ligne plutôt que de sortir de l'écran :
         « En recherche / Trouvé / Abandonnée » débordait de 33 px à 320 px
         (WCAG 1.4.10). */
      className="inline-flex max-w-full flex-wrap rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--tint)] p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={isDisabled}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
          className={[
            "min-h-[36px] whitespace-nowrap rounded-[var(--radius-sm)] px-3.5 text-[length:var(--text-sm)] font-semibold transition-colors duration-100 disabled:cursor-wait",
            /* Le choix courant cerné d'encre, pas rempli : l'aplat est
               réservé aux gestes (styles/base/controls.css, « pastilles »). */
            value === option.value
              ? "bg-[var(--card)] text-[var(--ink)] shadow-[inset_0_0_0_var(--border-width-strong)_var(--ink)]"
              : "text-[var(--ink-soft)] hover:bg-[var(--card)]",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
      {/* aria-pressed qui change n'est pas toujours annoncé : l'état courant
          est dit en toutes lettres, sans rien afficher. */}
      <output className="sr-only" aria-live="polite">
        {label} : {selected?.label ?? ""}
      </output>
    </div>
  );
}
