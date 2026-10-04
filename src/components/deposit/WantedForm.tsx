"use client";

import { useRef, useState } from "react";
import type { MatchCandidate } from "@/lib/match-candidate";
import type { SellerSummary } from "@/types/profile";
import { FormErrorBanner } from "@/components/deposit/FormErrorBanner";
import { PublishBar } from "@/components/deposit/PublishBar";
import { WantedFormFields, type WantedChoices } from "@/components/deposit/WantedFormFields";
import { WantedPreview } from "@/components/deposit/WantedPreview";
import { WantedSummary } from "@/components/deposit/WantedSummary";
import { useDraftIdentity } from "@/components/deposit/useDraftIdentity";
import { useWantedSubmit } from "@/components/deposit/useWantedSubmit";
import { StickyColumn } from "@/components/layout/StickyColumn";
import type { City } from "@/lib/city-label";
import type { WantedFormDefaults } from "@/lib/form-defaults";
import { readWantedDraft, type WantedDraft } from "@/lib/wanted-draft";

const FORM_ID = "wanted-form";

type WantedFormProps = {
  /* Les lots déjà en ligne, pour croiser la demande dès sa validation. */
  activeListings: MatchCandidate[];
  buyer: SellerSummary;
  defaults?: WantedFormDefaults;
  wantedId?: string;
  permalink?: string;
  /* Tiré par la page à l'affichage : l'identifiant que portera la demande. */
  draftId?: string;
  /* Fourni par la page : un composant client qui lirait l'heure lui-même
     rendrait autre chose au serveur et au navigateur. */
  now: string;
};

/* Même mécanique que le dépôt d'annonce : validation dans le navigateur,
   puis action serveur ; le formulaire reste monté sous le récapitulatif, et
   « Revenir au formulaire » retrouve tout ce qui était saisi. */
export function WantedForm({ activeListings, buyer, defaults, wantedId, permalink, draftId, now }: WantedFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [choices, setChoices] = useState<WantedChoices>({
    gameId: defaults?.gameId ?? "",
    lotType: defaults?.lotType ?? "",
    maxDistanceKm: defaults?.maxDistanceKm ?? "25",
  });
  /* Les champs texte, relus à chaque frappe pour l'aperçu. Les listes
     déroulantes restent dans choices, qui les pilote. */
  const [typed, setTyped] = useState<Pick<WantedDraft, "title" | "maxPriceEuros" | "minCardCount" | "city">>({
    title: defaults?.title ?? "",
    maxPriceEuros: defaults?.maxPriceEuros ?? "",
    minCardCount: defaults?.minCardCount ?? "",
    city: defaults?.city ?? "",
  });
  const [place, setPlace] = useState<City | null>(defaults?.place ?? null);
  const identity = useDraftIdentity(wantedId, draftId);
  const { errors, published, failure, isPending, handleSubmit, backToForm } = useWantedSubmit(identity.remember);
  const errorCount = Object.keys(errors).length;

  return (
    <>
      {published ? (
        <WantedSummary
          published={published}
          buyer={buyer}
          activeListings={activeListings}
          permalink={permalink}
          now={now}
          city={place}
          onEdit={backToForm}
        />
      ) : null}

      {/* Les champs à gauche, l'aperçu de la carte à droite, qui suit la
          saisie : même gabarit que le dépôt d'annonce. Bridé à 880 px, ce
          formulaire laissait la moitié d'un grand écran vide. */}
      <div hidden={published !== null} className="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form
          ref={formRef}
          id={FORM_ID}
          onSubmit={handleSubmit}
          onChange={(event) => {
            const { title, maxPriceEuros, minCardCount, city } = readWantedDraft(event.currentTarget);
            setTyped({ title, maxPriceEuros, minCardCount, city });
          }}
          noValidate
          className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1"
        >
          {identity.editId ? <input type="hidden" name="wantedId" value={identity.editId} /> : null}
          {identity.draftId ? <input type="hidden" name="draftId" value={identity.draftId} /> : null}
          <FormErrorBanner count={errorCount} />

          <WantedFormFields
            errors={errors}
            choices={choices}
            defaults={defaults}
            onChoiceChange={(field, value) => setChoices((current) => ({ ...current, [field]: value }))}
            onCityChange={(city) => setTyped((current) => ({ ...current, city }))}
            onPlaceChange={setPlace}
          />
        </form>

        <aside aria-label="Aperçu de la demande" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <StickyColumn>
            <WantedPreview draft={{ ...typed, ...choices }} buyer={buyer} activeListings={activeListings} now={now} city={place} />
          </StickyColumn>
        </aside>

        <PublishBar
          form={FORM_ID}
          isPending={isPending}
          submitLabel={permalink ? "Enregistrer les modifications" : "Publier la recherche"}
          note={
            permalink
              ? "Le lien permanent ne change pas, même si vous modifiez le titre."
              : "Gratuit. Vous fermerez la demande en un clic dès que vous aurez trouvé."
          }
          failure={failure}
          action="publier la recherche"
        />
      </div>
    </>
  );
}
