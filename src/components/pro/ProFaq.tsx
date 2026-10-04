import { SITE_NAME } from "@/lib/site";

const QUESTIONS = [
  {
    question: "Qui peut souscrire ?",
    answer:
      "Un compte professionnel : boutique de jeux, dépôt-vente, revendeur. Le statut se déclare d'abord, gratuitement, dans Paramètres : le SIRET de l'établissement y est vérifié aussitôt auprès du répertoire des entreprises, et le badge Pro et l'enseigne s'affichent à côté du pseudo. Le forfait s'y ajoute pour voir les lots réservés.",
  },
  {
    question: "Un particulier peut-il voir les lots réservés ?",
    answer:
      "Non. C'est tout l'intérêt pour le vendeur : son lot ne circule pas, il ne reçoit pas trente messages, et il traite avec quelqu'un dont c'est le métier.",
  },
  {
    question: "Que se passe-t-il si le forfait n'est pas renouvelé ?",
    answer:
      "Les lots réservés disparaissent de votre vue. Le badge Pro, l'enseigne et la fiche boutique restent : vous êtes toujours un professionnel, et vos acheteurs doivent le savoir. Vos annonces, vos demandes et vos conversations restent aussi.",
  },
  {
    question: `Le paiement d'un lot passe-t-il par ${SITE_NAME} ?`,
    answer:
      "Non, comme pour toutes les annonces : vous payez le vendeur en main propre, au rendez-vous. Le forfait est le seul paiement fait au site.",
  },
];

/* Les questions qu'une boutique pose avant de payer, avec des réponses qui
   décrivent ce que fait le site — rien qu'il ne ferait pas. */
export function ProFaq() {
  return (
    <div className="flex flex-col divide-y-[length:var(--border-width)] divide-[var(--line)] border-y-[length:var(--border-width)] border-[var(--line)]">
      {QUESTIONS.map((item) => (
        <details key={item.question} className="group py-1">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 text-[length:var(--text-lg)] font-semibold">
            {item.question}
            <span aria-hidden="true" className="text-[var(--muted)] transition-transform group-open:rotate-45">
              +
            </span>
          </summary>
          <p className="pb-5 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
