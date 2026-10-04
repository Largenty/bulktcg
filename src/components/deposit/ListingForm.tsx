"use client";

import { useRef, useState } from "react";
import type { SellerSummary } from "@/types/profile";
import type { WantedListing } from "@/types/wanted";
import { AudienceField } from "@/components/deposit/AudienceField";
import { FormErrorBanner } from "@/components/deposit/FormErrorBanner";
import { FormSection } from "@/components/deposit/FormSection";
import { ListingFormFields } from "@/components/deposit/ListingFormFields";
import { ListingOptions } from "@/components/deposit/ListingOptions";
import { ListingPreview } from "@/components/deposit/ListingPreview";
import { ListingSummary } from "@/components/deposit/ListingSummary";
import { PhotoSection } from "@/components/deposit/PhotoSection";
import { ListingPublishBar } from "@/components/deposit/PublishBar";
import { SellerStatusSection } from "@/components/deposit/SellerStatusSection";
import { useDraftIdentity } from "@/components/deposit/useDraftIdentity";
import { useGameEditions } from "@/components/deposit/useGameEditions";
import { useListingSubmit } from "@/components/deposit/useListingSubmit";
import { StickyColumn } from "@/components/layout/StickyColumn";
import type { City } from "@/lib/city-label";
import type { EditionCatalog } from "@/lib/edition-catalog";
import type { ListingFormDefaults } from "@/lib/form-defaults";
import { checksForGame, initialDraft, readDraft, type DraftPhoto, type ListingDraft } from "@/lib/listing-draft";
import { listingStepNumber } from "@/lib/listing-form-steps";

const FORM_ID = "listing-form";

type ListingFormProps = {
  openWantedListings: WantedListing[];
  seller: SellerSummary;
  defaults?: ListingFormDefaults;
  editionCatalog?: EditionCatalog | null; // séries du jeu déjà choisi, rendues avec la page
  /* En modification : l'annonce et son lien existent, et ne changent pas. */
  listingId?: string;
  permalink?: string;
  draftId?: string; // tiré par la page à l'affichage : l'identifiant que portera l'annonce
  photoUploads?: boolean; // faux tant que les photos ne s'enregistrent pas (phase 3)
  now: string; // figée par le serveur : l'aperçu rend pareil des deux côtés
};

/* Le formulaire reste monté, masqué, quand le récapitulatif s'affiche :
   démonté, « Revenir au formulaire » rendait un formulaire vide. Les champs
   sont non contrôlés ; leur vérité vit dans le DOM, qui ne disparaît plus. */
export function ListingForm({ openWantedListings, seller, defaults, editionCatalog, listingId, permalink, draftId, photoUploads = true, now }: ListingFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [photos, setPhotos] = useState<DraftPhoto[]>(defaults?.photos ?? []);
  const [isPreparingPhotos, setIsPreparingPhotos] = useState(false);
  const [draft, setDraft] = useState<ListingDraft>(() => initialDraft(defaults));
  const [place, setPlace] = useState<City | null>(defaults?.place ?? null);
  const editions = useGameEditions(draft.gameId, editionCatalog);
  const identity = useDraftIdentity(listingId, draftId);
  const { errors, published, failure, isPending, handleSubmit, backToForm } = useListingSubmit(photos, { photoUploads, onResult: identity.remember });
  const errorCount = Object.keys(errors).length;
  const setExtraPhotos = (isChecked: boolean) => setDraft((current) => ({ ...current, extraPhotos: isChecked ? "on" : "" }));

  return (
    <>
      {published ? (
        <ListingSummary
          published={published}
          photos={photos}
          seller={seller}
          now={now}
          openWantedListings={openWantedListings}
          permalink={permalink}
          options={{ isFeatured: draft.isFeatured, isUrgent: draft.isUrgent, isBumped: draft.isBumped }}
          city={place}
          editions={editions.byId}
          onEdit={backToForm}
        />
      ) : null}

      {/* Champs à gauche ; à droite l'aperçu, qui suit la saisie, puis les
          options payantes, qui arrivent à côté du bouton de publication. Sur
          téléphone, l'aperçu et les options passent avant « Publier » : on
          relit la vignette, puis on publie.

          L'écoute est posée ici et non sur le <form> : les options vivent hors
          de la balise (attribut form), leurs événements n'y remontent pas. Lue
          pendant l'événement — React exécute la mise à jour plus tard. */}
      <div
        hidden={published !== null}
        onChange={() => {
          if (!formRef.current) return;
          const next = readDraft(formRef.current);
          setDraft((current) => ({ ...current, ...next }));
        }}
        className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_380px]"
      >
        <form ref={formRef} id={FORM_ID} onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {identity.editId ? <input type="hidden" name="listingId" value={identity.editId} /> : null}
          {identity.draftId ? <input type="hidden" name="draftId" value={identity.draftId} /> : null}
          <FormErrorBanner count={errorCount} />

          <PhotoSection
            isAvailable={photoUploads}
            photos={photos}
            onChange={setPhotos}
            hasExtra={draft.extraPhotos !== ""}
            onRequestExtra={() => setExtraPhotos(true)}
            onPreparingChange={setIsPreparingPhotos}
            watermark={`@${seller.username}`}
            error={errors.photos}
          />

          <ListingFormFields
            errors={errors}
            choices={draft}
            defaults={defaults}
            editions={editions}
            onChoiceChange={(field, value) =>
              setDraft((current) => ({ ...current, [field]: value, ...(field === "gameId" ? checksForGame(value, defaults) : {}) }))
            }
            onCityChange={(city) => setDraft((current) => ({ ...current, city }))}
            onPlaceChange={setPlace}
          />

          <FormSection step={listingStepNumber("audience")} title="Qui voit l'annonce" description="Tout le monde, ou seulement les boutiques au forfait pro : elles achètent vite, au comptant, et sans négocier pendant trois jours.">
            <AudienceField defaultValue={defaults?.audience} error={errors.audience} />
          </FormSection>

          <SellerStatusSection seller={seller} isEdit={Boolean(permalink)} error={errors.privateSeller} />
        </form>

        <aside aria-label="Aperçu et options" className="flex flex-col gap-8 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:flex-1">
            <StickyColumn>
              <ListingPreview draft={draft} photos={photos} seller={seller} now={now} city={place} editions={editions.byId} />
            </StickyColumn>
          </div>
          <ListingOptions
            form={FORM_ID}
            extraPhotos={photoUploads ? { isChecked: draft.extraPhotos !== "", isPaid: defaults?.extraPhotos === "on", onChange: setExtraPhotos } : null}
          />
        </aside>

        <ListingPublishBar form={FORM_ID} isPending={isPending} isPreparingPhotos={isPreparingPhotos} isEdit={Boolean(permalink)} failure={failure} />
      </div>
    </>
  );
}
