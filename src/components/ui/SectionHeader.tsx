import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  linkHref?: string;
  linkLabel?: string;
  /* « lg » sur une page publique, où le titre de section porte le rythme
     vertical. « md » dans le compte, où le pseudo tient déjà le rang de
     titre : deux titres à la taille d'un h1 se disputeraient l'écran. */
  size?: "lg" | "md";
  /* Le niveau de titre suit la page, pas la taille : sur une fiche, les
     sections sont des h2 ; sous un h2 de compte, des h3. */
  level?: "h2" | "h3";
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  linkHref,
  linkLabel,
  size = "lg",
  level = "h2",
}: SectionHeaderProps) {
  const Heading = level;

  return (
    <div
      className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${size === "lg" ? "mb-8" : "mb-5"}`}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-3 text-[var(--muted)]">{eyebrow}</p> : null}
        <Heading className={`display ${size === "lg" ? "display-h2" : "display-h3"}`}>{title}</Heading>
        {description ? (
          <p
            className={`text-[var(--ink-soft)] ${size === "lg" ? "mt-3 text-[length:var(--text-body)]" : "mt-2 text-[length:var(--text-md)]"}`}
          >
            {description}
          </p>
        ) : null}
      </div>
      {linkHref && linkLabel ? (
        <Link
          href={linkHref}
          className="group inline-flex shrink-0 items-center gap-1.5 text-[length:var(--text-md)] font-semibold"
        >
          <span className="text-link">{linkLabel}</span>
          <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}
