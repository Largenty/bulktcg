/* Ce que le film affirme, écrit une seule fois, daté et sourcé.

   Un chiffre de concurrent n'entre ici qu'avec sa source et la date du relevé :
   une publicité comparative doit pouvoir prouver chaque chiffre qu'elle montre
   (Code de la consommation, L122-1 et L122-5). Quand un tarif change, on
   corrige ici, on relit la page source, et on change la date — le film lit
   ses montants dans ce fichier et calcule le reste.

   Ce qui n'est pas vérifiable n'est pas dit : le film n'annonce ni nombre
   d'inscrits, ni nombre d'acheteurs, ni délai de vente. */

window.FILM_CONFIG = {
  /* Le domaine n'est pas encore choisi (todo.md : « bulktcg.fr est un
     exemple »). Tant qu'il vaut null, la carte de fin n'affiche aucune
     adresse plutôt qu'une adresse qui n'est pas la nôtre. Exemple :
     siteAddress: "bulktcg.fr". */
  siteAddress: null,

  checkedOn: "2026-10-04",

  /* Le lot de l'exemple : le carton du début du film. Trois mille cartes
     pèsent environ 5,4 kg (1,8 g la carte) : avec le carton, six kilos. */
  lot: {
    priceCents: 15000,
    weightKg: 6,
    cardCount: 3000,
  },

  /* Commission prélevée sur le vendeur, en part du prix de l'article. */
  marketplaces: [
    {
      id: "bulktcg",
      name: "BulkTCG",
      feeRate: 0,
      feeLabel: "Frais de vente",
      shipping: "Aucun envoi, remise en main propre",
      source: "Modèle du site : aucun paiement ne passe par BulkTCG, il n'y a rien sur quoi prélever.",
    },
    {
      id: "cardmarket",
      name: "Cardmarket",
      feeRate: 0.05,
      feeLabel: "Frais de vente",
      shipping: "Colis suivi obligatoire dès 25 €",
      source:
        "help.cardmarket.com/fr/SellingShipmentsFAQ : « Le paiement de la commande sera effectué, après application des frais de vente de 5 % ». help.cardmarket.com/fr/FAQ : « L'envoi suivi est obligatoire pour : Toutes les commandes supérieures à 25,00 € ».",
    },
    {
      id: "leboncoin",
      name: "Leboncoin",
      feeRate: 0,
      feeLabel: "Frais vendeur",
      shipping: "Main propre ou livraison, au choix",
      source:
        "assistance.leboncoin.info, « Vendeur particulier : combien coûte la Transaction sécurisée ? » : « La Transaction sécurisée est gratuite pour les vendeurs. »",
    },
  ],

  /* Le port qu'un acheteur ne paie pas quand le lot se remet en main propre :
     un colis de 6 kg tombe dans la tranche « jusqu'à 10 kg ». */
  postage: {
    carrier: "Colissimo",
    bracket: "jusqu'à 10 kg, livraison à domicile",
    priceCents: 2529,
    source: "laposte.fr/tarif-colissimo, tarifs en vigueur au 1er janvier 2026.",
  },
};
