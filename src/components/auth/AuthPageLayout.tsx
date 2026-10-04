import type { ReactNode } from "react";

type AuthPageLayoutProps = {
  title: string;
  /* Le formulaire de la page : connexion, inscription, mot de passe oublié
     ou nouveau mot de passe. */
  form: ReactNode;
  /* Le texte sous le titre : ce que le compte permet, ce qui sera public. */
  children: ReactNode;
};

/* Les pages du compte : le texte à gauche, le formulaire à droite. */
export function AuthPageLayout({ title, form, children }: AuthPageLayoutProps) {
  return (
    <div className="container pb-[var(--section-gap)] pt-8 lg:pt-14">
      {/* Toute la largeur : le texte prend ce que le formulaire laisse, le
          formulaire garde une largeur de formulaire. Bridée à 1 040 px, la
          page laissait vide un tiers d'un grand écran. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:items-start lg:gap-16">
        <div>
          <p className="eyebrow text-[var(--muted)]">Votre compte</p>
          <h1 className="display display-h2 mt-3">{title}</h1>
          {children}
        </div>

        {form}
      </div>
    </div>
  );
}
