import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tranche } from "@/components/layout/Tranche";
import { routes } from "@/lib/routes";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const EXAMPLE_SLUG = "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01";

const STEPS = [
  {
    title: "Vous écrivez l'annonce une fois",
    body: "Photos, état réel, langue, volume, prix. Dix minutes, et c'est fait pour de bon.",
  },
  {
    title: "Vous collez le lien où vous voulez",
    body: "Groupes Facebook, Discord, forums, messages privés. Le lien ne change jamais, même si vous modifiez le texte ou le prix.",
  },
  {
    title: "Vous changez le statut en un clic",
    body: "Réservé, puis vendu. Plus besoin de reposter nulle part, ni de répondre vingt fois à « toujours dispo ? ».",
  },
];

/* La promesse vendeur, en ardoise : c'est la seule section de la page qui
   explique le produit plutôt que de le montrer, et la seule qui parle à
   quelqu'un qui n'est pas venu acheter. Elle porte donc aussi l'appel au
   dépôt : l'accueil en avait deux, l'un sous l'autre, qui disaient la même
   chose avec des mots différents. */
export function PermalinkSection() {
  const exampleUrl = `${SITE_URL}${routes.listing(EXAMPLE_SLUG)}`;

  return (
    <section className="on-slate">
      <Tranche />
      {/* Une piste explicite dès le mobile : sans elle, la colonne implicite
          prenait la largeur minimale du lien d'exemple (817 px, sans retour à
          la ligne) et l'accueil débordait de 610 px sur un téléphone. */}
      <div className="container grid grid-cols-[minmax(0,1fr)] gap-10 py-[var(--section-gap)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-14">
        <div>
          <p className="label text-[var(--chalk-muted)]">Le lien permanent</p>
          <h2 className="display display-h2 mt-4">
            Une annonce.
            <br />
            Un lien.
            <br />
            Pour toujours.
          </h2>
          <p className="lead mt-6 text-[var(--chalk-soft)]">
            Facebook reste votre audience. {SITE_NAME} est la couche annonce en dessous :
            l&apos;endroit où l&apos;information est à jour, tout le temps, sans que vous ayez à la
            republier.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href={routes.deposit} variant="inverse" size="lg">
              <Icon name="plus" size={18} />
              Déposer une annonce
            </ButtonLink>
            <ButtonLink href={routes.safety} variant="outline-inverse" size="lg">
              Comment se passe une remise en main propre
            </ButtonLink>
          </div>

          {/* Le lien passe à la ligne : une zone qui défile sans pouvoir
              recevoir le focus reste hors de portée du clavier (WCAG 2.1.1). */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
            <code className="mono min-w-0 flex-1 [overflow-wrap:anywhere] rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--slate-line)] bg-[var(--slate-raised)] px-4 py-3.5 text-[length:var(--text-sm)] text-[var(--chalk)]">
              {exampleUrl}
            </code>
            <CopyLinkButton url={exampleUrl} variant="inverse" />
          </div>
        </div>

        <ol className="flex list-none flex-col gap-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--slate-line)] bg-[var(--slate-raised)] p-5"
            >
              <span className="price grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--chalk)] text-[length:var(--text-xl)] text-[var(--on-chalk)]">
                {index + 1}
              </span>
              <div>
                <h3 className="text-[length:var(--text-body)] font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[length:var(--text-md)] leading-relaxed text-[var(--chalk-soft)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
