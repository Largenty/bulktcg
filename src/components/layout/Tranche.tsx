import { NAMED_GAME_IDS } from "@/types/game";
import { gameColorVariable } from "@/lib/game-style";

/* La signature du site : tous les jeux côte à côte, comme la tranche d'une
   brique de cartes vue de côté — celle du logo. Purement décorative —
   les jeux sont nommés partout ailleurs. Construite depuis les jeux nommés
   de GAME_IDS : un jeu ajouté y prend sa place sans qu'on touche au CSS.
   « Autre » n'y entre pas — ce n'est pas un jeu, et son graphite éteindrait
   la signature. */
export function Tranche({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={["tranche", className].filter(Boolean).join(" ")}>
      {NAMED_GAME_IDS.map((gameId) => (
        <span key={gameId} style={{ backgroundColor: gameColorVariable(gameId) }} />
      ))}
    </div>
  );
}
