"use client";

import { proposeListingAction } from "@/app/actions/messages";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { useMessageDraft } from "@/components/messages/useMessageDraft";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

export type ProposalCandidate = {
  id: string;
  title: string;
  price: string;
  /* Ce que le croisement en dit : « certain », « à vérifier », ou hors des
     critères de l'acheteur — ce qui ne l'interdit pas, mais se dit. */
  fit: "certain" | "probable" | "outside";
  note: string | null;
};

const FIT_LABEL: Record<ProposalCandidate["fit"], string> = {
  certain: "Correspond",
  probable: "À vérifier",
  outside: "Hors critères",
};

/* Le vendeur répond à une demande en proposant l'un de ses lots. Le lot est
   choisi dans une liste de cartes à cocher : le bouton radio natif reste
   là, masqué, il porte le choix, le clavier et la soumission. */
export function ProposeForm({
  wantedId,
  buyerName,
  candidates,
  initialBody,
}: {
  wantedId: string;
  buyerName: string;
  candidates: ProposalCandidate[];
  initialBody: string;
}) {
  const draft = useMessageDraft(initialBody, proposeListingAction);
  const listingError = draft.result?.status === "invalid" ? draft.result.fieldErrors.listingId : undefined;

  return (
    <form onSubmit={draft.submit} className="panel flex flex-col gap-6" noValidate>
      <input type="hidden" name="wantedId" value={wantedId} />
      <fieldset className="flex flex-col gap-2.5" aria-describedby={listingError ? "listingId-error" : undefined}>
        <legend className="mb-2 text-[length:var(--text-md)] font-semibold">Le lot que vous proposez</legend>
        {candidates.map((candidate, index) => (
          <label
            key={candidate.id}
            className="group flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] p-3.5 has-[:checked]:border-[var(--ink)] has-[:checked]:bg-[var(--tint)] has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2"
          >
            <input type="radio" name="listingId" value={candidate.id} defaultChecked={index === 0} className="peer sr-only" />
            <span
              aria-hidden="true"
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[length:var(--border-width-strong)] border-[var(--line-strong)] peer-checked:border-[var(--ink)] peer-checked:[&>span]:scale-100"
            >
              <span className="h-2.5 w-2.5 scale-0 rounded-full bg-[var(--ink)] transition-transform" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{candidate.title}</span>
                <span className="price font-bold">{candidate.price}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--text-sm)] text-[var(--ink-soft)]">
                <span className="label rounded-[var(--radius-sm)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] px-1.5 py-0.5">
                  {FIT_LABEL[candidate.fit]}
                </span>
                {candidate.note}
              </span>
            </span>
          </label>
        ))}
        {listingError ? (
          <p id="listingId-error" className="text-[length:var(--text-sm)] font-semibold text-[var(--danger)]">
            {listingError}
          </p>
        ) : null}
      </fieldset>

      <Textarea
        id="message"
        name="body"
        label={`Votre message à ${buyerName}`}
        rows={6}
        isRequired
        value={draft.body}
        onChange={(event) => draft.setBody(event.target.value)}
        error={draft.error}
      />

      <div className="border-t-[length:var(--border-width)] border-[var(--line)] pt-5">
        <Button type="submit" size="lg" disabled={draft.isPending}>
          <Icon name="message" size={18} />
          {draft.isPending ? "Envoi…" : "Proposer ce lot"}
        </Button>
      </div>
      <PersistenceNote
        result={draft.result}
        action="proposer ce lot"
        notPersistedText={`Proposition prête, mais rien n'est parti : ${DEMO_MODE_REASON}. Votre texte reste ici.`}
      />
    </form>
  );
}
