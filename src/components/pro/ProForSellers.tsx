import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { routes } from "@/lib/routes";

const REASONS = [
  { title: "Vendre en une fois", text: "Un seul acheteur pour tout le carton, au lieu de trente messages et de rendez-vous manqués." },
  { title: "Sans exposer le lot", text: "Ni la recherche publique, ni Google, ni les voisins : seules les boutiques au forfait voient l'annonce." },
  { title: "Face à quelqu'un qui connaît les prix", text: "Une boutique estime un lot sur place et paie comptant. Vous comparez les offres, vous choisissez." },
];

/* L'autre moitié de l'offre : ce que le particulier y gagne. Sans vendeurs
   qui réservent leur lot, le forfait n'ouvre rien — la section parle donc
   aux deux, sur la même page. */
export function ProForSellers() {
  return (
    <div className="on-slate rounded-[var(--radius-xl)] p-6 sm:p-10">
      <p className="label text-[var(--chalk-muted)]">Côté particuliers</p>
      <h2 className="display display-h2 mt-3">Vous vendez ? Réservez votre lot aux boutiques.</h2>
      <ul className="mt-8 grid list-none gap-6 md:grid-cols-3">
        {REASONS.map((reason) => (
          <li key={reason.title} className="flex flex-col gap-2 border-t-[length:var(--border-width)] border-[var(--slate-line)] pt-4">
            <span className="font-semibold">{reason.title}</span>
            <span className="text-[length:var(--text-md)] leading-relaxed text-[var(--chalk-soft)]">{reason.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ButtonLink href={routes.deposit} variant="inverse" size="lg">
          <Icon name="plus" size={18} strokeWidth={2.4} />
          Déposer un lot
        </ButtonLink>
        <p className="text-[length:var(--text-sm)] text-[var(--chalk-soft)]">
          Le choix se fait à la dernière étape du dépôt, et se change à tout moment sans que le lien bouge.
        </p>
      </div>
    </div>
  );
}
