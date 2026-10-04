type AvatarSize = "sm" | "md" | "lg";

const SIZE_STYLE: Record<AvatarSize, string> = {
  sm: "h-7 w-7 text-[length:var(--text-xs)]",
  md: "h-11 w-11 text-[length:var(--text-sm)]",
  lg: "h-[76px] w-[76px] text-[length:var(--text-xl)]",
};

type AvatarProps = {
  initials: string;
  size?: AvatarSize;
  /* Sur l'ardoise, la pastille passe à la craie : encre sur ardoise, elle
     disparaissait. */
  isInverse?: boolean;
};

/* Initiales et non photo : la photo de profil arrive avec le stockage. Le
   nom est toujours écrit à côté, d'où l'aria-hidden. */
export function Avatar({ initials, size = "md", isInverse = false }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        "mono inline-flex shrink-0 select-none items-center justify-center rounded-[var(--radius-sm)]",
        "font-semibold tracking-[0.02em]",
        isInverse ? "bg-[var(--chalk)] text-[var(--on-chalk)]" : "bg-[var(--ink)] text-[var(--on-ink)]",
        SIZE_STYLE[size],
      ].join(" ")}
    >
      {initials}
    </span>
  );
}
