import { createElement } from "react";

/* next/image a besoin du runtime Next (optimiseur, manifeste des tailles).
   Les tests de composants portent sur notre logique, pas sur celle de Next :
   le stub rend une <img> avec les mêmes attributs observables. `preload`,
   qui remplace `priority` depuis Next 16, n'est pas un attribut d'<img> :
   Next en fait un <link> dans l'en-tête, le stub une marque lisible. */
export default function Image({ src, alt, sizes, preload, className, fill, ...rest }) {
  return createElement("img", {
    src: typeof src === "string" ? src : (src?.src ?? ""),
    alt,
    sizes,
    className,
    "data-fill": fill ? "true" : undefined,
    "data-preload": preload ? "true" : undefined,
    ...rest,
  });
}
