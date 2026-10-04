import Link from "next/link";
import type { GameId } from "@/types/game";
import { Icon } from "@/components/ui/Icon";
import { ProBadge } from "@/components/pro/ProBadge";
import { getProOnlyCountByGame } from "@/lib/data/listings";
import { withGame } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* Sous les résultats publics : combien d'autres lots existent, réservés aux
   pros. Un nombre, jamais un titre — et la porte vers l'espace pro, qui
   s'ouvre pour une boutique et explique le forfait aux autres. Sans cette
   ligne, une boutique ne saurait pas ce qu'elle manque ; avec un titre, le
   vendeur aurait perdu ce qu'il a choisi. */
export async function ReservedTeaser({ gameId }: { gameId?: GameId }) {
  const counts = await getProOnlyCountByGame();
  const count = gameId ? counts[gameId] : Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (count === 0) return null;

  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] p-4 text-[length:var(--text-md)]">
      <ProBadge />
      <span>
        {count > 1
          ? `${count} ${gameId ? withGame("autres lots", gameId) : "autres lots"} sont réservés aux professionnels.`
          : `Un ${gameId ? withGame("autre lot", gameId) : "autre lot"} est réservé aux professionnels.`}
      </span>
      <Link href={routes.proListings} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
        Espace pro
        <Icon name="arrowRight" size={16} />
      </Link>
    </p>
  );
}
