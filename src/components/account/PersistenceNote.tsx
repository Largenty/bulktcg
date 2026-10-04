import type { MutationResult } from "@/lib/data/mutation-result";
import { countLabel } from "@/lib/french";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type PersistenceNoteProps = {
  result: MutationResult<unknown> | null;
  /* Ce qui a été demandé, dit en clair : « passer en Réservé ». */
  action: string;
  /* Formulation propre au geste, quand la phrase générique sonnerait faux :
     un message n'est pas « enregistré », il n'est pas « parti ». */
  notPersistedText?: string;
  /* Ce que la ligne dit avant toute action : une consigne plutôt qu'un vide
     réservé. */
  idleText?: string;
};

/* Le compte rendu d'une écriture, dans une région annoncée aux lecteurs
   d'écran. En démonstration, rien n'est enregistré et la phrase le dit : une
   confirmation qui mentirait serait pire que pas de bouton. Avec la base,
   « saved » s'affiche sans qu'une ligne de ce composant change. */
export function PersistenceNote({ result, action, notPersistedText, idleText }: PersistenceNoteProps) {
  return (
    <p role="status" className={`min-h-[1lh] text-[length:var(--text-sm)] leading-snug ${result === null ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}>
      {result === null ? (idleText ?? null) : describe(result, action, notPersistedText)}
    </p>
  );
}

function describe(result: MutationResult<unknown>, action: string, notPersistedText?: string): string {
  switch (result.status) {
    case "saved":
      return `C'est fait : ${action}.`;
    case "not-persisted":
      return (
        notPersistedText ??
        `Demande valide (${action}), mais rien n'est enregistré : ${DEMO_MODE_REASON}.`
      );
    case "invalid":
      return Object.values(result.fieldErrors)[0] ?? "La demande a été refusée.";
    case "unauthenticated":
      return "Votre session a expiré : reconnectez-vous pour continuer.";
    case "not-found":
      return "Introuvable : l'élément a peut-être été retiré entre-temps.";
    case "failed":
      return result.retryable
        ? `La demande n'a pas abouti (${action}) : le réseau ou le serveur a fait défaut. Rien n'a été enregistré ; réessayez dans un instant.`
        : `La demande n'a pas pu être traitée (${action}), et rien n'a été enregistré.`;
    case "rate-limited":
      return `Trop de demandes en peu de temps : rien n'a été enregistré. Réessayez dans ${retryDelay(result.retryAfterSeconds)}.`;
  }
}

/* « dans 45 secondes », « dans 2 minutes » : arrondi vers le haut, pour ne
   jamais inviter à réessayer trop tôt. */
function retryDelay(seconds: number): string {
  if (seconds < 60) return countLabel(Math.max(1, Math.ceil(seconds)), "seconde");
  if (seconds < 3600) return countLabel(Math.ceil(seconds / 60), "minute");
  return countLabel(Math.ceil(seconds / 3600), "heure");
}
