"use client";

import type { SelectOption } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";

type SelectListboxProps = {
  id: string;
  label: string;
  options: SelectOption[];
  value: string;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (index: number) => void;
  optionRefs: React.RefObject<Array<HTMLLIElement | null>>;
};

/* La liste déployée, séparée de son déclencheur : le clavier est géré
   entièrement par le déclencheur via aria-activedescendant. */
export function SelectListbox({
  id,
  label,
  options,
  value,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  optionRefs,
}: SelectListboxProps) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label={label}
      className="absolute z-[var(--layer-popover)] mt-1.5 max-h-72 w-full min-w-[220px] overflow-y-auto rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] p-1.5 shadow-[var(--shadow-md)]"
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isActive = index === activeIndex;
        return (
          <li
            key={option.value}
            id={`${id}-${index}`}
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            role="option"
            aria-selected={isSelected}
            onPointerDown={(event) => {
              event.preventDefault();
              onSelect(index);
            }}
            onPointerEnter={() => onActiveIndexChange(index)}
            className={[
              "flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-[length:var(--text-md)]",
              isActive ? "bg-[var(--ink)] text-[var(--on-ink)]" : "",
              isSelected && !isActive ? "font-semibold" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span>{option.label}</span>
            {isSelected ? <Icon name="check" size={16} className="shrink-0" /> : null}
          </li>
        );
      })}
    </ul>
  );
}
