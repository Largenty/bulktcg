import type { ReactNode } from "react";

type FormSectionProps = {
  /* Numéroté dans un tunnel de dépôt, où l'ordre des étapes compte ; absent
     sur un écran de réglages, où les blocs sont indépendants et où un « 1 »
     promettrait une suite. */
  step?: number;
  title: string;
  description?: string;
  children: ReactNode;
};

export function FormSection({ step, title, description, children }: FormSectionProps) {
  return (
    <fieldset className="panel form-section">
      <legend className="form-legend flex items-center gap-3">
        {step !== undefined ? (
          <span className="price grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ink)] text-[length:var(--text-lg)] text-[var(--on-ink)]">
            {step}
          </span>
        ) : null}
        <span className="display display-h3">{title}</span>
      </legend>
      {description ? (
        <p className="mb-6 mt-2.5 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          {description}
        </p>
      ) : (
        <div className="h-5" />
      )}
      <div className="flex flex-col gap-6">{children}</div>
    </fieldset>
  );
}
