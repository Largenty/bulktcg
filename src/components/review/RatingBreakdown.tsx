import { formatRating } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { REVIEW_CRITERION_DEFINITIONS, REVIEW_CRITERION_LABELS } from "@/lib/labels";
import { REVIEW_CRITERIA, type RatingBreakdown as Breakdown } from "@/types/review";

type RatingBreakdownProps = {
  ratingAvg: number | null;
  ratingCount: number;
  breakdown: Breakdown;
};

/* La note, et ce qu'elle veut dire. Une moyenne seule ne dit pas ce qui
   s'est mal passé ; trois critères le disent, et leur définition est écrite
   à côté — une note dont on ignore le calcul ne vaut pas mieux qu'une
   étoile décorative. Sans avis, chaque critère s'affiche « — », jamais 0. */
export function RatingBreakdown({ ratingAvg, ratingCount, breakdown }: RatingBreakdownProps) {
  return (
    <div className="panel grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10">
      <div>
        <p className="label text-[var(--muted)]">Note globale</p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="price text-[length:var(--number-xl)]">{formatRating(ratingAvg)}</span>
          <span className="mono text-[length:var(--text-md)] text-[var(--muted)]">/ 5</span>
        </p>
        <p className="mt-1 text-[length:var(--text-sm)] text-[var(--muted)]">
          {ratingCount === 0 ? "Pas encore d'avis" : `sur ${countLabel(ratingCount, "avis", "avis")}`}
        </p>
      </div>

      <dl className="flex flex-col gap-4">
        {REVIEW_CRITERIA.map((criterion) => {
          const value = breakdown[criterion];
          return (
            <div key={criterion} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5">
              <dt className="text-[length:var(--text-md)] font-semibold">{REVIEW_CRITERION_LABELS[criterion]}</dt>
              <dd className="mono text-[length:var(--text-md)] font-semibold">{formatRating(value)}</dd>
              <dd className="col-span-2 text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
                {REVIEW_CRITERION_DEFINITIONS[criterion]}
              </dd>
              {value !== null ? (
                <dd aria-hidden="true" className="col-span-2">
                  <span className="score-bar">
                    <span style={{ width: `${(value / 5) * 100}%` }} />
                  </span>
                </dd>
              ) : null}
            </div>
          );
        })}
      </dl>

      <p className="border-t-[length:var(--border-width)] border-[var(--line)] pt-4 text-[length:var(--text-sm)] leading-relaxed text-[var(--ink-soft)] md:col-span-2">
        Seul le vendeur clôture une vente ; les deux parties se notent ensuite l&apos;une l&apos;autre, une seule fois,
        de 1 à 5 sur ces trois critères. La note globale est la moyenne des trois. Un simple message n&apos;ouvre pas
        d&apos;avis : il faut une vente conclue.
      </p>
    </div>
  );
}
