"use client";

import type Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { carriedMarketFragment, departFor } from "@/components/market/market-view";
import { IntentLink } from "@/components/ui/IntentLink";

type HashPreservingLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/* Un lien qui emporte l'onglet ouvert : passer de Pokémon à Magic sur
   l'onglet « Recherches » (#recherches) doit rester sur les recherches. Seul
   le fragment de la bascule voyage (voir carriedMarketFragment). Le lien
   reste un vrai <a href> rendu par le serveur — il se suit sans JavaScript,
   par un clavier comme par un robot — ; le script ne fait qu'ajouter le
   fragment. Un clic modifié (nouvel onglet) garde le comportement du
   navigateur.

   La page ne se précharge qu'à l'intention (IntentLink) : la rangée
   d'intercalaires, entière à l'écran, téléchargeait neuf pages de jeu en
   arrière-plan à chaque visite de l'accueil. */
export function HashPreservingLink({ href, onClick, ...props }: HashPreservingLinkProps) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    const hash = carriedMarketFragment();
    if (event.defaultPrevented || !hash || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.push(departFor(`${href}${hash}`), { scroll: false });
  }

  return <IntentLink href={href} onClick={handleClick} {...props} />;
}
