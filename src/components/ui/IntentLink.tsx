"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/* Un lien qui ne précharge sa page qu'à l'intention : le survol, le doigt
   posé, le focus au clavier.

   Par défaut, Next précharge chaque lien qui entre à l'écran : les neuf
   intercalaires, les vignettes d'une grille — autant de pages téléchargées
   en arrière-plan, sur un forfait mobile, pour une seule qu'on ouvrira, et
   en phase 2 autant de requêtes à la base. Le survol précède le clic de 100 à
   300 ms : assez pour que la page soit prête quand on clique. C'est le motif
   que recommande la documentation de Next (guides/prefetching.md). */
export function IntentLink({ prefetch, onMouseEnter, onTouchStart, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [hasIntent, setHasIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={hasIntent ? (prefetch ?? "auto") : false}
      onMouseEnter={(event) => {
        setHasIntent(true);
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        setHasIntent(true);
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        setHasIntent(true);
        onFocus?.(event);
      }}
    />
  );
}
