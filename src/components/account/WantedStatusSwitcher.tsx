"use client";

import { changeWantedStatus } from "@/app/actions/wanted";
import { StatusSwitcher } from "@/components/account/StatusSwitcher";
import { WANTED_STATUS_LABELS } from "@/lib/labels";
import { WANTED_STATUSES, type WantedStatus } from "@/types/wanted";

/* « Trouvé » et « Abandonnée » sont deux fins distinctes : la première dit
   que le produit a servi, la seconde que l'acheteur est parti ailleurs. Les
   confondre ferait disparaître la seule mesure honnête de l'utilité du
   croisement. */
const OPTIONS = WANTED_STATUSES.map((value) => ({
  value,
  label: WANTED_STATUS_LABELS[value],
}));

export function WantedStatusSwitcher({
  wantedId,
  title,
  status,
}: {
  wantedId: string;
  title: string;
  status: WantedStatus;
}) {
  return (
    <StatusSwitcher
      label={`Statut de la recherche ${title}`}
      initialStatus={status}
      options={OPTIONS}
      onChangeAction={(next) => changeWantedStatus(wantedId, next)}
    />
  );
}
