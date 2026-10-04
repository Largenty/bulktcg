"use client";

import { useId, useState } from "react";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useMutation } from "@/components/ui/useMutation";
import { isTransientFailure, type MutationResult } from "@/lib/data/mutation-result";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type DeleteActionProps = {
  /* Ce qui serait supprimé, nommé. « Supprimer ? » tout seul ne dit pas quoi,
     et c'est exactement l'écran sur lequel on ne veut pas se tromper. */
  itemName: string;
  /* Ce qu'on perd, écrit avant le clic et non après. */
  consequence: string;
  /* L'action serveur. En démonstration elle rend « not-persisted », et
     l'écran dit que rien n'a été supprimé. */
  onConfirmAction: () => Promise<MutationResult<unknown>>;
  buttonLabel?: string;
  confirmLabel?: string;
  /* Le même geste en deux temps sert aussi à bloquer : la question, l'icône
     et le compte rendu de phase 1 changent avec lui. */
  question?: string;
  pendingLabel?: string;
  doneTitle?: string;
  notPersistedText?: string;
  icon?: "trash" | "ban";
};

type Step = "idle" | "confirming" | "done";

/* Confirmation en deux temps, dépliée dans le flux plutôt que dans une boîte
   modale : la ligne concernée reste visible au-dessus. Le bouton rouge
   n'existe qu'au second temps, et le focus part sur « Annuler » : une touche
   Entrée d'un doigt trop rapide ne doit rien déclencher d'irréversible. */
export function DeleteAction({
  itemName,
  consequence,
  onConfirmAction,
  buttonLabel = "Supprimer",
  confirmLabel = "Supprimer définitivement",
  question,
  pendingLabel = "Suppression…",
  doneTitle = "Rien n'a été supprimé.",
  notPersistedText = `La demande est valide, mais rien n'est supprimé : ${DEMO_MODE_REASON}.`,
  icon = "trash",
}: DeleteActionProps) {
  const [step, setStep] = useState<Step>("idle");
  const { result, isPending, run } = useMutation<unknown>();
  const headingId = useId();

  /* Un échec passager garde la confirmation ouverte, compte rendu dessous :
     le geste reste à portée de main pour réessayer. */
  function confirm() {
    run(onConfirmAction, (outcome) => {
      if (!isTransientFailure(outcome)) setStep("done");
    });
  }

  if (step === "done") {
    return (
      <div className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] bg-[var(--tint)] p-4">
        {result?.status === "not-persisted" ? (
          <p role="status" className="text-[length:var(--text-md)] leading-snug text-[var(--ink-soft)]">
            <strong className="font-semibold text-[var(--ink)]">{doneTitle}</strong> {notPersistedText}
          </p>
        ) : (
          <PersistenceNote result={result} action={`supprimer « ${itemName} »`} />
        )}
      </div>
    );
  }

  if (step === "confirming") {
    return (
      <div role="group" aria-labelledby={headingId} className="notice notice-danger">
        <p id={headingId} className="text-[length:var(--text-md)] font-semibold leading-snug">
          {question ?? `Supprimer « ${itemName} » ?`}
        </p>
        <p className="mt-2 text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">{consequence}</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Button size="sm" variant="secondary" ref={(node) => node?.focus()} onClick={() => setStep("idle")}>
            Annuler
          </Button>
          <Button size="sm" variant="danger" onClick={confirm} disabled={isPending}>
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </div>
        {result && isTransientFailure(result) ? (
          <div className="mt-3">
            <PersistenceNote result={result} action={`supprimer « ${itemName} »`} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Button size="sm" variant="quiet" onClick={() => setStep("confirming")} className="text-[var(--danger)]">
      <Icon name={icon} size={16} />
      {buttonLabel}
      <span className="sr-only"> {itemName}</span>
    </Button>
  );
}
