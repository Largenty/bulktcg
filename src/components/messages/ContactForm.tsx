"use client";

import { contactSellerAction } from "@/app/actions/messages";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { QuickReplies } from "@/components/messages/QuickReplies";
import { useMessageDraft } from "@/components/messages/useMessageDraft";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

const REPLIES = [
  "Le lot est-il toujours disponible ?",
  "Je peux passer cette semaine : quand êtes-vous libre ?",
  "Le prix est-il discutable ?",
  "Pouvez-vous m'envoyer une photo de plus près ?",
];

/* Le premier message à un vendeur, rattaché au lot : il saura de quoi on
   parle, et le fil portera la photo, le prix et le statut en tête. */
export function ContactForm({
  listingId,
  sellerName,
  initialBody,
}: {
  listingId: string;
  sellerName: string;
  initialBody: string;
}) {
  const draft = useMessageDraft(initialBody, contactSellerAction);

  return (
    <form onSubmit={draft.submit} className="panel flex flex-col gap-5" noValidate>
      <input type="hidden" name="listingId" value={listingId} />
      <Textarea
        id="message"
        name="body"
        label={`Votre message à ${sellerName}`}
        rows={7}
        isRequired
        value={draft.body}
        onChange={(event) => draft.setBody(event.target.value)}
        error={draft.error}
        hint="Proposez un lieu public et un créneau : c'est ce qui fait aboutir un rendez-vous."
      />
      <QuickReplies replies={REPLIES} onPick={draft.append} />
      <div className="flex flex-wrap items-center gap-3 border-t-[length:var(--border-width)] border-[var(--line)] pt-5">
        <Button type="submit" size="lg" disabled={draft.isPending}>
          <Icon name="message" size={18} />
          {draft.isPending ? "Envoi…" : "Envoyer le message"}
        </Button>
      </div>
      <PersistenceNote
        result={draft.result}
        action="envoyer ce message"
        notPersistedText={`Message prêt, mais rien n'est parti : ${DEMO_MODE_REASON}. Votre texte reste ici.`}
      />
    </form>
  );
}
