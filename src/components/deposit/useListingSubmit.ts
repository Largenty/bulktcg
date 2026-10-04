"use client";

import { submitListing } from "@/app/actions/listings";
import { useDepositSubmit, type Published } from "@/components/deposit/useDepositSubmit";
import type { ListingWriteResult } from "@/lib/data/listing-mutations";
import type { MutationResult } from "@/lib/data/mutation-result";
import type { DraftPhoto } from "@/lib/listing-draft";
import { uploadPendingPhotos } from "@/lib/photo-upload";
import {
  collectFieldErrors,
  listingFormSchema,
  listingFormSchemaWithoutPhotos,
  readListingFormData,
  type ListingFormErrors,
  type ListingFormValues,
} from "@/lib/schemas/listing-form";

export type PublishedListing = Published<ListingFormValues, ListingWriteResult>;

/* L'ordre visuel du formulaire, pour placer le focus sur le premier champ
   fautif. */
const FIELD_ORDER = [
  "photos",
  "title",
  "gameId",
  "lotType",
  "cardCount",
  "weightKg",
  "condition",
  "language",
  "editions",
  "tags",
  "priceEuros",
  "city",
  "postalCode",
  "description",
  "audience",
  "privateSeller",
];

/* Le sélecteur de photos a son propre identifiant ; le code postal n'a plus
   de champ à lui : il suit la commune choisie. */
const FOCUS = { order: FIELD_ORDER, targets: { photos: "photo-picker", postalCode: "city" } };

type SubmitOptions = {
  /* Faux tant que les photos ne s'enregistrent pas : le schéma est alors
     celui que le serveur applique aussi, sans photos (phase 3). */
  photoUploads: boolean;
  /* Ce que le serveur a répondu, pour retenir qu'un dépôt est enregistré. */
  onResult: (result: MutationResult<ListingWriteResult>) => void;
};

/* Validation dans le navigateur d'abord — réponse immédiate —, puis
   téléversement des photos, puis action serveur, qui revalide avec le même
   schéma et contrôle l'identité. */
export function useListingSubmit(photos: DraftPhoto[], { photoUploads, onResult }: SubmitOptions) {
  const { reject, send, ...state } = useDepositSubmit<ListingFormValues, ListingWriteResult, ListingFormErrors>(FOCUS);

  function withPhotos(form: HTMLFormElement, refs: string[]): FormData {
    const formData = new FormData(form);
    formData.delete("photos");
    for (const ref of refs) formData.append("photos", ref);
    return formData;
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const schema = photoUploads ? listingFormSchema : listingFormSchemaWithoutPhotos;
    const parsed = schema.safeParse(readListingFormData(withPhotos(form, photos.map((photo) => photo.ref))));
    if (!parsed.success) {
      reject(collectFieldErrors(parsed.error));
      return;
    }
    send(parsed.data, async () => {
      const uploaded = await uploadPendingPhotos(photos);
      const result = await submitListing(withPhotos(form, uploaded.map((photo) => photo.ref)));
      onResult(result);
      return result;
    });
  }

  return { ...state, handleSubmit };
}
