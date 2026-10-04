import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { StickyColumn } from "@/components/layout/StickyColumn";
import { Icon } from "@/components/ui/Icon";
import { routes } from "@/lib/routes";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Se rencontrer sans mauvaise surprise",
  description:
    "Conseils concrets pour une remise de lot de cartes en main propre : lieu, paiement, vérification du contenu, signaux d'arnaque.",
  alternates: { canonical: routes.safety },
};

const RULES = [
  {
    title: "Aucun envoi, aucun acompte, jamais",
    body: "Tout le site est construit autour de la remise en main propre. Si quelqu'un vous propose d'envoyer le lot contre un virement, une carte cadeau ou un « acompte pour réserver », c'est une arnaque, sans exception. Il n'y a pas de cas particulier.",
  },
  {
    title: "Un lieu public, en journée",
    body: "Parking de supermarché, gare, place de marché, hall de médiathèque. Évitez les domiciles, dans les deux sens. Une boutique de jeux accepte souvent que deux personnes s'échangent un carton devant la porte.",
  },
  {
    title: "Espèces, comptées sur place",
    body: "Le liquide reste le moyen le plus simple pour un lot de trente à deux cents euros. Prévoyez l'appoint. Les virements instantanés fonctionnent aussi, mais attendez la notification de réception avant de rendre le carton.",
  },
  {
    title: "Ouvrez le carton avant de payer",
    body: "Pesez si le poids est annoncé, comptez si le nombre l'est, feuilletez le classeur. C'est normal et le vendeur honnête s'y attend. Pour un lot cher, prévoyez vingt minutes et dites-le à l'avance.",
  },
  {
    title: "Le scellé se vérifie au film",
    body: "Sur un display ou un coffret, regardez le film d'usine : les soudures, les plis, l'absence de recollage. Un scellé rouvert puis refermé se voit à la lumière rasante.",
  },
  {
    title: "Regardez le filigrane des photos",
    body: "Chaque photo porte, en bas à gauche, la référence de l'annonce et le pseudo du vendeur. Si le filigrane ne correspond pas au vendeur qui vous écrit, la photo a été reprise ailleurs. Ce n'est pas une protection absolue — un recadrage suffit à couper le coin — mais un vol devient visible d'un coup d'œil.",
  },
  {
    title: "Lisez le profil avant de vous déplacer",
    body: "Le nombre de ventes et les avis sont affichés sur chaque annonce. Un compte neuf sans avis n'est pas suspect en soi — tout le monde commence — mais pour un lot à cent cinquante euros, préférez un lieu passant.",
  },
];

const RED_FLAGS = [
  "On vous presse de conclure « avant ce soir ».",
  "On refuse tout rendez-vous et insiste pour envoyer.",
  "On demande un acompte pour « bloquer » le lot.",
  "Les photos portent le filigrane d'un autre vendeur que celui de l'annonce.",
  "Le prix est très en dessous du marché sans explication.",
  "On vous propose de passer sur une autre plateforme pour payer.",
];

/* Toute la largeur : les règles à gauche, en grille, et à droite, épinglés
   pendant la lecture, les signaux qui doivent faire annuler un rendez-vous.
   Bridée à 1 080 px, la page laissait un quart d'écran vide, et les signaux
   n'arrivaient qu'après les sept règles. */
export default function SafetyPage() {
  return (
    <div className="container pb-[var(--section-gap)] pt-8 lg:pt-12">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
        <div className="min-w-0">
          <p className="eyebrow text-[var(--muted)]">Transaction</p>
          <h1 className="display display-h2 mt-3">Se rencontrer sans mauvaise surprise</h1>
          {/* Le nombre de règles n'est pas écrit en toutes lettres : la page
              annonçait « six règles » au-dessus d'une liste qui en comptait sept. */}
          <p className="lead mt-5 text-[var(--ink-soft)]">
            {SITE_NAME} ne touche jamais à l&apos;argent et n&apos;intervient pas dans les échanges.
            C&apos;est ce qui rend le site gratuit à l&apos;usage, et c&apos;est aussi ce qui rend les règles
            ci-dessous utiles.
          </p>

          <ol className="mt-10 grid list-none gap-4 md:grid-cols-2">
            {RULES.map((rule, index) => (
              <li key={rule.title} className="panel flex gap-4">
                <span className="price grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--ink)] text-[length:var(--text-xl)] text-[var(--on-ink)]">
                  {index + 1}
                </span>
                <div>
                  <h2 className="display text-[length:var(--text-xl)]">{rule.title}</h2>
                  <p className="mt-2 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">{rule.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside aria-labelledby="signaux-titre" className="min-w-0">
          <StickyColumn className="on-slate rounded-[var(--radius-xl)] p-6 sm:p-8">
            <h2 id="signaux-titre" className="display display-h3 flex items-center gap-3">
              <Icon name="alert" size={26} />
              Les signaux qui doivent vous arrêter
            </h2>
            <ul className="mt-6 grid list-none gap-3">
              {RED_FLAGS.map((flag) => (
                <li key={flag} className="flex gap-3 rounded-[var(--radius-md)] bg-[var(--slate-raised)] p-4 text-[length:var(--text-md)] leading-relaxed">
                  <Icon name="flag" size={18} className="mt-1 shrink-0 text-[var(--chalk-muted)]" />
                  {flag}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[length:var(--text-md)] text-[var(--chalk-soft)]">
              Un seul de ces signaux suffit à annuler un rendez-vous. Vous ne devez aucune justification à
              quelqu&apos;un que vous n&apos;avez pas encore rencontré.
            </p>
          </StickyColumn>
        </aside>
      </div>

      {/* Sous les deux colonnes : sur téléphone, après les signaux d'alerte,
          et non entre les règles et eux. */}
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <ButtonLink href={routes.listings}>Voir les annonces</ButtonLink>
        <Link href={routes.legal} className="text-link text-[length:var(--text-md)]">
          Mentions légales
        </Link>
      </div>
    </div>
  );
}
