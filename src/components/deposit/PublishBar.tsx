import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import type { MutationResult } from "@/lib/data/mutation-result";

type PublishBarProps = {
  /* Le bouton peut vivre hors du <form>, rattaché par son attribut form : la
     soumission, la touche Entrée et la validation restent celles du
     formulaire. */
  form: string;
  isPending: boolean;
  /* Ce que dit le bouton pendant l'attente : « Vérification… » par défaut,
     « Préparation des photos… » tant qu'elles se convertissent. */
  pendingLabel?: string;
  submitLabel: string;
  note: string;
  failure: MutationResult<unknown> | null;
  /* Ce que dit la note de persistance : « publier l'annonce »… */
  action: string;
};

/* Le bouton de publication d'un dépôt, sa note, et ce que l'écriture a
   donné. Il occupe la première colonne du gabarit, sous les champs. */
export function PublishBar({ form, isPending, pendingLabel = "Vérification…", submitLabel, note, failure, action }: PublishBarProps) {
  return (
    <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" form={form} size="lg" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
        <p className="text-[length:var(--text-sm)] text-[var(--muted)]">{note}</p>
      </div>
      <PersistenceNote result={failure} action={action} />
    </div>
  );
}

/* La barre d'une annonce : publier, ou enregistrer une modification, et ce
   que le lien permanent devient dans chaque cas. */
export function ListingPublishBar({
  form,
  isPending,
  isPreparingPhotos,
  isEdit,
  failure,
}: Pick<PublishBarProps, "form" | "isPending" | "failure"> & { isPreparingPhotos: boolean; isEdit: boolean }) {
  return (
    <PublishBar
      form={form}
      isPending={isPending || isPreparingPhotos}
      pendingLabel={isPreparingPhotos ? "Préparation des photos…" : undefined}
      submitLabel={isEdit ? "Enregistrer les modifications" : "Publier l'annonce"}
      note={
        isEdit
          ? "Le lien ne change pas, même si vous modifiez le titre : ceux qui l'ont partagé verront la version à jour."
          : "Vous pourrez modifier le texte et le prix ensuite : le lien, lui, ne changera plus."
      }
      failure={failure}
      action="publier l'annonce"
    />
  );
}
