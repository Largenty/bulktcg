import Link from "next/link";
import type { City, CityResolution } from "@/lib/city-label";
import { formatCityLabel } from "@/lib/city-label";
import { Icon } from "@/components/ui/Icon";
import { QUERY_PARAM, buildListingHref } from "@/lib/listing-query";
import type { SearchParams } from "@/lib/search-params";

type CityNoticeProps = {
  resolution: CityResolution | null;
  basePath: string;
  params: SearchParams;
};

/* Ce que la saisie « Où » est devenue, quand il faut le dire. Une ville que
   le référentiel ne connaît pas ne filtre rien — la liste reste pleine — et
   on le dit, avec des pistes : taper « 84000 » rendait zéro résultat. Un nom
   que portent plusieurs communes cherche autour de l'une d'elles, et propose
   les autres : trois communes s'appellent Valence. */
export function CityNotice({ resolution, basePath, params }: CityNoticeProps) {
  if (!resolution) return null;
  if (resolution.status === "found") {
    if (resolution.homonyms.length === 0) return null;
    return (
      <Notice>
        <p>
          Plusieurs communes s&apos;appellent <strong className="font-semibold">{resolution.city.name}</strong> : la liste
          est centrée sur {resolution.city.name} ({resolution.city.postalCode}, {resolution.city.departmentName}).
        </p>
        <CityLinks label="Une autre ?" cities={resolution.homonyms.slice(0, 6)} basePath={basePath} params={params} withDepartment />
      </Notice>
    );
  }

  return (
    <Notice>
      <p>
        <strong className="font-semibold">« {resolution.input} »</strong> n&apos;est pas une commune que nous
        connaissons : la liste n&apos;est pas filtrée par ville.
      </p>
      {resolution.suggestions.length > 0 ? (
        <CityLinks label="Vouliez-vous dire" cities={resolution.suggestions} basePath={basePath} params={params} />
      ) : (
        <p className="mt-1.5 text-[var(--ink-soft)]">Essayez le nom de la commune la plus proche.</p>
      )}
    </Notice>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="notice notice-warn mb-5 flex gap-3">
      <Icon name="info" size={20} className="mt-0.5 shrink-0 text-[var(--status-reserved)]" />
      <div className="min-w-0 text-[length:var(--text-md)] leading-relaxed">{children}</div>
    </div>
  );
}

/* Chaque piste est un lien, qui marche sans JavaScript. Elle porte
   « Nom (code) » : le nom seul retomberait sur la même commune. */
function CityLinks({
  label,
  cities,
  basePath,
  params,
  withDepartment = false,
}: {
  label: string;
  cities: City[];
  basePath: string;
  params: SearchParams;
  withDepartment?: boolean;
}) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-[var(--ink-soft)]">{label}</span>
      {cities.map((city) => (
        <Link
          key={`${city.communeCode}-${city.postalCode}`}
          href={buildListingHref(basePath, params, { [QUERY_PARAM.city]: formatCityLabel(city), [QUERY_PARAM.radius]: null })}
          className="text-link"
        >
          {withDepartment ? `${formatCityLabel(city)} · ${city.departmentName}` : formatCityLabel(city)}
        </Link>
      ))}
    </p>
  );
}
