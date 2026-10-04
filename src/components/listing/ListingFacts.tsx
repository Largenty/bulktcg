import type { ListingCardData } from "@/types/listing";
import {
  CONDITION_GRADE_MAX,
  getConditionGrade,
  getShortConditionLabel,
  getShortLanguageLabel,
  getVolumeLabel,
} from "@/lib/listing-display";

/* Les trois choses qu'un acheteur veut savoir avant d'ouvrir un lot :
   combien, dans quel état, dans quelle langue. Formes courtes — « NM »,
   « VF », « Multi » — mesurées pour tenir sans troncature, ce que
   npm run smoke vérifie au pixel. La jauge double l'état pour qui ne connaît
   pas les codes ; le code reste écrit à côté, la jauge n'est jamais seule. */
type FactsSource = Pick<ListingCardData, "cardCount" | "weightKg" | "lotType" | "condition" | "language">;

export function ListingFacts({ listing, className }: { listing: FactsSource; className?: string }) {
  const grade = getConditionGrade(listing);

  return (
    <dl className={className}>
      <div>
        <dt className="sr-only">Volume</dt>
        <dd>{getVolumeLabel(listing)}</dd>
      </div>
      <div>
        <dt className="sr-only">État</dt>
        <dd className="inline-flex items-center gap-1.5">
          {grade !== null ? <ConditionMeter grade={grade} /> : null}
          {getShortConditionLabel(listing)}
        </dd>
      </div>
      <div>
        <dt className="sr-only">Langue</dt>
        <dd>{getShortLanguageLabel(listing)}</dd>
      </div>
    </dl>
  );
}

function ConditionMeter({ grade }: { grade: number }) {
  return (
    <span aria-hidden="true" className="meter">
      {Array.from({ length: CONDITION_GRADE_MAX }, (_, index) => (
        <i key={index} data-on={index < grade ? "" : undefined} />
      ))}
    </span>
  );
}
