"use client";

import { useId } from "react";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { SelectListbox } from "@/components/ui/SelectListbox";
import { useListbox } from "@/components/ui/useListbox";

export type SelectOption = { value: string; label: string };

type SelectProps = {
  id: string;
  label: string;
  name?: string;
  value: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  isRequired?: boolean;
  hasOptionalHint?: boolean;
  isLabelHidden?: boolean;
  /* « compact » dans une barre d'outils : même contrôle, hauteur réduite. */
  size?: "md" | "compact";
  placeholder?: string;
  onChange: (value: string) => void;
};

/* Listbox maison plutôt que <select> natif : le popup système ignore le CSS
   sur Linux et macOS. Motif combobox de l'APG, avec aria-activedescendant —
   le focus clavier ne quitte jamais le déclencheur ; l'état et le clavier
   vivent dans useListbox. L'<input> caché porte la valeur pour la soumission
   du formulaire. */
export function Select({
  id,
  label,
  name,
  value,
  options,
  hint,
  error,
  isRequired = false,
  hasOptionalHint = true,
  isLabelHidden = false,
  size = "md",
  placeholder = "Choisir",
  onChange,
}: SelectProps) {
  const listboxId = useId();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const { isOpen, activeIndex, setActiveIndex, rootRef, optionRefs, toggle, commit, handleKeyDown } = useListbox({
    options,
    selectedIndex,
    onCommit: (option) => onChange(option.value),
  });

  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      isRequired={isRequired}
      hasOptionalHint={hasOptionalHint}
      isLabelHidden={isLabelHidden}
    >
      <div ref={rootRef} className="relative">
        <input type="hidden" name={name ?? id} value={value} />
        <button
          type="button"
          id={id}
          role="combobox"
          /* La liste n'existe qu'ouverte : fermée, aria-controls désignait
             un élément absent (ARIA 1.2 ne l'exige que liste affichée). */
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={isOpen ? `${listboxId}-${activeIndex}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`field flex items-center justify-between gap-3 text-left ${
            size === "compact" ? "min-h-[42px] py-2 text-[length:var(--text-md)]" : ""
          }`}
          onClick={toggle}
          onKeyDown={handleKeyDown}
        >
          <span className={`truncate ${selectedOption ? "" : "text-[var(--muted)]"}`}>
            {selectedOption?.label ?? placeholder}
          </span>
          <Icon
            name="chevronDown"
            size={16}
            className={`shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen ? (
          <SelectListbox
            id={listboxId}
            label={label}
            options={options}
            value={value}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={commit}
            optionRefs={optionRefs}
          />
        ) : null}
      </div>
    </Field>
  );
}
