"use client";

import { markNotificationsReadAction } from "@/app/actions/waitlist";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import { useMutation } from "@/components/ui/useMutation";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

/* Tout marquer comme lu d'un clic. Phase 1 : rien n'est écrit, et la ligne
   le dit plutôt que de faire disparaître le chiffre de la cloche. */
export function MarkAllRead() {
  const { result, isPending, run } = useMutation<null>();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => run(() => markNotificationsReadAction())}
      >
        Tout marquer comme lu
      </Button>
      <PersistenceNote
        result={result}
        action="tout marquer comme lu"
        notPersistedText={`Demande valide, mais rien n'est enregistré : ${DEMO_MODE_REASON}.`}
      />
    </div>
  );
}
