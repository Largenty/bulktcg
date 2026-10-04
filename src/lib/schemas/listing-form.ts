import { z } from "@/lib/schemas/zod";
import { isEditionOfGame } from "@/lib/edition-id";
import { PHOTO_REF_PATTERN } from "@/lib/photo-refs";
import { FREE_PHOTOS, MAX_PHOTOS } from "@/lib/site";
import { collectErrors } from "@/lib/schemas/field-errors";
import { optionalPositiveNumber, postalCodeField, titleField } from "@/lib/schemas/fields";
import { PRODUCT_TAG_IDS, isTagAllowedForGame } from "@/lib/product-tags";
import { GAME_IDS } from "@/types/game";
import { CARD_CONDITIONS, CARD_LANGUAGES, LISTING_AUDIENCES, LOT_TYPES } from "@/types/listing";
import { parseDecimal } from "@/lib/decimal";

/* Le schéma est la source de vérité : le type TypeScript en découle, et le
   même objet valide la saisie dans le navigateur, pour répondre tout de
   suite, puis dans l'action serveur, parce qu'un formulaire se trafique. */

/* Au-delà, la liste cesse d'informer : un acheteur ne lit pas vingt codes
   d'extension sur une vignette, et un vendeur qui en coche vingt décrit en
   réalité « toutes séries », ce que le champ vide dit déjà. */
const MAX_EDITIONS = 12;

const extraPhotosField = z.preprocess((value) => value === "on" || value === true, z.boolean());
const photoAllowanceSchema = z.object({ photos: z.array(z.string()), extraPhotos: extraPhotosField });

/* Une annonce de lot sans photo ne se vend pas, et le filigrane — la
   preuve que la photo est bien du vendeur — n'a rien sur quoi se poser.
   Les références sont des clés de fichier chez Cloudflare Images, ou des
   fichiers restés sur l'appareil dans la démonstration ; le schéma ne juge
   que leur forme et leur nombre. */
const requiredPhotos = z
  .array(z.string().regex(PHOTO_REF_PATTERN, "Une des photos n'a pas pu être lue."))
  .min(1, "Ajoutez au moins une photo : c'est la première chose qu'un acheteur regarde.")
  .max(MAX_PHOTOS, `${MAX_PHOTOS} photos au maximum.`);

/* Avec la base et avant Cloudflare Images (phase 3), aucune photo ne
   s'enregistre : le formulaire n'en propose pas, et une photo envoyée quand
   même est refusée plutôt que perdue en silence. */
const unavailablePhotos = z
  .array(z.string())
  .max(0, "Les photos arrivent bientôt : publiez l'annonce sans photo pour l'instant.");

const listingFields = z.object({
  title: titleField,
  gameId: z.enum(GAME_IDS, { error: "Choisissez un jeu." }),
  lotType: z.enum(LOT_TYPES, { error: "Choisissez un format de lot." }),
  condition: z.enum(CARD_CONDITIONS, { error: "Indiquez l'état des cartes." }),
  language: z.enum(CARD_LANGUAGES, { error: "Indiquez la langue des cartes." }),
  cardCount: optionalPositiveNumber("Le nombre de cartes doit être un nombre supérieur à zéro, ou rester vide.", { isInteger: true }),
  weightKg: optionalPositiveNumber("Le poids doit être un nombre supérieur à zéro, ou rester vide.", { isInteger: false }),
  priceEuros: z
    .string()
    .trim()
    .min(1, "Indiquez un prix.")
    .transform((value) => parseDecimal(value))
    .refine((value) => Number.isFinite(value) && value > 0, {
      error: "Le prix doit être un nombre supérieur à zéro.",
    })
    .refine((value) => value <= 5000, { error: "Au-delà de 5 000 €, contactez-nous d'abord." }),
  city: z.string().trim().min(2, "Indiquez la ville du rendez-vous."),
  postalCode: postalCodeField,
  description: z
    .string()
    .trim()
    .min(40, "Décrivez le lot en 40 caractères minimum : état réel, contenu, contraintes.")
    .max(4000, "La description ne doit pas dépasser 4 000 caractères."),
  /* Listes vides admises : « je n'ai pas précisé » est une réponse, et la
     seule honnête sur un carton non trié. C'est l'affichage qui écrira
     « non précisé », pas le schéma qui inventera « toutes séries ». */
  editions: z
    .array(z.string())
    .max(
      MAX_EDITIONS,
      `Au-delà de ${MAX_EDITIONS} séries, laissez le champ vide : « non précisé » se lit mieux qu'une liste de vingt lignes.`,
    ),
  /* Un produit inconnu est refusé ici ; un produit d'un autre jeu, plus
     bas, une fois le jeu connu. */
  tags: z.array(z.enum(PRODUCT_TAG_IDS, { error: "Un des produits cochés n'existe pas pour le jeu sélectionné." })),
  photos: requiredPhotos,
  /* L'option « 8 photos » : trois photos sont gratuites, les cinq suivantes
     la demandent. Cochée, elle arrive « on » ; une annonce qui l'a déjà
     payée la renvoie par un champ caché. Ni l'un ni l'autre n'est un droit :
     la couche données lit l'option sur l'annonce (lib/photo-allowance), et
     sans elle les photos au-delà de la troisième attendent le paiement. */
  extraPhotos: extraPhotosField,
  /* Qui voit l'annonce. Aucune valeur par défaut côté schéma : le formulaire
     envoie toujours son choix, et un envoi qui n'en porte pas ne doit pas
     rendre publique une annonce que son vendeur voulait réserver aux pros. */
  audience: z.enum(LISTING_AUDIENCES, { error: "Choisissez qui peut voir l'annonce." }),
  /* Une case cochée arrive « on », une case vide n'arrive pas : absente,
     l'annonce n'est pas ouverte à l'échange. La note n'est gardée que si
     la case l'est — c'est le mapper qui l'écarte sinon. */
  openToTrade: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  tradeNote: z.string().trim().max(140, "140 caractères au plus : ce que vous accepteriez contre le lot.").default(""),  /* La déclaration d'un vendeur particulier, cochée au dépôt : il vend à
     titre personnel (Code de la consommation, D111-8). Le schéma ne sait
     pas qui dépose : la couche données l'exige d'un compte de particulier,
     et d'un professionnel ne demande rien (createListing). */
  privateSeller: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

/* La commune place l'annonce sur la carte des acheteurs : elle doit exister,
   avec son code postal. Une ville tapée à la main sans correspondance
   laisserait l'annonce sans coordonnées, donc invisible de toute recherche
   par distance. L'action le vérifie (schemas/commune.ts) : le référentiel ne
   part pas dans le navigateur. */
export const LISTING_COMMUNE_ERROR = "Choisissez la commune dans la liste proposée : c'est elle qui place l'annonce sur la carte des acheteurs.";

/* Les règles qui croisent plusieurs champs, communes aux deux variantes. */
function withListingRules(fields: typeof listingFields) {
  return fields
    /* Au-delà de trois photos, l'option est requise. Refusé plutôt que tronqué
       en silence : le vendeur choisit lui-même lesquelles garder. Contrôlé même
       quand un autre champ est faux (when) : sinon l'erreur n'apparaissait
       qu'au second envoi, une fois tout le reste corrigé. */
    .refine((values) => values.photos.length <= FREE_PHOTOS || values.extraPhotos, {
      path: ["photos"],
      error: (issue) => {
        const extra = (issue.input as { photos: unknown[] }).photos.length - FREE_PHOTOS;
        return `${FREE_PHOTOS} photos sont gratuites : cochez l'option « ${MAX_PHOTOS} photos » ou retirez-en ${extra}.`;
      },
      when: (payload) => photoAllowanceSchema.safeParse(payload.value).success,
    })
    /* Une série doit appartenir au jeu choisi. Sans ce contrôle, un
       formulaire trafiqué déposerait une extension Magic sur une annonce
       Pokémon, et le filtre par série deviendrait faux pour tout le monde.
       Son identifiant porte son jeu ; qu'elle existe et soit encore
       proposée, le serveur seul le vérifie (schemas/editions.ts) : le
       référentiel ne part pas dans le navigateur. */
    .superRefine((values, context) => {
      for (const editionId of values.editions) {
        if (!isEditionOfGame(editionId, values.gameId)) {
          context.addIssue({
            code: "custom",
            path: ["editions"],
            message: "Une des séries cochées n'appartient pas au jeu sélectionné.",
          });
          return;
        }
      }
    })
    .superRefine((values, context) => {
      for (const tag of values.tags) {
        if (!isTagAllowedForGame(tag, values.gameId)) {
          context.addIssue({
            code: "custom",
            path: ["tags"],
            message: "Un des produits cochés n'existe pas pour le jeu sélectionné.",
          });
          return;
        }
      }
    });
}

export const listingFormSchema = withListingRules(listingFields);

/* Le même formulaire quand les photos ne peuvent pas encore s'enregistrer :
   avec la base, avant Cloudflare Images (canAttachPhotos, lib/data). */
export const listingFormSchemaWithoutPhotos = withListingRules(listingFields.extend({ photos: unavailablePhotos }));

export type ListingFormValues = z.infer<typeof listingFormSchema>;

export type ListingFormErrors = Partial<Record<keyof ListingFormValues, string>>;

/* Convertit les euros saisis en centimes entiers, l'unité de stockage. */
export function toPriceCents(priceEuros: number): number {
  return Math.round(priceEuros * 100);
}

export function collectFieldErrors(error: z.ZodError): ListingFormErrors {
  return collectErrors<keyof ListingFormValues>(error);
}

/* FormData -> objet brut, lu à l'identique dans le navigateur et dans
   l'action serveur. Object.fromEntries écrase les doublons de nom et ne
   garderait que la dernière série cochée : les champs multivalués se lisent
   avec getAll. C'est ce bug précis qu'un parcours de npm run smoke a
   attrapé. */
export function readListingFormData(formData: FormData): Record<string, unknown> {
  return {
    ...Object.fromEntries(formData),
    editions: formData.getAll("editions"),
    tags: formData.getAll("tags"),
    photos: formData.getAll("photos"),
  };
}
