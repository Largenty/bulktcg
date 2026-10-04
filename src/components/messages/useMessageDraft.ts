"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@/components/ui/useMutation";
import type { ConversationWriteResult } from "@/lib/data/message-mutations";
import type { MutationResult } from "@/lib/data/mutation-result";
import { routes } from "@/lib/routes";

/* Ce que partagent les trois formulaires de la messagerie — écrire au
   vendeur, proposer un lot, répondre dans un fil : un brouillon qu'on peut
   compléter d'une réponse toute prête, un envoi qui passe par une action
   serveur, et un compte rendu honnête.

   L'envoi est appelé à la main, pas par l'attribut action du formulaire :
   React vide les champs non contrôlés après une action de formulaire, et un
   refus du serveur effacerait alors le message qu'on vient d'écrire. */
export function useMessageDraft(
  initialBody: string,
  send: (formData: FormData) => Promise<MutationResult<ConversationWriteResult>>,
) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const { result, isPending, run } = useMutation<ConversationWriteResult>();

  function append(text: string) {
    setBody((current) => (current.trim() ? `${current.trim()}\n${text}` : text));
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      () => send(formData),
      (outcome) => {
        /* En phase 2, le fil existe : on y va. En phase 1 il n'existe pas, et
           le message reste à l'écran avec le compte rendu. */
        if (outcome.status === "saved" && outcome.data.conversationId) {
          router.push(routes.conversation(outcome.data.conversationId));
        }
      },
    );
  }

  const error = result?.status === "invalid" ? result.fieldErrors.body : undefined;
  return { body, setBody, append, submit, result, isPending, error };
}
