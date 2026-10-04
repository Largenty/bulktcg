import type { GameId } from "@/types/game";
import { SearchBar } from "@/components/search/SearchBar";
import { ButtonLink } from "@/components/ui/Button";
import { QUERY_PARAM, gameParamValue } from "@/lib/listing-query";
import { routes } from "@/lib/routes";

/* Sous le titre de /recherches : « Vous vendez depuis » — qui viendrait
   jusqu'à moi —, et les deux gestes de la page, déposer sa demande ou le lot
   qu'on a sous la main. */
export function WantedToolbar({ gameId, city, cities }: { gameId?: GameId; city?: string; cities: string[] }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,560px)_auto] lg:items-end lg:justify-between">
      <SearchBar
        action={routes.wantedListings}
        label="Chercher qui viendrait jusqu'à moi"
        submitLabel="Qui vient jusqu'à moi"
        hidden={{ [QUERY_PARAM.game]: gameId && gameParamValue(gameId) }}
        fields={[
          {
            id: "recherche-depuis",
            name: QUERY_PARAM.city,
            label: "Vous vendez depuis",
            placeholder: "Ville ou code postal",
            defaultValue: city,
            autoComplete: "address-level2",
            options: cities,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2.5">
        <ButtonLink href={routes.depositWanted} size="sm">
          Déposer une recherche
        </ButtonLink>
        <ButtonLink href={routes.deposit} variant="secondary" size="sm">
          J&apos;ai un lot à vendre
        </ButtonLink>
      </div>
    </div>
  );
}
