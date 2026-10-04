"use client";

type StarRatingInputProps = {
  name: string;
  label: string;
  hint: string;
  value: number | null;
  error?: string;
  onChange: (value: number) => void;
};

const SCORES = [1, 2, 3, 4, 5] as const;

/* Cinq étoiles, et derrière elles cinq boutons radio natifs : ils portent
   l'état, les flèches du clavier et la soumission ; les étoiles n'en sont
   que le dessin. La note choisie s'écrit aussi en chiffres : une couleur
   seule ne la dirait pas. */
export function StarRatingInput({ name, label, hint, value, error, onChange }: StarRatingInputProps) {
  const describedBy = error ? `${name}-error` : `${name}-hint`;

  return (
    <fieldset className="flex flex-col gap-1.5" aria-describedby={describedBy}>
      <legend className="text-[length:var(--text-md)] font-semibold">{label}</legend>
      <p id={`${name}-hint`} className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
        {hint}
      </p>
      <div className="flex items-center gap-1">
        {SCORES.map((score) => (
          <label
            key={score}
            className="star has-[:focus-visible]:outline has-[:focus-visible]:outline-[length:var(--border-width-strong)] has-[:focus-visible]:outline-[var(--ink)]"
            data-on={value !== null && score <= value ? "" : undefined}
          >
            <input
              id={score === 1 ? name : undefined}
              type="radio"
              name={name}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              className="sr-only"
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">{score} sur 5</span>
          </label>
        ))}
        <span aria-hidden="true" className="mono ml-2 text-[length:var(--text-md)] text-[var(--ink-soft)]">
          {value === null ? "—" : `${value}/5`}
        </span>
      </div>
      {error ? (
        <p id={`${name}-error`} className="text-[length:var(--text-sm)] font-semibold text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
