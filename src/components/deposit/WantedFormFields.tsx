"use client";

import { FormSection } from "@/components/deposit/FormSection";
import { CityCombobox } from "@/components/city/CityCombobox";
import type { City } from "@/lib/city-label";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { GAME_OPTIONS, LOT_TYPE_LABELS, toLabelOptions } from "@/lib/labels";
import { RADIUS_OPTIONS_KM } from "@/lib/listing-query";
import type { WantedFormDefaults } from "@/lib/form-defaults";
import type { WantedFormErrors } from "@/lib/schemas/wanted-form";

const LOT_TYPE_OPTIONS: SelectOption[] = [{ value: "", label: "Peu importe le format" }, ...toLabelOptions(LOT_TYPE_LABELS)];

const DISTANCE_OPTIONS: SelectOption[] = RADIUS_OPTIONS_KM.map((km) => ({
  value: String(km),
  label: `Jusqu'à ${km} km`,
}));

export type WantedChoices = { gameId: string; lotType: string; maxDistanceKm: string };

type WantedFormFieldsProps = {
  errors: WantedFormErrors;
  choices: WantedChoices;
  /* Vide au dépôt, rempli à la modification ; champs texte non contrôlés. */
  defaults?: WantedFormDefaults;
  onChoiceChange: (field: keyof WantedChoices, value: string) => void;
  /* Un choix dans la liste remplit le champ sans événement de saisie :
     l'aperçu apprend le nom et la commune choisie par ici. */
  onCityChange?: (city: string) => void;
  onPlaceChange?: (place: City | null) => void;
};

export function WantedFormFields({
  errors,
  choices,
  defaults,
  onChoiceChange,
  onCityChange,
  onPlaceChange,
}: WantedFormFieldsProps) {
  return (
    <>
      <FormSection
        step={1}
        title="Ce que vous cherchez"
        description="Un titre précis reçoit des propositions précises. « Cherche vrac Pokémon 300 cartes » vaut mieux que « cherche cartes »."
      >
        <Input
          id="title"
          defaultValue={defaults?.title}
          label="Titre de la demande"
          isRequired
          error={errors.title}
          maxLength={90}
          placeholder="Cherche vrac Pokémon, 300 cartes minimum"
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Select
            id="gameId"
            label="Jeu"
            isRequired
            value={choices.gameId}
            options={GAME_OPTIONS}
            error={errors.gameId}
            onChange={(value) => onChoiceChange("gameId", value)}
          />
          <Select
            id="lotType"
            label="Format souhaité"
            hasOptionalHint={false}
            value={choices.lotType}
            options={LOT_TYPE_OPTIONS}
            error={errors.lotType}
            onChange={(value) => onChoiceChange("lotType", value)}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Input
            id="maxPriceEuros"
            defaultValue={defaults?.maxPriceEuros}
            label="Budget maximum"
            type="text"
            inputMode="decimal"
            suffix="€"
            error={errors.maxPriceEuros}
            hint="Laissez vide si vous préférez qu'on vous propose."
          />
          <Input
            id="minCardCount"
            defaultValue={defaults?.minCardCount}
            label="Volume minimum"
            type="number"
            min={1}
            inputMode="numeric"
            error={errors.minCardCount}
            hint="En nombre de cartes, si vous avez une exigence."
          />
        </div>
      </FormSection>

      <FormSection
        step={2}
        title="Jusqu'où vous vous déplacez"
        description="C'est ce qui permet de vous signaler un lot dès qu'il est déposé dans votre rayon."
      >
        <CityCombobox
          id="city"
          label="Commune de départ"
          defaultValue={defaults?.city}
          defaultCity={defaults?.place}
          error={errors.city ?? errors.postalCode}
          hint="Tapez le nom ou le code postal, puis choisissez dans la liste."
          onValueChange={onCityChange}
          onCityChange={onPlaceChange}
        />
        <Select
          id="maxDistanceKm"
          label="Distance acceptée"
          isRequired
          value={choices.maxDistanceKm}
          options={DISTANCE_OPTIONS}
          error={errors.maxDistanceKm}
          onChange={(value) => onChoiceChange("maxDistanceKm", value)}
        />
      </FormSection>

      <FormSection step={3} title="Détails">
        <Textarea
          id="description"
          defaultValue={defaults?.description}
          label="Description"
          isRequired
          rows={6}
          error={errors.description}
          placeholder="Séries recherchées, état accepté, disponibilités pour le rendez-vous…"
        />
      </FormSection>
    </>
  );
}
