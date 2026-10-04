"use client";

import { sendMessageAction } from "@/app/actions/messages";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { QuickReplies } from "@/components/messages/QuickReplies";
import { useMessageDraft } from "@/components/messages/useMessageDraft";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Textarea } from "@/components/ui/Textarea";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

const REPLIES = ["Je peux passer demain vers 18 h.", "Où préférez-vous qu'on se retrouve ?", "C'est d'accord pour moi."];

/* La réponse dans un fil. Le bouton est actif : l'envoi passe par l'action
   serveur, qui valide et contrôle que l'on participe bien à la conversation.
   En phase 1 rien ne part, et le compte rendu le dit sous le bouton — le
   texte, lui, reste dans le champ. */
export function MessageComposer({
  conversationId,
  recipientUsername,
}: {
  conversationId: string;
  recipientUsername: string;
}) {
  const draft = useMessageDraft("", sendMessageAction);

  return (
    <form onSubmit={draft.submit} className="panel flex flex-col gap-4" noValidate>
      <input type="hidden" name="conversationId" value={conversationId} />
      <Textarea
        id="nouveau-message"
        name="body"
        label={`Répondre à ${recipientUsername}`}
        rows={4}
        hasOptionalHint={false}
        placeholder="Proposez un lieu et un créneau…"
        value={draft.body}
        onChange={(event) => draft.setBody(event.target.value)}
        error={draft.error}
      />
      <QuickReplies replies={REPLIES} onPick={draft.append} />
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={draft.isPending}>
          <Icon name="message" size={18} />
          {draft.isPending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
      <PersistenceNote
        result={draft.result}
        action="envoyer ce message"
        notPersistedText={`Message prêt, mais rien n'est parti : ${DEMO_MODE_REASON}.`}
      />
    </form>
  );
}
