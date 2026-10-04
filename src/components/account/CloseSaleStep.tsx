"use client";

import { useState } from "react";
import { closeDealAction } from "@/app/actions/deals";
import { changeListingStatus } from "@/app/actions/listings";
import { BuyerChoices, ELSEWHERE, firstBuyerChoice, type BuyerCandidate } from "@/components/account/BuyerChoices";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMutation } from "@/components/ui/useMutation";
import type { MutationResult } from "@/lib/data/mutation-result";
import { DEAL_KIND_LABELS } from "@/lib/labels";
import { LISTING_LIFECYCLE } from "@/lib/listing-lifecycle";
import { DEAL_KINDS, type DealKind } from "@/types/deal";

type CloseSaleStepProps = {
  listingId: string;
  title: string;
  buyers: BuyerCandidate[];
  onDone: (outcome: MutationResult<unknown>) => void;
  onCancel: () => void;
};

const KIND_OPTIONS = DEAL_KINDS.map((value) => ({ value, label: DEAL_KIND_LABELS[value] }));

/* Dit au moment où le lot part : ses photos ne restent pas indéfiniment. */
const PHOTO_REMOVAL_NOTE = `Ses photos seront supprimées de BulkTCG ${LISTING_LIFECYCLE.archiveAfterDays} jours après la vente ; le texte, le prix et les avis restent.`;

/* « Vendu », mais à qui ? Désigner l'acheteur clôture la vente et ouvre
   l'avis des deux côtés ; « hors BulkTCG » passe seulement le lot en
   « Vendu », sans personne à noter. Déplié dans la ligne, comme la
   suppression : on voit le lot dont on parle. */
export function CloseSaleStep({ listingId, title, buyers, onDone, onCancel }: CloseSaleStepProps) {
  const [buyer, setBuyer] = useState(firstBuyerChoice(buyers));
  const [kind, setKind] = useState<DealKind>("sale");
  const { isPending, run } = useMutation<unknown>();
  const isElsewhere = buyer === ELSEWHERE;

  function confirm() {
    run(() => (isElsewhere ? changeListingStatus(listingId, "sold") : closeDealAction(buyer, kind)), onDone);
  }

  return (
    <fieldset className="notice flex w-full flex-col gap-3">
      <legend className="float-left mb-1 w-full text-[length:var(--text-md)] font-semibold leading-snug">
        À qui avez-vous vendu « {title} » ?
      </legend>
      <BuyerChoices
        name={`buyer-${listingId}`}
        buyers={buyers}
        notes={{ buyer: "vous a écrit à propos de ce lot", elsewhere: "hors BulkTCG : personne à noter" }}
        value={buyer}
        onChange={setBuyer}
      />
      {isElsewhere ? null : (
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden="true" className="text-[length:var(--text-md)] font-semibold">
            C&apos;était
          </span>
          <SegmentedControl label="Nature de l'accord" value={kind} options={KIND_OPTIONS} onChange={setKind} isDisabled={isPending} />
        </div>
      )}
      <p className="text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
        {isElsewhere
          ? "Le lot passe en « Vendu ». Sans acheteur désigné, aucun avis ne s'ouvre."
          : "La vente est clôturée : le lot reste « Vendu », et vous pourrez vous noter l'un l'autre. Une vente clôturée ne se défait pas."}{" "}
        {PHOTO_REMOVAL_NOTE}
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" onClick={confirm} disabled={isPending}>
          {isPending ? "Enregistrement…" : isElsewhere ? "Passer en « Vendu »" : "Clôturer la vente"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={isPending}>
          Annuler
        </Button>
      </div>
    </fieldset>
  );
}
