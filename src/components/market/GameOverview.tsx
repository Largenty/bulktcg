import type { Game } from "@/types/game";
import type { Listing } from "@/types/listing";
import { StatList } from "@/components/account/StatList";
import { formatCount, formatPrice } from "@/lib/format";
import { capitalize, countLabel } from "@/lib/french";
import { LOT_TYPE_LABELS, UNKNOWN_VALUE, gamePhrases } from "@/lib/labels";

type GameOverviewProps = {
  game: Game;
  /* Toutes les annonces du jeu, filtres non appliqués : ce texte décrit le
     marché, pas la recherche en cours. */
  listings: Listing[];
  cityCount: number;
  wantedCount: number;
};

/* Ce que la page d'un jeu a à dire au-delà de sa grille : le marché en
   chiffres, et le texte qui donne à /pokemon quelque chose à
   indexer qu'une liste filtrée n'a pas. Il vient après la grille — on vient
   chercher des lots, pas lire un paragraphe. */
export function GameOverview({ game, listings, cityCount, wantedCount }: GameOverviewProps) {
  const prices = listings.map((listing) => listing.priceCents);
  const lotTypes = [...new Set(listings.map((listing) => listing.lotType))];

  return (
    <section className="mt-[var(--section-gap)] grid gap-8 border-t-[length:var(--border-width)] border-[var(--line)] pt-10 lg:grid-cols-[1fr_1fr] lg:gap-14">
      <div>
        <p className="label text-[var(--muted)]">Le marché</p>
        <h2 className="display display-h3 mt-2">{capitalize(gamePhrases(game.id).cards)} en main propre</h2>
        <div className="mt-4 flex flex-col gap-3 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
          <p>
            Le classeur entier, le carton de vrac, le deck monté, le display scellé. Pas la carte à
            l&apos;unité : pour ça, Cardmarket fait déjà très bien le travail. Ici tout se récupère
            en main propre, sans envoi postal.
          </p>
          {listings.length > 0 ? (
            <p>
              Formats représentés en ce moment :{" "}
              {lotTypes.map((lotType) => LOT_TYPE_LABELS[lotType].toLowerCase()).join(", ")}.
            </p>
          ) : null}
          {wantedCount > 0 ? (
            <p>
              En face, {countLabel(wantedCount, "personne")} {wantedCount > 1 ? "cherchent" : "cherche"}{" "}
              {gamePhrases(game.id).some} et {wantedCount > 1 ? "ont dit" : "a dit"} jusqu&apos;où{" "}
              {wantedCount > 1 ? "elles se déplacent" : "elle se déplace"} : l&apos;onglet Recherches les montre.
            </p>
          ) : null}
        </div>
      </div>
      <StatList
        stats={[
          { label: "Lots en ligne", value: formatCount(listings.length) },
          {
            label: "Fourchette de prix",
            value:
              prices.length > 0
                ? `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`
                : UNKNOWN_VALUE,
          },
          { label: "Villes", value: formatCount(cityCount) },
          { label: "Acheteurs en recherche", value: formatCount(wantedCount) },
        ]}
      />
    </section>
  );
}
