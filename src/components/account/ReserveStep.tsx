"use client";

import { useState } from "react";
import { changeListingStatus } from "@/app/actions/listings";
import { reserveForBuyerAction } from "@/app/actions/waitlist";
import { BuyerChoices, ELSEWHERE, firstBuyerChoice, type BuyerCandidate } from "@/components/account/BuyerChoices";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/components/ui/useMutation";
import type { MutationResult } from "@/lib/data/mutation-result";

type ReserveStepProps = {
  listingId: string;
  title: string;
  buyers: BuyerCandidate[];
  onDone: (outcome: MutationResult<unknown>) => void;
  onCancel: () => void;
};

/* « Réservé », mais pour qui ? La personne choisie continue de vous écrire ;
   les autres voient le lot réservé, ne peuvent plus vous relancer et
   s'inscrivent sur la liste d'attente. Réserver hors du site ne désigne
   personne : plus aucun nouveau message. */
export function ReserveStep({ listingId, title, buyers, onDone, onCancel }: ReserveStepProps) {
  const [buyer, setBuyer] = useState(firstBuyerChoice(buyers));
  const { isPending, run } = useMutation<unknown>();
  const isElsewhere = buyer === ELSEWHERE;

  function confirm() {
    run(() => (isElsewhere ? changeListingStatus(listingId, "reserved") : reserveForBuyerAction(buyer)), onDone);
  }

  return (
    <fieldset className="notice flex w-full flex-col gap-3">
      <legend className="float-left mb-1 w-full text-[length:var(--text-md)] font-semibold leading-snug">
        Pour qui réservez-vous « {title} » ?
      </legend>
      <BuyerChoices
        name={`reserve-${listingId}`}
        buyers={buyers}
        notes={{ buyer: "continuera de vous écrire", elsewhere: "hors BulkTCG : plus aucun nouveau message" }}
        value={buyer}
        onChange={setBuyer}
      />
      <p className="text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
        Ceux qui vous ont écrit verront le lot réservé et ne pourront plus vous relancer ; ils peuvent s&apos;inscrire sur
        la liste d&apos;attente et recevront une notification s&apos;il redevient disponible. Vous ne verrez que leur nombre.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" onClick={confirm} disabled={isPending}>
          {isPending ? "Enregistrement…" : "Réserver"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
      </div>
    </fieldset>
  );
}
