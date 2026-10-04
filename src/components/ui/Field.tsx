import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  isRequired?: boolean;
  /* Faux sur les filtres de recherche : « facultatif » ne veut rien dire à
     côté d'un tri, alors que c'est une information utile sur un dépôt. */
  hasOptionalHint?: boolean;
  /* Le libellé reste lié et lu par les lecteurs d'écran ; seul son rendu
     disparaît, là où le contrôle se nomme déjà visuellement — le tri posé
     dans la barre de résultats, par exemple. */
  isLabelHidden?: boolean;
  children: ReactNode;
};

/* Enveloppe commune à tous les champs : le <label> est réel et lié, jamais
   remplacé par un placeholder. Le message d'erreur remplace l'aide plutôt
   que de s'y ajouter — un seul texte sous le champ, celui qui compte. */
export function Field({
  id,
  label,
  hint,
  error,
  isRequired = false,
  hasOptionalHint = true,
  isLabelHidden = false,
  children,
}: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label
        htmlFor={id}
        className={isLabelHidden ? "sr-only" : "text-[length:var(--text-md)] font-semibold text-[var(--ink)]"}
      >
        {label}
        {isRequired ? (
          <span className="ml-1 text-[var(--danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
        {!isRequired && hasOptionalHint ? (
          <span className="ml-2 text-[length:var(--text-sm)] font-normal text-[var(--muted)]">facultatif</span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-start gap-1.5 text-[length:var(--text-sm)] font-semibold leading-snug text-[var(--danger)]"
        >
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
