"use client";

import { useId, useState } from "react";
import { CitySuggestions } from "@/components/city/CitySuggestions";
import { useCitySuggestions, type CityAnswer } from "@/components/city/useCitySuggestions";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { City } from "@/lib/city-label";

type CityComboboxProps = {
  id: string;
  label: string;
  defaultValue?: string;
  /* La commune enregistrée, résolue par la page : trois s'appellent Valence. */
  defaultCity?: City | null;
  hint?: string;
  error?: string;
  /* Nom du champ qui porte le code postal, rempli par la commune choisie. */
  postalCodeName?: string;
  /* Prévient le formulaire à chaque frappe et à chaque choix : un choix dans
     la liste ne déclenche aucun événement de saisie, l'aperçu le raterait. */
  onValueChange?: (value: string) => void;
  /* La commune choisie, ou null dès qu'on retape : l'aperçu la situe. */
  onCityChange?: (city: City | null) => void;
  /* « address-level2 » pour la commune de la personne elle-même (WCAG
     1.3.5) ; « off » pour un rendez-vous, qui n'est pas forcément chez soi. */
  autoComplete?: "off" | "address-level2";
};

/* Une commune se choisit, elle ne se tape pas au hasard : c'est elle qui
   place l'annonce sur la carte. On tape « avi » ou « 840 », on choisit, et le
   code postal suit. Les suggestions viennent du serveur ; sans JavaScript, le
   champ part tel quel et le serveur retrouve la commune. Motif combobox de
   l'APG : le focus reste dans le champ, flèches, Entrée, Échap. */
export function CityCombobox({
  id,
  label,
  defaultValue,
  defaultCity = null,
  hint,
  error,
  postalCodeName = "postalCode",
  onValueChange,
  onCityChange,
  autoComplete = "off",
}: CityComboboxProps) {
  const listboxId = useId();
  const [query, setQuery] = useState(defaultValue ?? defaultCity?.name ?? "");
  const [picked, setPicked] = useState<City | null>(defaultCity);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  function pick(city: City) {
    setPicked(city);
    setQuery(city.name);
    setIsOpen(false);
    onValueChange?.(city.name);
    onCityChange?.(city);
  }

  /* Une réponse qui désigne une seule commune la choisit si le champ est
     déjà quitté : « 84000 » devient Avignon. Un homonyme, lui, attend qu'on
     choisisse. */
  function settleOnAnswer(answer: CityAnswer) {
    if (!isOpen && picked === null && answer.match && answer.query === query.trim()) pick(answer.match);
  }

  const answer = useCitySuggestions(query, picked === null, settleOnAnswer);
  const suggestions = isOpen && picked === null ? answer.suggestions : [];
  const match = answer.query === query.trim() ? answer.match : null;

  function chooseAt(index: number) {
    const chosen = suggestions[index];
    if (chosen) pick(chosen);
  }

  function settle() {
    setIsOpen(false);
    if (picked === null && match) pick(match);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseAt(activeIndex);
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <Field id={id} label={label} hint={picked ? undefined : hint} error={error} isRequired>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="text"
          role="combobox"
          autoComplete={autoComplete}
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          /* La liste n'existe qu'ouverte : désigner un identifiant absent est
             une erreur de validité HTML. */
          aria-controls={suggestions.length > 0 ? listboxId : undefined}
          aria-activedescendant={suggestions.length > 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : picked ? `${id}-found` : hint ? `${id}-hint` : undefined}
          value={query}
          placeholder="Commune ou code postal"
          onChange={(event) => {
            setQuery(event.target.value);
            onValueChange?.(event.target.value);
            if (picked !== null) onCityChange?.(null);
            setPicked(null);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={settle}
          onKeyDown={handleKeyDown}
          className="field"
        />
        <input type="hidden" id={postalCodeName} name={postalCodeName} value={picked?.postalCode ?? ""} />
        {suggestions.length > 0 ? (
          <CitySuggestions
            id={listboxId}
            label={label}
            suggestions={suggestions}
            activeIndex={activeIndex}
            onChoose={chooseAt}
            onActiveIndexChange={setActiveIndex}
          />
        ) : null}
      </div>
      {picked ? (
        <p id={`${id}-found`} className="flex items-center gap-1.5 text-[length:var(--text-sm)] text-[var(--success)]">
          <Icon name="check" size={16} strokeWidth={2.6} />
          {picked.name} ({picked.postalCode}) · {picked.departmentName}
        </p>
      ) : null}
    </Field>
  );
}
