"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { carriedMarketFragment } from "@/components/market/market-view";
import { QUERY_PARAM } from "@/lib/listing-query";
import { WANTED_PARAM } from "@/lib/wanted-query";

/* Les filtres vivent dans l'URL, pas dans un useState : une recherche se
   partage, et le bouton retour du navigateur redevient utile.
   push et non replace : sur un site d'annonces, revenir en arrière doit
   défaire le dernier filtre, pas quitter la liste.
   Changer un critère repart de la page 1 : la page 3 d'une liste qui n'en
   compte plus qu'une serait un écran vide.
   Le fragment de l'onglet suit : sur /annonces, #recherches porte l'onglet
   ouvert, et filtrer les demandes ne doit pas ramener sur les ventes. Aucun
   autre ne suit : #contenu, posé par le lien d'évitement, n'a rien à faire
   dans l'adresse d'une liste filtrée. */
export function useListingFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  function getValue(key: string): string | null {
    return searchParams.get(key);
  }

  function navigate(next: URLSearchParams) {
    next.delete(QUERY_PARAM.page);
    next.delete(WANTED_PARAM.page);
    const queryString = next.toString();
    const hash = carriedMarketFragment();
    router.push(`${queryString ? `${pathname}?${queryString}` : pathname}${hash}`, { scroll: false });
  }

  /* Plusieurs paramètres d'un coup, en une seule entrée d'historique : un
     budget min et max se règlent ensemble et se défont ensemble. */
  function setValues(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    navigate(next);
  }

  function setValue(key: string, value: string | null) {
    setValues({ [key]: value });
  }

  /* `keep` existe parce que tout ce qui est dans l'URL n'est pas un
     critère à effacer : le jeu porte le titre de la page et sa balise
     canonique, la recherche textuelle et la ville ont été tapées dans la
     barre du haut, pas choisies dans le panneau. */
  function clearAll(keep: string[] = []) {
    const next = new URLSearchParams();
    for (const key of keep) {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    }
    navigate(next);
  }

  /* N'efface que ces critères-là : sur /annonces, « Tout effacer » côté
     recherches ne doit pas vider les filtres des ventes, qui vivent dans la
     même URL. */
  function clearKeys(keys: readonly string[]) {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of keys) next.delete(key);
    navigate(next);
  }

  return { getValue, setValue, setValues, clearAll, clearKeys };
}
