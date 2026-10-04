import { formatCount, formatRating } from "@/lib/format";

type RatingProps = {
  ratingAvg: number | null;
  ratingCount: number;
  size?: "sm" | "md";
  /* Sur l'ardoise, les chiffres passent à la craie. */
  isInverse?: boolean;
};

/* Un vendeur sans avis n'a pas une note de zéro : il n'a pas de note. On le
   dit, sans étoile vide qui ressemblerait à un 0/5.
   Une seule étoile et le chiffre, plutôt que cinq étoiles à compter : c'est
   la note qu'on lit, pas la forme. */
export function Rating({ ratingAvg, ratingCount, size = "sm", isInverse = false }: RatingProps) {
  const numberColor = isInverse ? "text-[var(--chalk)]" : "text-[var(--ink)]";
  const mutedColor = isInverse ? "text-[var(--chalk-muted)]" : "text-[var(--muted)]";
  const textSize = size === "md" ? "text-[length:var(--text-md)]" : "text-[length:var(--text-sm)]";

  if (ratingAvg === null || ratingCount === 0) {
    return <span className={`${textSize} ${mutedColor}`}>Pas encore d&apos;avis</span>;
  }

  return (
    <span
      role="img"
      aria-label={`Note de ${formatRating(ratingAvg)} sur 5, ${formatCount(ratingCount)} avis`}
      className={`inline-flex items-center gap-1 ${textSize}`}
    >
      <svg
        width={size === "md" ? 16 : 14}
        height={size === "md" ? 16 : 14}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        className="text-[var(--pokemon)]"
      >
        <path
          d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"
          fill="currentColor"
          stroke="var(--ink)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span aria-hidden="true" className={`mono font-semibold ${numberColor}`}>
        {formatRating(ratingAvg)}
      </span>
      <span aria-hidden="true" className={`mono ${mutedColor}`}>
        ({formatCount(ratingCount)})
      </span>
    </span>
  );
}
