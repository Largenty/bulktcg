import Link from "next/link";
import { GAME_IDS } from "@/types/game";
import { capitalize } from "@/lib/french";
import { gameColorVariable } from "@/lib/game-style";
import { gamePhrases } from "@/lib/labels";
import { routes } from "@/lib/routes";

const PLACES = [
  { href: routes.listings, label: "Toutes les annonces" },
  { href: routes.wantedListings, label: "Demandes de recherche" },
  { href: routes.deposit, label: "Déposer une annonce" },
];

/* De quoi repartir d'une page d'erreur : chaque jeu, les demandes, le dépôt.
   Une impasse qui ne propose qu'« Accueil » renvoie au début d'un chemin
   que le visiteur avait déjà fait — et la colonne d'à côté restait vide. */
export function WayOut() {
  return (
    <nav aria-labelledby="repartir-titre" className="panel flex flex-col gap-5">
      <h2 id="repartir-titre" className="label text-[var(--muted)]">
        Repartir d&apos;ici
      </h2>
      <ul className="grid list-none gap-1 sm:grid-cols-2">
        {GAME_IDS.map((gameId) => (
          <li key={gameId}>
            <Link
              href={routes.game(gameId)}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 font-semibold hover:bg-[var(--tint)]"
            >
              <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[var(--radius-sm)]" style={{ backgroundColor: gameColorVariable(gameId) }} />
              {capitalize(gamePhrases(gameId).cards)}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="flex list-none flex-col gap-1 border-t-[length:var(--border-width)] border-[var(--line)] pt-4">
        {PLACES.map((place) => (
          <li key={place.href}>
            <Link href={place.href} className="text-link inline-flex px-3 py-1.5">
              {place.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
