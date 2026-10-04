const STEPS = [
  {
    title: "Le vendeur réserve son lot aux pros",
    text: "Au dépôt, il choisit « Professionnels uniquement ». C'est souvent un carton de succession, une collection entière, un stock de scellé : il veut vendre vite, en une fois, à quelqu'un qui connaît les prix.",
  },
  {
    title: "Seuls les pros au forfait le voient",
    text: "L'annonce n'apparaît ni dans la recherche publique, ni sur les pages de jeu, ni sur Google. Elle arrive dans l'espace pro, et son lien répond « introuvable » à tous les autres.",
  },
  {
    title: "Le reste se passe comme d'habitude",
    text: "Vous écrivez au vendeur depuis l'annonce, vous convenez d'un rendez-vous, vous vérifiez le lot et vous payez sur place. Le site ne touche jamais à l'argent de la vente.",
  },
];

/* Le mécanisme en trois temps, du point de vue de la boutique. Numérotés :
   c'est un ordre, pas une liste d'avantages. */
export function ProSteps() {
  return (
    <ol className="grid list-none gap-4 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.title} className="panel flex flex-col gap-3">
          <span className="price text-[length:var(--number-xl)] font-bold leading-none text-[var(--muted)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-[length:var(--text-lg)] font-semibold leading-snug">{step.title}</h3>
          <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
