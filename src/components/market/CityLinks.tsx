import type { GameId } from "@/types/game";
import { PillList } from "@/components/ui/PillList";
import { routes } from "@/lib/routes";

type CityLinksProps = {
  gameId: GameId;
  title: string;
  /* Le slug de la page de la commune et son nom affiché (lib/seo.ts,
     getPopulatedCities). */
  cities: ReadonlyArray<{ slug: string; label: string }>;
};

/* Les liens qui mènent aux pages jeu × ville. Sans eux, ces pages ne
   seraient plus atteignables que par le plan de site et le pied de page, ce
   qui reviendrait à les publier sans les relier à rien. */
export function CityLinks({ gameId, title, cities }: CityLinksProps) {
  if (cities.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="label mb-3 text-[var(--muted)]">{title}</h2>
      <PillList items={cities.map((city) => ({ href: routes.gameCity(gameId, city.slug), label: city.label }))} />
    </section>
  );
}
