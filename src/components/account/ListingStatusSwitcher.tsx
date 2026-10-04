"use client";

import { changeListingStatus } from "@/app/actions/listings";
import type { BuyerCandidate } from "@/components/account/BuyerChoices";
import { CloseSaleStep } from "@/components/account/CloseSaleStep";
import { ReserveStep } from "@/components/account/ReserveStep";
import { StatusSwitcher } from "@/components/account/StatusSwitcher";
import { STATUS_LABELS } from "@/lib/labels";
import { LISTING_STATUSES, type ListingStatus } from "@/types/listing";

const OPTIONS = LISTING_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

/* Trois états, tous visibles : on voit d'un coup d'œil où en est l'annonce,
   et le changement coûte un clic — sur la fiche comme dans le compte. Quand
   quelqu'un a écrit à propos du lot, « Réservé » demande pour qui — elle
   seule continue d'écrire —, et « Vendu » à qui : c'est ce qui clôture la
   vente et ouvre les avis. */
export function ListingStatusSwitcher({
  listingId,
  title,
  status,
  buyers = [],
  idleText,
}: {
  listingId: string;
  title: string;
  status: ListingStatus;
  buyers?: BuyerCandidate[];
  idleText?: string;
}) {
  return (
    <StatusSwitcher
      label={`Statut de l'annonce ${title}`}
      initialStatus={status}
      options={OPTIONS}
      onChangeAction={(next) => changeListingStatus(listingId, next)}
      idleText={idleText}
      confirmSteps={
        buyers.length > 0
          ? [
              {
                value: "reserved",
                render: ({ onDone, onCancel }) => (
                  <ReserveStep listingId={listingId} title={title} buyers={buyers} onDone={onDone} onCancel={onCancel} />
                ),
              },
              {
                value: "sold",
                reopenLabel: "Désigner l'acheteur",
                render: ({ onDone, onCancel }) => (
                  <CloseSaleStep listingId={listingId} title={title} buyers={buyers} onDone={onDone} onCancel={onCancel} />
                ),
              },
            ]
          : []
      }
    />
  );
}
