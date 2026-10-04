"use client";

import { EditionTagFields } from "@/components/deposit/EditionTagFields";
import { FormSection } from "@/components/deposit/FormSection";
import { TradeFields } from "@/components/deposit/TradeFields";
import type { GameEditions } from "@/components/deposit/useGameEditions";
import { CityCombobox } from "@/components/city/CityCombobox";
import type { City } from "@/lib/city-label";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CONDITION_LABELS, GAME_OPTIONS, LANGUAGE_LABELS, LOT_TYPE_LABELS, toLabelOptions } from "@/lib/labels";
import type { ListingFormDefaults } from "@/lib/form-defaults";
import { listingStepNumber } from "@/lib/listing-form-steps";
import type { ListingDraft } from "@/lib/listing-draft";
import type { ListingFormErrors } from "@/lib/schemas/listing-form";

const LOT_TYPE_OPTIONS = toLabelOptions(LOT_TYPE_LABELS);
const LANGUAGE_OPTIONS = toLabelOptions(LANGUAGE_LABELS);
const CONDITION_OPTIONS: SelectOption[] = toLabelOptions(CONDITION_LABELS).map(({ value, label }) => ({
  value,
  label: value === "sealed" || value === "mixed" ? label : `${value} — ${label}`,
}));

type Choice = "gameId" | "lotType" | "condition" | "language";

type ListingFormFieldsProps = {
  errors: ListingFormErrors;
  /* Les listes déroulantes lisent le brouillon du formulaire : une seule
     source pour les champs, l'aperçu et la soumission. */
  choices: Pick<ListingDraft, Choice>;
  /* Vide au dépôt, rempli à la modification. Les champs texte restent non
     contrôlés : leur valeur vit dans le DOM. */
  defaults?: ListingFormDefaults;
  editions: GameEditions;
  onChoiceChange: (field: Choice, value: string) => void;
  onCityChange: (city: string) => void;
  /* La commune choisie dans la liste, ou null quand on retape. */
  onPlaceChange: (place: City | null) => void;
};

export function ListingFormFields({ errors, choices, defaults, editions, onChoiceChange, onCityChange, onPlaceChange }: ListingFormFieldsProps) {
  return (
    <>
      <FormSection step={listingStepNumber("item")} title="Ce que vous vendez" description="Un titre qui dit le volume et le jeu se lit mieux dans un fil Facebook qu'un titre vague.">
        <Input
          id="title"
          defaultValue={defaults?.title}
          label="Titre de l'annonce"
          isRequired
          error={errors.title}
          maxLength={90}
          placeholder="Vrac 400 cartes Pokémon séries récentes"
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Select id="gameId" label="Jeu" isRequired value={choices.gameId} options={GAME_OPTIONS} error={errors.gameId} onChange={(value) => onChoiceChange("gameId", value)} />
          <Select id="lotType" label="Format du lot" isRequired value={choices.lotType} options={LOT_TYPE_OPTIONS} error={errors.lotType} onChange={(value) => onChoiceChange("lotType", value)} />
        </div>
      </FormSection>

      <FormSection step={listingStepNumber("content")} title="Le contenu" description="Laissez vide ce que vous n'avez pas mesuré. Un champ vide est honnête, un chiffre approximatif ne l'est pas.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Input id="cardCount" defaultValue={defaults?.cardCount} label="Nombre de cartes" type="number" min={1} inputMode="numeric" error={errors.cardCount} hint="Si vous n'avez pas compté, laissez vide." />
          <Input id="weightKg" defaultValue={defaults?.weightKg} label="Poids" type="text" inputMode="decimal" suffix="kg" error={errors.weightKg} hint="Une balance de cuisine suffit." />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Select id="condition" label="État des cartes" isRequired value={choices.condition} options={CONDITION_OPTIONS} error={errors.condition} onChange={(value) => onChoiceChange("condition", value)} />
          <Select id="language" label="Langue" isRequired value={choices.language} options={LANGUAGE_OPTIONS} error={errors.language} onChange={(value) => onChoiceChange("language", value)} />
        </div>
      </FormSection>

      <FormSection step={listingStepNumber("editions")} title="Séries et produits" description="Ce qui rend un lot trouvable : un acheteur cherche « display EV08 » ou « Modern Horizons 3 », pas « lot de cartes ».">
        <EditionTagFields gameId={choices.gameId} editionBlocks={editions.blocks} editionsFailed={editions.failed} errors={errors} defaultEditions={defaults?.editions} defaultTags={defaults?.tags} />
      </FormSection>

      <FormSection step={listingStepNumber("sale")} title="Prix, échange et rendez-vous" description="La commune place l'annonce sur la carte des acheteurs. L'adresse exacte se convient dans la conversation.">
        <div className="grid gap-6 sm:grid-cols-[1fr_1.4fr]">
          <Input id="priceEuros" defaultValue={defaults?.priceEuros} label="Prix" type="text" inputMode="decimal" suffix="€" isRequired error={errors.priceEuros} />
          <CityCombobox
            id="city"
            label="Commune du rendez-vous"
            defaultValue={defaults?.city}
            defaultCity={defaults?.place}
            error={errors.city ?? errors.postalCode}
            hint="Tapez le nom ou le code postal, puis choisissez dans la liste."
            onValueChange={onCityChange}
            onCityChange={onPlaceChange}
          />
        </div>
        <TradeFields defaultOpen={defaults?.openToTrade} defaultNote={defaults?.tradeNote} error={errors.tradeNote} />
      </FormSection>

      <FormSection step={listingStepNumber("description")} title="Description" description="Dites l'état réel, y compris ce qui est abîmé : c'est ce qui évite un rendez-vous pour rien.">
        <Textarea
          id="description"
          defaultValue={defaults?.description}
          label="Description"
          isRequired
          error={errors.description}
          placeholder="Contenu du lot, état réel, ce qui est abîmé, contraintes de rendez-vous…"
        />
      </FormSection>
    </>
  );
}
