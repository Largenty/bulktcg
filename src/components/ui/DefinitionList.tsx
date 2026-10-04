import { UNKNOWN_VALUE } from "@/lib/labels";

export type DefinitionRow = {
  label: string;
  /* Déjà formatée par lib/format : un composant n'invente pas un affichage
     de montant, et « — » doit pouvoir passer là où un nombre passerait. */
  value: string;
  /* L'instant ISO d'une valeur qui est une date : elle est alors posée dans
     un <time>, lisible par une machine autant que par un humain. */
  dateTime?: string;
  /* Affichée seulement quand la valeur est absente : « — Non compté par le
     vendeur » plutôt qu'un zéro qui serait faux. */
  note?: string;
};

type DefinitionListProps = {
  rows: DefinitionRow[];
  className?: string;
  columns?: 2 | 3;
  /* Deux colonnes dès le téléphone, pour des valeurs courtes : six critères
     d'une ligne chacun ne méritent pas six écrans de défilement. */
  isCompact?: boolean;
};

/* Les caractéristiques d'un lot, les critères d'une demande, le
   récapitulatif d'un dépôt : une seule grille d'étiquettes et de valeurs. */
export function DefinitionList({ rows, className, columns = 2, isCompact = false }: DefinitionListProps) {
  return (
    <dl
      className={[
        isCompact ? "grid grid-cols-2 gap-x-5 sm:gap-x-8" : "grid gap-x-8 sm:grid-cols-2",
        columns === 3 ? "lg:grid-cols-3" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {rows.map((row) => (
        <div key={row.label} className="border-b-[length:var(--border-width)] border-[var(--line)] py-3">
          <dt className="label text-[var(--muted)]">{row.label}</dt>
          <dd className="mt-1 text-[length:var(--text-lg)] font-semibold">
            {row.dateTime ? <time dateTime={row.dateTime}>{row.value}</time> : row.value}
            {row.value === UNKNOWN_VALUE && row.note ? (
              <span className="ml-2 text-[length:var(--text-sm)] font-normal text-[var(--muted)]">
                {row.note}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
