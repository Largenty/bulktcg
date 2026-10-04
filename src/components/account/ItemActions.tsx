"use client";

import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { DeleteAction } from "@/components/account/DeleteAction";
import { ButtonLink } from "@/components/ui/Button";
import type { MutationResult } from "@/lib/data/mutation-result";

type ItemActionsProps = {
  shareUrl: string;
  /* Absent quand l'élément ne se modifie plus : une annonce dont la vente
     est clôturée reste telle qu'elle a été vendue. */
  editHref?: string;
  /* Nommé jusque dans le lien de modification : sur un tableau de bord de
     dix lignes, « Modifier » répété dix fois n'est navigable pour personne
     au lecteur d'écran. */
  itemName: string;
  /* Absents quand l'élément ne se supprime pas : une vente clôturée garde
     son annonce, à laquelle les avis des deux parties se rattachent. */
  deleteConsequence?: string;
  onDeleteAction?: () => Promise<MutationResult<unknown>>;
};

/* Les trois gestes qu'un compte doit avoir sous la main sur chaque ligne, au
   même endroit et dans le même ordre partout : partager, modifier, supprimer. */
export function ItemActions({ shareUrl, editHref, itemName, deleteConsequence, onDeleteAction }: ItemActionsProps) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <CopyLinkButton url={shareUrl} variant="secondary" size="sm" />
      {editHref ? (
        <ButtonLink href={editHref} variant="secondary" size="sm">
          Modifier<span className="sr-only"> {itemName}</span>
        </ButtonLink>
      ) : null}
      {onDeleteAction && deleteConsequence ? (
        <DeleteAction itemName={itemName} consequence={deleteConsequence} onConfirmAction={onDeleteAction} />
      ) : null}
    </div>
  );
}
