import type { GameId } from "@/types/game";
import { ButtonLink } from "@/components/ui/Button";
import { REPLY_BLOCK_REASONS } from "@/lib/conversation-display";
import { routes } from "@/lib/routes";

/* À la place du champ de réponse, pour un particulier qui avait écrit avant
   que le vendeur réserve le lot aux professionnels : le fil reste lisible,
   et la page dit pourquoi on ne peut plus y répondre — plutôt qu'un champ
   dont l'envoi serait refusé. La phrase est celle que la couche données
   rend à un envoi : l'écran et le refus ne peuvent pas se contredire. */
export function ProsOnlyNotice({ gameId }: { gameId: GameId }) {
  return (
    <div className="notice flex flex-col items-start gap-3">
      <p className="text-[length:var(--text-md)] leading-relaxed">
        <strong className="font-semibold">Ce lot est désormais réservé aux professionnels.</strong>{" "}
        {REPLY_BLOCK_REASONS["pros-only"]}
      </p>
      <ButtonLink href={routes.game(gameId)} variant="secondary">
        Voir les autres lots en ligne
      </ButtonLink>
    </div>
  );
}
