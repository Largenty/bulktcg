"use client";

import { useState } from "react";
import { joinWaitlistAction, leaveWaitlistAction } from "@/app/actions/waitlist";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useMutation } from "@/components/ui/useMutation";
import { isAccepted } from "@/lib/data/mutation-result";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type WaitlistButtonProps = {
  listingId: string;
  isOnWaitlist: boolean;
  /* Pleine largeur dans la colonne d'une fiche, à sa taille ailleurs. */
  isBlock?: boolean;
};

/* À la place d'un message qui relancerait le vendeur : s'inscrire, et être
   prévenu avec tous les autres inscrits si le lot redevient disponible. Le
   vendeur ne voit que le nombre d'inscrits, jamais les noms. */
export function WaitlistButton({ listingId, isOnWaitlist, isBlock = false }: WaitlistButtonProps) {
  const [isOnList, setOnList] = useState(isOnWaitlist);
  const { result, isPending, run } = useMutation<null>();

  function toggle() {
    const next = !isOnList;
    run(
      () => (next ? joinWaitlistAction(listingId) : leaveWaitlistAction(listingId)),
      (outcome) => {
        if (isAccepted(outcome)) setOnList(next);
      },
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${isBlock ? "w-full" : "items-start"}`}>
      {isOnList ? (
        <>
          <p className="flex items-start gap-2 text-[length:var(--text-md)] font-semibold leading-snug">
            <Icon name="bell" size={18} className="mt-0.5 shrink-0" />
            Inscription faite : une notification vous préviendra s&apos;il redevient disponible.
          </p>
          <Button variant="quiet" size="sm" onClick={toggle} disabled={isPending} className="self-start">
            Ne plus attendre ce lot
          </Button>
        </>
      ) : (
        <Button size={isBlock ? "lg" : "md"} onClick={toggle} disabled={isPending} className={isBlock ? "w-full" : undefined}>
          <Icon name="bell" size={18} />
          Me prévenir s&apos;il redevient disponible
        </Button>
      )}
      <PersistenceNote
        result={result}
        action={isOnList ? "vous inscrire sur la liste d'attente" : "vous retirer de la liste d'attente"}
        notPersistedText={`Demande valide, mais rien n'est enregistré : ${DEMO_MODE_REASON}.`}
      />
    </div>
  );
}
