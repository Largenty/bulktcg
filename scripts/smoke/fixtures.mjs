/* Les données que plusieurs domaines partagent : la photo des parcours de
   dépôt et les annonces de référence de la démonstration. */

/* Une photo minuscule mais valide, pour les parcours de dépôt : l'annonce
   exige au moins une photo, et le sélecteur l'accepte comme n'importe quel
   PNG. */
export const PHOTO = {
  name: "lot.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};

/* Une annonce d'un autre vendeur : le compte de démonstration y voit le
   bouton de contact, pas ses outils de vendeur. */
export const LISTING_OF_OTHER = "classeur-one-piece-complet-op-01-a-op-04-l-isle-sur-la-sorgue-14";

/* L'annonce du compte de démonstration, modifiable depuis son compte. C'est
   aussi la fiche des parcours sur les photos : une galerie de six vues, et
   les crédits des photographes. */
export const OWN_LISTING = "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01";

/* L'annonce que le compte de démonstration a vendue à u-02, qui l'a notée :
   figée par la vente clôturée, elle ne se modifie plus. */
export const SOLD_WITH_DEAL = "display-scelle-ecarlate-et-violet-151-avignon-07";
