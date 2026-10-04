import type { SelectOption } from "@/components/ui/Select";
import type { Choice } from "@/components/filters/ChoiceChips";
import type { Edition } from "@/types/edition";
import type { ProductTag } from "@/types/listing";
import {
  CONDITION_LABELS,
  CONDITION_SHORT_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_SHORT_LABELS,
  LOT_TYPE_LABELS,
  SORT_LABELS,
  TAG_LABELS,
  toLabelOptions,
} from "@/lib/labels";
import { RADIUS_OPTIONS_KM } from "@/lib/listing-query";
import { WANTED_BUDGET_STEPS_EUROS } from "@/lib/wanted-query";

/* Tables d'options du panneau de filtres. Ce sont des données, pas du rendu :
   elles se construisent une fois au chargement du module. */

export const ANY_VALUE = "";

export const LOT_TYPE_CHOICES: Choice[] = toLabelOptions(LOT_TYPE_LABELS);

/* Les codes d'état sont le vocabulaire courant des vendeurs : on les affiche
   tels quels, et la forme longue passe en info-bulle. */
export const CONDITION_CHOICES: Choice[] = toLabelOptions(CONDITION_SHORT_LABELS).map((choice) => ({
  ...choice,
  hint: CONDITION_LABELS[choice.value],
}));

export const LANGUAGE_CHOICES: Choice[] = toLabelOptions(LANGUAGE_SHORT_LABELS).map((choice) => ({
  ...choice,
  hint: LANGUAGE_LABELS[choice.value],
}));

export const SORT_OPTIONS: SelectOption[] = toLabelOptions(SORT_LABELS);

export const RADIUS_OPTIONS: SelectOption[] = RADIUS_OPTIONS_KM.map((km) => ({
  value: String(km),
  label: `Moins de ${km} km`,
}));

/* Séries et produits ne sont pas des tables figées : leurs options sont
   comptées sur les annonces réellement en ligne, page par page. Le libellé
   porte le nombre de résultats, sans quoi on proposerait des critères qui ne
   ramènent rien. */
export function toEditionOptions(facets: Array<{ edition: Edition; count: number }>): SelectOption[] {
  return [
    { value: ANY_VALUE, label: "Toutes les séries" },
    ...facets.map(({ edition, count }) => ({
      value: edition.id,
      label: `${edition.code} — ${edition.name} (${count})`,
    })),
  ];
}

export function toTagOptions(facets: Array<{ tag: ProductTag; count: number }>): SelectOption[] {
  return [
    { value: ANY_VALUE, label: "Tous les produits" },
    ...facets.map(({ tag, count }) => ({ value: tag, label: `${TAG_LABELS[tag]} (${count})` })),
  ];
}

/* --- Côté recherches --- */

export const WANTED_BUDGET_CHOICES: Choice[] = WANTED_BUDGET_STEPS_EUROS.map((euros) => ({
  value: String(euros),
  label: `${euros} €`,
}));

export const WANTED_BUYER_CHOICES: Choice[] = [
  { value: "particulier", label: "Particuliers" },
  { value: "pro", label: "Boutiques pro" },
];

export const WANTED_SORT_OPTIONS: SelectOption[] = [
  { value: "distance", label: "Les plus proches" },
  { value: "recent", label: "Plus récentes" },
  { value: "budget-desc", label: "Budget le plus haut" },
];
