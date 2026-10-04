"use client";

import { useState } from "react";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/SegmentedControl";
import { useMutation } from "@/components/ui/useMutation";
import { isAccepted, type MutationResult } from "@/lib/data/mutation-result";

/* Une étape qui s'intercale avant un statut : « Réservé » pour qui ?
   « Vendu » à qui ? Elle écrit elle-même, puis rend son compte rendu. */
export type ConfirmStep<T extends string> = {
  value: T;
  /* Rouvrir l'étape quand le statut est déjà posé : un lot passé en
     « Vendu » d'un clic peut recevoir son acheteur après coup. */
  reopenLabel?: string;
  render: (step: { onDone: (outcome: MutationResult<unknown>) => void; onCancel: () => void }) => React.ReactNode;
};

type StatusSwitcherProps<T extends string> = {
  /* « Statut de l'annonce Vrac 400 cartes » : le titre, jamais l'identifiant
     interne — « Statut de l'annonce l-01 » ne disait rien à personne. */
  label: string;
  initialStatus: T;
  options: SegmentedOption<T>[];
  /* L'action serveur, liée à l'élément par l'appelant. */
  onChangeAction: (status: T) => Promise<MutationResult<unknown>>;
  confirmSteps?: ConfirmStep<T>[];
  /* La consigne avant tout clic. Dite une fois par page : répétée sous
     chaque ligne d'une liste, elle n'était plus lue. */
  idleText?: string;
};

/* Le statut en un clic : la promesse du produit, côté vendeur comme côté
   acheteur. Le choix s'affiche tout de suite ; le compte rendu de l'écriture
   suit, et il dit la vérité sur ce qui a été enregistré. */
export function StatusSwitcher<T extends string>({
  label,
  initialStatus,
  options,
  onChangeAction,
  confirmSteps = [],
  idleText,
}: StatusSwitcherProps<T>) {
  const [status, setStatus] = useState<T>(initialStatus);
  const [confirming, setConfirming] = useState<ConfirmStep<T> | null>(null);
  const { result, isPending, run, setResult } = useMutation<unknown>();

  function change(next: T) {
    const step = confirmSteps.find((candidate) => candidate.value === next);
    if (step && next !== status) {
      setConfirming(step);
      return;
    }
    const previous = status;
    setStatus(next);
    /* Une écriture refusée — ou perdue en route — remet l'ancien statut :
       l'écran ne doit pas montrer un état que personne n'a accepté. */
    run(
      () => onChangeAction(next),
      (outcome) => {
        if (!isAccepted(outcome)) setStatus(previous);
      },
    );
  }

  function finishStep(outcome: MutationResult<unknown>) {
    const value = confirming?.value;
    setConfirming(null);
    setResult(outcome);
    if (value && isAccepted(outcome)) setStatus(value);
  }

  /* Pendant l'étape, le choix en cours s'affiche déjà : on voit ce qu'on est
     en train de confirmer. Annuler rend l'ancien statut. */
  const shown = confirming ? confirming.value : status;
  const selected = options.find((option) => option.value === shown)?.label ?? "";
  const reopen = confirming ? undefined : confirmSteps.find((step) => step.value === status && step.reopenLabel);

  return (
    <div className="flex w-full flex-col items-start gap-2">
      <SegmentedControl label={label} value={shown} options={options} onChange={change} isDisabled={isPending || confirming !== null} />
      {confirming ? confirming.render({ onDone: finishStep, onCancel: () => setConfirming(null) }) : null}
      {reopen ? (
        <button
          type="button"
          onClick={() => setConfirming(reopen)}
          className="text-[length:var(--text-sm)] font-semibold underline underline-offset-4"
        >
          {reopen.reopenLabel}
        </button>
      ) : null}
      <PersistenceNote result={result} action={`passer en « ${selected} »`} idleText={idleText} />
    </div>
  );
}
