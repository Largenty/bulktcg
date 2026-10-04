import { isGameId } from "@/types/game";
import { CARD_CONDITIONS, CARD_LANGUAGES, LOT_TYPES, type ListingCardData, type ListingPhoto } from "@/types/listing";
import type { SellerSummary } from "@/types/profile";
import type { City } from "@/lib/city-label";
import type { ListingFormDefaults } from "@/lib/form-defaults";
import { isEditionOfGame } from "@/lib/edition-id";
import type { Edition } from "@/types/edition";
import { isTagAllowedForGame } from "@/lib/product-tags";
import { oneOf } from "@/lib/search-params";
import { BUMP_DURATION_DAYS, FEATURED_DURATION_DAYS, URGENT_DURATION_DAYS } from "@/lib/site";
import { parsePositiveDecimal } from "@/lib/decimal";

/* La fin d'une option, comptée depuis l'instant figé de l'aperçu : jamais
   l'horloge du navigateur, qui changerait d'un rendu à l'autre. */
function optionEnd(now: string, days: number): string {
  return new Date(Date.parse(now) + days * 24 * 60 * 60 * 1000).toISOString();
}

/* Le brouillon d'une annonce pendant sa saisie, tel qu'il se lit dans le
   formulaire : des chaînes, pas encore validées. Il sert à une seule chose,
   dessiner l'aperçu de la vignette pendant qu'on tape — la validation reste
   l'affaire du schéma, à la soumission. */
export type ListingDraft = {
  title: string;
  gameId: string;
  lotType: string;
  condition: string;
  language: string;
  cardCount: string;
  weightKg: string;
  priceEuros: string;
  city: string;
  audience: string;
  /* Les options payantes à durée, telles que les rend une case cochée :
     « on » ou rien. L'aperçu montre ce qu'elles poseront sur la vignette. */
  isFeatured: string;
  isUrgent: string;
  isBumped: string;
  /* « on » ou rien, comme les options : l'aperçu montre le repère
     « Échange » dès qu'on coche. */
  openToTrade: string;
  /* L'option « 8 photos », « on » ou rien : elle règle combien de photos le
     sélecteur accepte. */
  extraPhotos: string;
  /* Les cases à cocher : identifiants d'édition et produits, dans l'ordre
     de saisie. L'aperçu en tire les pastilles de la vignette. */
  editions: string[];
  tags: string[];
};

/* Le brouillon au montage du formulaire : vide au dépôt, l'annonce à la
   modification. Les options payantes à durée repartent décochées — on les
   reprend, on ne les prolonge pas ; « 8 photos », acquise, revient. */
export function initialDraft(defaults: ListingFormDefaults = {}): ListingDraft {
  return {
    title: defaults.title ?? "",
    gameId: defaults.gameId ?? "",
    lotType: defaults.lotType ?? "",
    condition: defaults.condition ?? "",
    language: defaults.language ?? "",
    cardCount: defaults.cardCount ?? "",
    weightKg: defaults.weightKg ?? "",
    priceEuros: defaults.priceEuros ?? "",
    city: defaults.city ?? "",
    audience: defaults.audience ?? "everyone",
    isFeatured: "",
    isUrgent: "",
    isBumped: "",
    openToTrade: defaults.openToTrade ?? "",
    extraPhotos: defaults.extraPhotos ?? "",
    editions: defaults.editions ?? [],
    tags: defaults.tags ?? [],
  };
}

export type DraftPhoto = {
  /* Référence transmise au serveur : « local:… », « storage:… » ou l'URL
     d'une photo déjà publiée. */
  ref: string;
  /* Ce que le navigateur affiche : URL publiée, ou URL blob d'un fichier
     choisi sur l'appareil. */
  previewUrl: string;
  name: string;
};

const TEXT_FIELDS = [
  "title",
  "gameId",
  "lotType",
  "condition",
  "language",
  "cardCount",
  "weightKg",
  "priceEuros",
  "city",
  "audience",
  "isFeatured",
  "isUrgent",
  "isBumped",
  "openToTrade",
  "extraPhotos",
] as const;

/* Lu dans le formulaire lui-même : FormData y inclut aussi les champs posés
   hors de la balise et rattachés par leur attribut form — les options, dans
   la colonne de l'aperçu. */
export function readDraft(form: HTMLFormElement): ListingDraft {
  const data = new FormData(form);
  const text = Object.fromEntries(TEXT_FIELDS.map((field) => [field, String(data.get(field) ?? "")]));
  return {
    ...(text as Omit<ListingDraft, "editions" | "tags">),
    editions: data.getAll("editions").map(String),
    tags: data.getAll("tags").map(String),
  };
}

/* Les choix sans lesquels la vignette ne peut pas être dessinée sans
   inventer : sa couleur vient du jeu, son bandeau du format, de l'état et de
   la langue. Tant qu'il en manque, l'aperçu les montre en emplacements vides
   et dit lesquels — il ne les suppose pas. */
export function getMissingPreviewChoices(draft: ListingDraft): string[] {
  return [
    draft.gameId ? null : "le jeu",
    draft.lotType ? null : "le format",
    draft.condition ? null : "l'état",
    draft.language ? null : "la langue",
  ].filter((label): label is string => label !== null);
}

/* Changer de jeu remonte les cases des séries et des produits
   (EditionTagFields) : seules y restent cochées les valeurs par défaut qui
   existent pour le nouveau jeu. Le brouillon le sait tout de suite, sans
   attendre la frappe suivante — sinon l'aperçu garderait un instant le
   « Tapis de jeu » coché pour l'autre jeu. */
export function checksForGame(
  gameId: string,
  defaults: { editions?: string[]; tags?: string[] } = {},
): Pick<ListingDraft, "editions" | "tags"> {
  if (!isGameId(gameId)) return { editions: [], tags: [] };
  return {
    editions: (defaults.editions ?? []).filter((id) => isEditionOfGame(id, gameId)),
    tags: (defaults.tags ?? []).filter((tag) => isTagAllowedForGame(tag, gameId)),
  };
}

export function getDraftPriceLabel(draft: ListingDraft): string | undefined {
  return parsePositiveDecimal(draft.priceEuros) === null ? "— €" : undefined;
}

/* Une vignette à partir du brouillon, pour l'aperçu seulement, dès le
   premier caractère. Ce qui manque reste manquant : un jeu non choisi laisse
   un emplacement vide, un nombre de cartes non saisi s'affiche « — » comme
   il s'affichera sur la vignette publiée, jamais « 0 ». Les séries et les
   produits cochés sont relus contre le jeu choisi : ceux d'un jeu qu'on
   vient de quitter ne s'affichent pas. */
export function buildPreviewListing(
  draft: ListingDraft,
  photos: DraftPhoto[],
  seller: SellerSummary,
  now: string,
  /* La commune choisie dans le champ : son nom ne suffit plus à la
     retrouver, et le référentiel ne vit pas dans le navigateur. */
  city: City | null,
  /* Les séries reçues du serveur (useGameEditions) : le référentiel ne vit
     pas dans le navigateur. Une série cochée qui n'y est pas ne s'affiche
     pas plutôt que de s'afficher fausse. */
  editions: ReadonlyMap<string, Edition>,
): ListingCardData {
  const gameId = isGameId(draft.gameId) ? draft.gameId : null;
  const count = parsePositiveDecimal(draft.cardCount);
  const price = parsePositiveDecimal(draft.priceEuros);
  const previewPhotos: ListingPhoto[] = photos.map((photo, index) => ({
    id: `apercu-${index}`,
    position: index,
    seed: index + 1,
    url: photo.previewUrl,
  }));

  return {
    id: "apercu",
    slug: "apercu",
    reference: "BK-APERÇU",
    seller,
    gameId,
    title: draft.title.trim() || "Le titre de votre annonce",
    description: "",
    lotType: oneOf(draft.lotType, LOT_TYPES) ?? null,
    cardCount: count === null ? null : Math.round(count),
    weightKg: parsePositiveDecimal(draft.weightKg),
    condition: oneOf(draft.condition, CARD_CONDITIONS) ?? null,
    language: oneOf(draft.language, CARD_LANGUAGES) ?? null,
    priceCents: price === null ? 0 : Math.round(price * 100),
    previousPriceCents: null,
    city: city?.name ?? (draft.city.trim() || "Votre commune"),
    postalCode: city?.postalCode ?? "",
    departmentCode: city?.departmentCode ?? "",
    latitude: city?.latitude ?? 0,
    longitude: city?.longitude ?? 0,
    status: "available",
    reservedForId: null,
    audience: draft.audience === "pros" ? "pros" : "everyone",
    openToTrade: draft.openToTrade !== "",
    tradeNote: null,
    featuredUntil: draft.isFeatured ? optionEnd(now, FEATURED_DURATION_DAYS) : null,
    urgentUntil: draft.isUrgent ? optionEnd(now, URGENT_DURATION_DAYS) : null,
    hasExtraPhotos: draft.extraPhotos !== "",
    /* Remontée demandée : l'aperçu porte la mention, comme la vignette
       publiée pendant l'option. */
    bumpStartedAt: draft.isBumped ? now : null,
    bumpUntil: draft.isBumped ? optionEnd(now, BUMP_DURATION_DAYS) : null,
    renewedAt: now,
    viewCount: 0,
    photos: previewPhotos,
    editions: gameId
      ? draft.editions.flatMap((id) => {
          const edition = editions.get(id);
          return edition && edition.gameId === gameId ? [edition] : [];
        })
      : [],
    tags: gameId ? draft.tags.filter((tag) => isTagAllowedForGame(tag, gameId)) : [],
    createdAt: now,
    updatedAt: now,
    soldAt: null,
  };
}
