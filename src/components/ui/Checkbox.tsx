import type { ComponentPropsWithoutRef, ReactNode } from "react";

/* `size` est omis des props natives : l'attribut HTML du même nom attend un
   nombre de caractères et n'a aucun sens sur une case à cocher. */
type CheckboxProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "id" | "className" | "size"
> & {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  /* « sm » dans une liste à cocher longue ; « md » pour une case isolée,
     qui porte une décision à elle seule. */
  size?: "sm" | "md";
};

/* Case à cocher maison. L'<input> natif reste là — c'est lui qui porte
   l'état, le clavier, la validation et la soumission — mais il est rendu
   invisible et remplacé par un carré dessiné : la case système ignore le
   CSS. */
export function Checkbox({ id, label, description, size = "md", ...rest }: CheckboxProps) {
  const isSmall = size === "sm";

  return (
    <label
      htmlFor={id}
      className={`group flex cursor-pointer items-start rounded-[var(--radius-sm)] ${isSmall ? "gap-2.5 py-1" : "gap-3"}`}
    >
      <input id={id} name={rest.name ?? id} type="checkbox" className="peer sr-only" {...rest} />
      <span
        aria-hidden="true"
        className={[
          isSmall ? "mt-0.5 h-5 w-5 rounded-[var(--radius-sm)]" : "mt-0.5 h-6 w-6 rounded-[var(--radius-sm)]",
          "grid shrink-0 place-items-center border-[length:var(--border-width-strong)] border-[var(--line-strong)] bg-[var(--card)] text-[var(--on-ink)]",
          "transition-[background-color,border-color] duration-100",
          "group-hover:border-[var(--ink)]",
          "peer-checked:border-[var(--ink)] peer-checked:bg-[var(--ink)]",
          "peer-focus-visible:outline peer-focus-visible:outline-[3px]",
          "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)]",
          /* peer-checked ne descend pas jusqu'au SVG : on vise l'enfant
             explicitement depuis le carré, qui est bien le frère du peer. */
          "[&>svg]:scale-50 [&>svg]:opacity-0",
          "peer-checked:[&>svg]:scale-100 peer-checked:[&>svg]:opacity-100",
        ].join(" ")}
      >
        <svg
          width={isSmall ? 13 : 15}
          height={isSmall ? 13 : 15}
          viewBox="0 0 24 24"
          className="transition-[transform,opacity] duration-100"
        >
          <path
            d="M4.5 12.5l5 5 10-11"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0">
        <span
          className={
            isSmall
              ? "block text-[length:var(--text-md)] leading-snug"
              : "block text-[length:var(--text-lg)] font-semibold leading-snug"
          }
        >
          {label}
        </span>
        {description ? (
          <span
            className={
              isSmall
                ? "mt-0.5 block text-[length:var(--text-xs)] leading-snug text-[var(--muted)]"
                : "mt-1 block text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]"
            }
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
