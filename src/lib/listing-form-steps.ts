/* L'ordre du tunnel de dépôt, écrit une fois : les numéros d'étape en
   découlent. Le message « choisissez d'abord un jeu, à l'étape 1 » citait un
   numéro écrit à la main, resté faux quand les photos sont passées en tête
   et que le jeu est descendu à l'étape 2. */
const LISTING_FORM_STEPS = ["photos", "item", "content", "editions", "sale", "description", "audience", "seller"] as const;

export type ListingFormStep = (typeof LISTING_FORM_STEPS)[number];

export function listingStepNumber(step: ListingFormStep): number {
  return LISTING_FORM_STEPS.indexOf(step) + 1;
}
