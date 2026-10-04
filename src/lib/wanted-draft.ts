import { isGameId } from "@/types/game";
import type { LotType } from "@/types/listing";
import type { SellerSummary } from "@/types/profile";
import type { WantedCardData } from "@/types/wanted";
import type { City } from "@/lib/city-label";
import { LOT_TYPE_LABELS } from "@/lib/labels";
import { parsePositiveDecimal } from "@/lib/decimal";

/* Une demande de recherche pendant sa saisie, telle que le formulaire la
   porte : des chaînes, pas encore validées. Elle sert à dessiner l'aperçu de
   la carte et à compter ce qui y répond déjà — la validation reste l'affaire
   du schéma, à la soumission. */
export type WantedDraft = {
  title: string;
  gameId: string;
  lotType: string;
  maxPriceEuros: string;
  minCardCount: string;
  city: string;
  maxDistanceKm: string;
};

const FIELDS = ["title", "gameId", "lotType", "maxPriceEuros", "minCardCount", "city", "maxDistanceKm"] as const;

export function readWantedDraft(form: HTMLFormElement): WantedDraft {
  const data = new FormData(form);
  return Object.fromEntries(FIELDS.map((field) => [field, String(data.get(field) ?? "")])) as WantedDraft;
}

/* La carte telle que les vendeurs la verront. Ce qui n'est pas saisi reste
   absent : sans budget la carte dit « — », sans format « Tout format » —
   c'est la réponse d'un champ laissé vide, pas une supposition. */
export function buildWantedPreview(draft: WantedDraft, buyer: SellerSummary, now: string, city: City | null): WantedCardData {
  const maxPrice = parsePositiveDecimal(draft.maxPriceEuros);
  const minCount = parsePositiveDecimal(draft.minCardCount);
  return {
    id: "apercu",
    slug: "apercu",
    reference: "RC-APERÇU",
    buyer,
    gameId: isGameId(draft.gameId) ? draft.gameId : null,
    title: draft.title.trim() || "Le titre de votre demande",
    description: "",
    lotType: draft.lotType in LOT_TYPE_LABELS ? (draft.lotType as LotType) : null,
    maxPriceCents: maxPrice === null ? null : Math.round(maxPrice * 100),
    minCardCount: minCount === null ? null : Math.round(minCount),
    city: city?.name ?? (draft.city.trim() || "votre commune"),
    postalCode: city?.postalCode ?? "",
    departmentCode: city?.departmentCode ?? "",
    latitude: city?.latitude ?? 0,
    longitude: city?.longitude ?? 0,
    maxDistanceKm: Number(draft.maxDistanceKm) || 0,
    status: "open",
    createdAt: now,
    updatedAt: now,
    fulfilledAt: null,
  };
}

/* Le croisement n'a de sens qu'avec un jeu et une commune reconnue : sans
   eux, on ne compte rien plutôt que de compter faux. */
export function canMatchDraft(preview: WantedCardData): preview is WantedCardData & { gameId: NonNullable<WantedCardData["gameId"]> } {
  return preview.gameId !== null && preview.postalCode !== "";
}
