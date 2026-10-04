"use client";

import { renewListingAction } from "@/app/actions/listings";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/components/ui/useMutation";

type RenewListingButtonProps = {
  listingId: string;
  /* Nommé jusque dans le bouton : sur un tableau de bord de dix lignes,
     « Prolonger » répété dix fois ne se distingue pas au lecteur d'écran. */
  title: string;
  /* « Prolonger », ou « Remettre en ligne » une fois l'annonce expirée. */
  label: string;
};

/* Le geste gratuit qui garde une annonce dans les listes : quatre-vingt-dix
   jours de plus, à compter d'aujourd'hui. Un aplat d'encre — c'est une chose
   à faire —, et le compte rendu dit ce qui a vraiment été enregistré. */
export function RenewListingButton({ listingId, title, label }: RenewListingButtonProps) {
  const { result, isPending, run } = useMutation<unknown>();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button size="sm" onClick={() => run(() => renewListingAction(listingId))} disabled={isPending}>
        {isPending ? "Enregistrement…" : label}
        <span className="sr-only"> {title}</span>
      </Button>
      <PersistenceNote result={result} action={`${label.toLowerCase()} l'annonce`} />
    </div>
  );
}
