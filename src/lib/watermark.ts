import type { Listing } from "@/types/listing";

/* Filigrane des photos d'annonce.

   Ce que ça fait : rendre le vol visible. Une photo qui porte le pseudo d'un
   autre vendeur est une photo reprise, et l'acheteur le voit sans rien avoir
   à vérifier.

   Ce que ça ne fait pas : protéger le fichier. Un recadrage suffit à couper
   le coin, et rien n'empêche de récupérer l'original ailleurs. Le filigrane
   est un signal de lecture, pas une protection technique.

   Décidé en octobre 2026 : c'est la ligne de crédit que la page pose sur la
   photo, et rien de plus. L'incruster dans l'image ne sera reconsidéré que
   si la reprise de photos devient un problème constaté ; les deux voies
   écartées (supabase/README.md, § 6) : un Worker devant la livraison, qui
   changerait le gabarit des adresses, la signature des photos privées et
   la CSP ; le navigateur avant l'envoi, qui ne porterait que le pseudo et
   qu'un envoi direct à l'API contournerait. */

type WatermarkOptions = {
  /* Sur une vignette de 252 px, la référence complète occupe 90 % de la
     largeur : ça devient un bandeau et non une marque. On ne garde alors
     que le pseudo, qui est la partie vérifiable — la référence reste
     lisible sur la fiche et sur la photo en grand. */
  isCompact?: boolean;
};

export function buildWatermarkLabel(
  listing: Pick<Listing, "reference" | "seller">,
  { isCompact = false }: WatermarkOptions = {},
): string {
  const handle = `@${listing.seller.username}`;
  return isCompact ? handle : `${listing.reference} · ${handle}`;
}
