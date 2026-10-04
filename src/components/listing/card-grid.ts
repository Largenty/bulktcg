/* La grille des vignettes — lots comme demandes : une liste sur téléphone,
   puis autant de colonnes que la largeur en tient. */
export type GridDensity = "comfortable" | "compact";

/* Des colonnes plus étroites quand la grille partage la largeur avec un
   panneau de filtres. */
export function cardGridClassName(density: GridDensity): string {
  return `grid list-none gap-3 sm:gap-x-5 sm:gap-y-7 ${
    density === "compact"
      ? "sm:[grid-template-columns:repeat(auto-fill,minmax(236px,1fr))]"
      : "sm:[grid-template-columns:repeat(auto-fill,minmax(256px,1fr))]"
  }`;
}
