import type { Metadata } from "next";
import { LISTING_LIFECYCLE } from "@/lib/listing-lifecycle";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: false, follow: true },
};

/* Les informations d'éditeur et d'hébergeur exigées par la LCEN (art. 6-III)
   ne sont pas inventées ici : elles sont nommées, et laissées à compléter.
   Une mention légale plausible mais fausse est pire qu'une mention absente. */
const REQUIRED_FIELDS = [
  {
    heading: "Éditeur du site",
    items: [
      "Dénomination sociale ou nom et prénom de l'éditeur",
      "Forme juridique et capital social, le cas échéant",
      "Adresse du siège social",
      "Numéro de téléphone et adresse e-mail de contact",
      "Numéro SIREN ou SIRET et numéro de TVA intracommunautaire, le cas échéant",
      "Nom du directeur de la publication",
    ],
  },
  {
    heading: "Hébergeur",
    items: [
      "Dénomination sociale de l'hébergeur",
      "Adresse du siège social",
      "Numéro de téléphone",
    ],
  },
  {
    heading: "Données personnelles",
    items: [
      "Finalités de traitement et base légale",
      "Durée de conservation des annonces, des messages et des comptes",
      "Coordonnées pour l'exercice des droits RGPD",
      "Identité du délégué à la protection des données, le cas échéant",
    ],
  },
];

/* Toute la largeur, en deux colonnes : à gauche ce que la page est — un
   document incomplet, et le rôle du site —, à droite ce que la loi impose
   d'y écrire. Bridée à 800 px, elle laissait vide plus de la moitié d'un
   grand écran. */
export default function LegalPage() {
  return (
    <div className="container pb-[var(--section-gap)] pt-8 lg:pt-12">
      <h1 className="display display-h2">Mentions légales</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col gap-10">
          <div className="notice notice-warn">
            <p className="label text-[var(--status-reserved)]">Document incomplet</p>
            <p className="mt-3 text-[length:var(--text-body)] leading-relaxed">
              {SITE_NAME} est au stade du prototype et n&apos;a pas encore d&apos;éditeur déclaré.
              Cette page liste exactement ce que la loi impose de publier avant toute mise en ligne
              réelle. Rien n&apos;a été rempli à titre d&apos;exemple : une mention légale
              vraisemblable mais fausse est plus dangereuse qu&apos;une mention manquante.
            </p>
          </div>

          <section>
            <h2 className="display display-h3">Rôle du site dans les transactions</h2>
            <p className="mt-4 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
              {SITE_NAME} met en relation des particuliers et n&apos;intervient à aucun moment dans
              la transaction : pas de paiement, pas de séquestre, pas de transport, pas de garantie
              sur l&apos;état des lots. Les annonces sont rédigées et publiées sous la seule
              responsabilité de leurs auteurs.
            </p>
          </section>

          {/* Ce que le Code de la consommation demande à une plateforme qui
              mêle particuliers et professionnels (D111-8) : qui publie, ce que
              dit chaque annonce, et ce qui décide de l'ordre — paiement compris. */}
          <section>
            <h2 className="display display-h3">Qui publie, et dans quel ordre</h2>
            <p className="mt-4 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
              Particuliers et professionnels publient ici. Chaque annonce dit si elle vient d&apos;un particulier ou
              d&apos;un professionnel, tel que le vendeur l&apos;a déclaré ; un compte professionnel l&apos;est par le SIRET
              de son établissement, vérifié auprès du répertoire des entreprises. Une vente entre particuliers ne donne ni
              droit de rétractation ni garantie légale de conformité ; la garantie des vices cachés s&apos;applique.
            </p>
            <p className="mt-4 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
              Le tri par défaut place d&apos;abord les annonces à la une, une option payante signalée par son sceau, puis les
              plus récentes. Une annonce remontée, autre option payante, y reprend la tête une fois par jour et le dit sur sa
              vignette, à côté de sa vraie date de dépôt. Les tris par prix et par distance ne dépendent d&apos;aucun paiement.
            </p>
          </section>

          {/* Ce n'est pas une mention à compléter : c'est la règle que le site
              applique déjà (lib/listing-lifecycle, run_listing_lifecycle). */}
          <section>
            <h2 className="display display-h3">Conservation des annonces et des photos</h2>
            <p className="mt-4 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
              Une annonce quitte les listes {LISTING_LIFECYCLE.lifetimeDays} jours après le dernier geste de son vendeur, qui peut
              la prolonger gratuitement. {LISTING_LIFECYCLE.archiveAfterDays} jours après sa vente ou son expiration, ses photos
              sont supprimées de {SITE_NAME} : ce sont des photos prises chez les gens, et elles ne sont pas gardées plus
              longtemps que nécessaire. Une annonce visée par un signalement en cours d&apos;examen garde les siennes jusqu&apos;à
              la décision. Le texte de l&apos;annonce et les avis restent, et son lien répond toujours.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-10">
          {REQUIRED_FIELDS.map((section) => (
            <section key={section.heading}>
              <h2 className="display display-h3">{section.heading}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[length:var(--text-body)] leading-relaxed">
                    <span className="mono text-[var(--muted)]" aria-hidden="true">
                      —
                    </span>
                    <span className="text-[var(--ink-soft)]">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
