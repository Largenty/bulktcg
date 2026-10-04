"use client";

import type { City } from "@/lib/city-label";

type CitySuggestionsProps = {
  id: string;
  label: string;
  suggestions: City[];
  activeIndex: number;
  onChoose: (index: number) => void;
  onActiveIndexChange: (index: number) => void;
};

/* Les communes proposées sous le champ de CityCombobox. Le focus reste dans
   le champ, comme le veut le motif combobox de l'APG : la liste ne le prend
   jamais. Un choix se fait au pointerdown, avant que le champ perde le focus
   et referme la liste — un click arriverait trop tard. */
export function CitySuggestions({ id, label, suggestions, activeIndex, onChoose, onActiveIndexChange }: CitySuggestionsProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      className="absolute z-[var(--layer-popover)] mt-1.5 w-full overflow-hidden rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)]"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={`${suggestion.communeCode}-${suggestion.postalCode}`}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          onPointerDown={(event) => {
            event.preventDefault();
            onChoose(index);
          }}
          onPointerEnter={() => onActiveIndexChange(index)}
          className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 ${
            index === activeIndex ? "bg-[var(--ink)] text-[var(--on-ink)]" : ""
          }`}
        >
          <span className="font-medium">{suggestion.name}</span>
          <span className="mono text-[length:var(--text-xs)] opacity-80">
            {suggestion.postalCode} · {suggestion.departmentName}
          </span>
        </li>
      ))}
    </ul>
  );
}
