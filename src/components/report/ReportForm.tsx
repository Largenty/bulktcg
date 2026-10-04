"use client";

import type { ReportTarget } from "@/types/report";
import { reportAction } from "@/app/actions/reports";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useMutation } from "@/components/ui/useMutation";
import { REPORT_REASON_LABELS } from "@/lib/labels";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type ReportFormProps = {
  targetType: ReportTarget;
  targetKey: string;
};

/* Un motif dans une liste fermée — la modération traite d'abord l'argent —
   et un détail facultatif. Phase 1 : le signalement est validé côté
   serveur, et l'écran dit qu'il n'est transmis à personne. */
export function ReportForm({ targetType, targetKey }: ReportFormProps) {
  const { result, isPending, run } = useMutation<null>();
  const errors = result?.status === "invalid" ? result.fieldErrors : {};

  if (result?.status === "not-persisted" || result?.status === "saved") {
    return (
      <div role="status" className="notice notice-success flex flex-col gap-2">
        <p className="font-semibold">Signalement reçu.</p>
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          {result.status === "saved"
            ? "La modération le lira. Vous ne serez pas nommé auprès de la personne signalée."
            : `La demande est valide, mais rien n'est transmis : ${DEMO_MODE_REASON}.`}
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => reportAction(data));
      }}
    >
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetKey" value={targetKey} />

      <fieldset className="flex flex-col gap-2.5" aria-describedby={errors.reason ? "reason-error" : undefined}>
        <legend className="mb-1 text-[length:var(--text-md)] font-semibold">Ce qui ne va pas</legend>
        {Object.entries(REPORT_REASON_LABELS).map(([value, label], index) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] px-4 py-3 hover:border-[var(--ink)] has-[:checked]:border-[var(--ink)] has-[:checked]:font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[length:var(--border-width-strong)] has-[:focus-visible]:outline-[var(--ink)]"
          >
            <input id={index === 0 ? "reason" : undefined} type="radio" name="reason" value={value} className="h-4 w-4 accent-[var(--ink)]" />
            {label}
          </label>
        ))}
        {errors.reason ? (
          <p id="reason-error" className="text-[length:var(--text-sm)] font-semibold text-[var(--danger)]">
            {errors.reason}
          </p>
        ) : null}
      </fieldset>

      <Textarea
        id="details"
        name="details"
        label="Précisez"
        rows={5}
        maxLength={1000}
        error={errors.details}
        hint="Ce qui s'est passé, ce qui vous a alerté. Aucune donnée bancaire : personne ne vous les demandera."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Envoi…" : "Envoyer le signalement"}
        </Button>
        {/* Les refus de champ s'affichent sous leur champ ; ici, le reste :
            session expirée, cible disparue, envoi perdu en route. */}
        <PersistenceNote result={result?.status === "invalid" ? null : result} action="envoyer le signalement" />
      </div>
    </form>
  );
}
