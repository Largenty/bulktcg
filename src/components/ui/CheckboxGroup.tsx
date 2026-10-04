import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";

export type CheckboxOption = {
  value: string;
  label: ReactNode;
  hint?: string;
  /* Écartée par une recherche : masquée par l'attribut hidden, jamais
     démontée, pour que sa case reste dans le formulaire. */
  hidden?: boolean;
};

export type CheckboxSection = {
  /* Absent quand il n'y a rien à regrouper : un intertitre unique au-dessus
     d'une liste unique n'apprend rien. */
  title?: string;
  options: CheckboxOption[];
};

type CheckboxGroupProps = {
  /* Nom du champ HTML, partagé par toutes les cases : c'est ce qui les fait
     arriver comme une liste dans le FormData, lue avec getAll. */
  name: string;
  legend: string;
  description?: string;
  sections: CheckboxSection[];
  /* Cases cochées au montage. Le groupe reste non contrôlé — sa vérité vit
     dans le DOM, comme les champs texte du même formulaire. */
  defaultSelected?: string[];
  error?: string;
  /* Au-delà d'une quinzaine d'entrées la liste prend toute la page : on la
     borne en hauteur plutôt que de reléguer la validation deux écrans plus
     bas. */
  isScrollable?: boolean;
  /* Ce qu'on écrit quand il n'y a rien à cocher. Jamais une boîte vide. */
  emptyLabel: string;
  /* Posé en tête du cadre, au-dessus de la liste qui défile : une recherche
     dans les cases. */
  toolbar?: ReactNode;
};

export function CheckboxGroup({
  name,
  legend,
  description,
  sections,
  defaultSelected = [],
  error,
  isScrollable = false,
  emptyLabel,
  toolbar,
}: CheckboxGroupProps) {
  const selected = new Set(defaultSelected);
  const optionCount = sections.reduce((sum, section) => sum + section.options.length, 0);
  /* Une section dont toutes les cases sont écartées disparaît, et la
     première qui reste ne porte pas de filet au-dessus d'elle. */
  const isShown = (section: CheckboxSection) => section.options.some((option) => !option.hidden);
  const firstShown = sections.findIndex(isShown);

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2.5"
      aria-describedby={error ? `${name}-error` : description ? `${name}-hint` : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-2 text-[length:var(--text-md)] font-semibold">
        {legend}
        <span className="ml-2 text-[length:var(--text-sm)] font-normal text-[var(--muted)]">facultatif</span>
      </legend>

      {description ? (
        <p id={`${name}-hint`} className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
          {description}
        </p>
      ) : null}

      {optionCount === 0 ? (
        <p className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] p-4 text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
          {emptyLabel}
        </p>
      ) : (
        <div className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)]">
          {toolbar ? <div className="border-b-[length:var(--border-width)] border-[var(--line)] px-4 py-3">{toolbar}</div> : null}
          <div className={isScrollable ? "max-h-[320px] overflow-y-auto px-4 py-3" : "px-4 py-3"}>
          {sections.map((section, index) => (
            <div
              key={section.title ?? index}
              hidden={!isShown(section)}
              className={index > firstShown ? "mt-4 border-t-[length:var(--border-width)] border-[var(--line)] pt-4" : ""}
            >
              {section.title ? (
                <p className="label mb-2 text-[var(--muted)]">{section.title}</p>
              ) : null}
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {section.options.map((option) => (
                  <div key={option.value} hidden={option.hidden}>
                    <Checkbox
                      id={`${name}-${option.value}`}
                      name={name}
                      value={option.value}
                      size="sm"
                      label={option.label}
                      description={option.hint}
                      defaultChecked={selected.has(option.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {error ? (
        <p
          id={`${name}-error`}
          className="flex items-start gap-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--danger)]"
        >
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
