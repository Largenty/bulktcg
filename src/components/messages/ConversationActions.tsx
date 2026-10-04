"use client";

import Link from "next/link";
import { blockUserAction, hideConversationAction } from "@/app/actions/conversations";
import { DeleteAction } from "@/components/account/DeleteAction";
import { Icon } from "@/components/ui/Icon";
import { getReportUrl } from "@/lib/report-target";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type ConversationActionsProps = {
  conversationId: string;
  otherUsername: string;
};

/* Les trois gestes de sortie d'une conversation, du plus léger au plus
   ferme : signaler, bloquer, supprimer. Bloquer et supprimer se confirment
   en deux temps, le focus sur « Annuler » ; signaler ouvre un formulaire. */
export function ConversationActions({ conversationId, otherUsername }: ConversationActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={getReportUrl("conversation", conversationId)}
        className="btn btn-quiet btn-sm text-[var(--ink-soft)]"
      >
        <Icon name="flag" size={16} />
        Signaler
      </Link>
      <DeleteAction
        itemName={otherUsername}
        question={`Bloquer ${otherUsername} ?`}
        consequence={`${otherUsername} ne pourra plus vous écrire, ni ici ni sur une autre annonce, et ne reçoit aucune notification du blocage. Vous pourrez le lever depuis vos paramètres.`}
        onConfirmAction={() => blockUserAction(conversationId)}
        buttonLabel="Bloquer"
        confirmLabel={`Bloquer ${otherUsername}`}
        pendingLabel="Blocage…"
        doneTitle="Personne n'a été bloqué."
        notPersistedText={`La demande est valide, mais le blocage n'est pas enregistré : ${DEMO_MODE_REASON}.`}
        icon="ban"
      />
      <DeleteAction
        itemName={`la conversation avec ${otherUsername}`}
        consequence={`Elle disparaît de votre boîte ; ${otherUsername} garde la sienne. S'il vous réécrit, elle reviendra.`}
        onConfirmAction={() => hideConversationAction(conversationId)}
        buttonLabel="Supprimer"
        confirmLabel="Supprimer de ma boîte"
      />
    </div>
  );
}
