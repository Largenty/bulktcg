/* Les trois critères d'un avis, dans l'ordre où le formulaire les pose. Une
   note unique ne disait pas ce qui s'était mal passé : un vendeur en retard
   et un lot moins rempli qu'annoncé ne sont pas le même reproche. */
export const REVIEW_CRITERIA = ["punctuality", "responsiveness", "reliability"] as const;

export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];

export type ReviewScores = Record<ReviewCriterion, number>;

/* La note d'un compte, critère par critère : null tant qu'aucun avis
   n'existe, jamais 0. */
export type RatingBreakdown = Record<ReviewCriterion, number | null>;

/* Le rôle de la personne notée dans la vente. Les critères sont les mêmes,
   la fiabilité n'y veut pas dire la même chose : un lot conforme à
   l'annonce, ou un prix tenu sans renégocier sur place. */
export const REVIEW_ROLES = ["seller", "buyer"] as const;
export type ReviewRole = (typeof REVIEW_ROLES)[number];

/* L'annonce sur laquelle porte un avis : son lien quand on peut la lire ;
   sinon pourquoi on ne le peut pas. Réservée aux pros, son titre ne sort pas
   du cercle, même dans un avis ; supprimée avec le compte de son vendeur,
   l'avis reste. */
export type ReviewListing = { slug: string; title: string } | { unavailable: "pro-only" | "deleted" };

export type Review = {
  id: string;
  /* null quand la vente a disparu avec le compte de l'une des parties. */
  dealId: string | null;
  /* Les trois null quand l'auteur a supprimé son compte : l'avis reste à
     la personne notée, signé « Compte supprimé », sans lien de profil. */
  reviewerId: string | null;
  reviewerUsername: string | null;
  reviewerInitials: string | null;
  reviewedId: string;
  reviewedRole: ReviewRole;
  scores: ReviewScores;
  /* La moyenne des trois critères, à une décimale. */
  rating: number;
  comment: string | null;
  createdAt: string;
  listing: ReviewListing;
};
