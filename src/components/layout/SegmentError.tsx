"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

type SegmentErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  /* Ce qui n'a pas pu se charger, nommé : « Cet onglet », « Ce fil ». */
  subject: string;
  /* Ce qui reste utilisable autour, dit en une phrase. */
  aside: string;
};

/* L'erreur d'une partie de page : le compte garde son identité et ses
   onglets, la messagerie sa liste de conversations. Sans limite de segment,
   la moindre lecture ratée d'un onglet remplaçait tout le gabarit par
   l'écran d'erreur racine, navigation comprise.

   « Réessayer » appelle retry(), qui relit les données et refait le rendu ;
   reset() se contentait d'effacer l'erreur, et une base indisponible
   retombait à l'identique au premier clic. */
export function SegmentError({ error, retry, subject, aside }: SegmentErrorProps) {
  useEffect(() => {
    /* Phase 2 : la supervision reçoit l'erreur côté serveur
       (instrumentation.ts, onRequestError) ; la console garde la trace
       côté navigateur. */
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="notice notice-danger flex flex-col items-start gap-3">
      <p className="text-[length:var(--text-lg)] font-semibold">{subject} n&apos;a pas pu se charger.</p>
      <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
        Une donnée n&apos;a pas pu être lue — la base, le réseau, ou une valeur refusée plutôt qu&apos;affichée
        fausse. {aside}
      </p>
      {error.digest ? (
        <p className="mono text-[length:var(--text-xs)] text-[var(--muted)]">Référence de l&apos;incident : {error.digest}</p>
      ) : null}
      <Button size="sm" onClick={retry}>
        Réessayer
      </Button>
    </div>
  );
}
