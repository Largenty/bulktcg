import type { Game } from "@/types/game";
import { IntentLink } from "@/components/ui/IntentLink";
import type { City } from "@/lib/cities";
import { atCity, fromCity } from "@/lib/french";
import { withGame } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* Après les lots, le texte d'une page de ville — fourchette de prix,
   formats, rendez-vous — et les communes d'à côté (lib/seo.ts,
   getNearbyCities). Il occupait le haut de la page : sur téléphone, la
   première annonce arrivait à 740 px. */
export function CityMarket({ game, city, details, nearbyCities }: { game: Game; city: City; details: string[]; nearbyCities: City[] }) {
  return (
    <>
      {details.length > 0 ? (
        <section className="mt-[var(--section-gap)] grid gap-6 border-t-[length:var(--border-width)] border-[var(--line)] pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
          <h2 className="display display-h3">
            {withGame("Le marché", game.id)} {atCity(city.name)}
          </h2>
          {/* Le texte prend sa colonne ; en très grand écran il s'y range sur
              deux colonnes plutôt que d'être bridé à 72 caractères. */}
          <div className="gap-12 xl:columns-2">
            {details.map((paragraph) => (
              <p key={paragraph.slice(0, 30)} className="mb-3 break-inside-avoid text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {nearbyCities.length > 0 ? (
        <section className="mt-10">
          <h2 className="label mb-3 text-[var(--muted)]">Autour {fromCity(city.name)}</h2>
          <ul className="flex list-none flex-wrap gap-2.5">
            {nearbyCities.map((nearby) => (
              <li key={nearby.slug}>
                <IntentLink href={routes.gameCity(game.id, nearby.slug)} className="pill pill-sm">
                  {nearby.name}
                  <span className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{nearby.departmentCode}</span>
                </IntentLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
