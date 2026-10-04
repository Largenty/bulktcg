import { FREE_PHOTOS, MAX_PHOTOS } from "@/lib/site";

/* Le partage des photos d'une annonce entre ce qui paraît et ce qui attend
   le paiement de l'option « 8 photos ».

   Le droit se lit en base — extra_photos, que le service de paiement écrit
   seul —, jamais dans le formulaire : la case cochée, comme le champ caché
   d'une annonce qui a déjà l'option, exprime une demande, pas un droit. Un
   formulaire se trafique, et l'option se serait alors offerte d'elle-même.

   Sans l'option payée, les trois premières photos paraissent et les
   suivantes attendent la confirmation du paiement. Sans demande, au-delà de
   trois, c'est un refus : le vendeur choisit lui-même lesquelles garder. La
   base tient la même règle en dernier recours (check_photo_allowance). */

export type PhotoAllocation = { published: string[]; awaitingPayment: string[] };

export function allocatePhotos(
  photos: string[],
  { hasPaidOption, wantsOption }: { hasPaidOption: boolean; wantsOption: boolean },
): PhotoAllocation | null {
  const allowance = hasPaidOption ? MAX_PHOTOS : FREE_PHOTOS;
  if (photos.length > MAX_PHOTOS) return null;
  if (photos.length > allowance && !wantsOption) return null;
  return { published: photos.slice(0, allowance), awaitingPayment: photos.slice(allowance) };
}
