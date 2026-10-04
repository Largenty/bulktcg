"use client";

import { useEffect, useState } from "react";

const RESET_DELAY_MS = 2400;

/* Retourne l'état de la dernière copie et la fonction pour copier.
   L'effet ne sert qu'au minuteur de remise à zéro — le seul cas où un
   useEffect est légitime ici — et il se nettoie. */
export function useCopyToClipboard() {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), RESET_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      /* Contexte non sécurisé, permission refusée, navigateur ancien :
         on le dit plutôt que de faire croire que c'est copié. */
      setStatus("failed");
    }
  }

  return { status, copy };
}
