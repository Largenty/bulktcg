import type { GameId } from "@/types/game";
import { gameColorVariable } from "@/lib/game-style";
import { createRandom } from "@/lib/random";

type PhotoBlockProps = {
  /* null dans l'aperçu d'un dépôt, tant que le jeu n'est pas choisi : les
     dos de carte restent neutres plutôt que de supposer une couleur. */
  gameId: GameId | null;
  seed: number;
  className?: string;
};

/* Ce qui s'affiche sous la photo pendant son chargement, et à sa place quand
   il n'y en a pas : le boîtier vide, hachuré, et deux dos de carte à la
   couleur du jeu. Pas une fausse photo — un emplacement qui dit déjà de quel
   jeu il s'agit.

   La couleur est franche, pas un pastel : l'ancien emplacement lavé à 16 %
   faisait lire le cramoisi de One Piece comme un rose bébé, sur l'un des
   éléments les plus vus du site — trois jeux sur six n'ont pas de photo de
   démonstration.

   Tout dérive de la graine : identique au serveur et au client, différent
   d'une annonce à l'autre. Le bloc remplit son conteneur, qui décide du
   format. Un <span> positionné, donc un bloc : il vit aussi dans la
   miniature d'une galerie, un bouton qui n'admet que du contenu phrasé. */
export function PhotoBlock({ gameId, seed, className }: PhotoBlockProps) {
  const random = createRandom(seed);
  const angle = 120 + Math.round(random() * 30);
  const tilt = random() < 0.5 ? -1 : 1;
  const gameColor = gameId ? gameColorVariable(gameId) : "var(--line-strong)";

  const backs = [
    /* Le dos du dessous s'écarte et s'efface à moitié. */
    { rotate: tilt * (7 + random() * 3), shiftX: tilt * (9 + random() * 4), shiftY: 2, opacity: 0.55 },
    /* Celui du dessus reste presque droit. */
    { rotate: -tilt * (3 + random() * 3), shiftX: 0, shiftY: 0, opacity: 1 },
  ];

  return (
    <span
      aria-hidden="true"
      className={["block overflow-hidden bg-[var(--tint)]", className].filter(Boolean).join(" ")}
      style={{
        backgroundImage: `repeating-linear-gradient(${angle}deg, transparent 0 9px, var(--hatch) 9px 10px)`,
      }}
    >
      {backs.map((back, index) => (
        <span
          key={index}
          className="card-back"
          style={{
            backgroundColor: gameColor,
            opacity: back.opacity,
            transform: `translate(-50%, -50%) translate(${back.shiftX}%, ${back.shiftY}%) rotate(${back.rotate}deg)`,
          }}
        />
      ))}
    </span>
  );
}
