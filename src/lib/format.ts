import { UNKNOWN_VALUE } from "@/lib/labels";

const EURO_WHOLE = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const EURO_DECIMAL = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat("fr-FR");

const RELATIVE = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/* Les montants circulent en centimes entiers ; l'euro n'apparaît qu'ici. */
export function formatPrice(priceCents: number): string {
  const euros = priceCents / 100;
  return priceCents % 100 === 0 ? EURO_WHOLE.format(euros) : EURO_DECIMAL.format(euros);
}

export function getDropPercent(priceCents: number, previousPriceCents: number): number {
  if (previousPriceCents <= 0) return 0;
  return Math.round(((previousPriceCents - priceCents) / previousPriceCents) * 100);
}

export function formatCardCount(cardCount: number | null): string {
  if (cardCount === null) return UNKNOWN_VALUE;
  return `${NUMBER.format(cardCount)} cartes`;
}

export function formatWeight(weightKg: number | null): string {
  if (weightKg === null) return UNKNOWN_VALUE;
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(weightKg);
  return `${formatted} kg`;
}

export function formatCount(value: number): string {
  return NUMBER.format(value);
}

/* Le nombre et son unité ne se séparent jamais en fin de ligne : « 21 » d'un
   côté, « km » de l'autre, dans la liste des communes voisines. */
export function formatDistance(distanceKm: number | null): string {
  if (distanceKm === null) return UNKNOWN_VALUE;
  if (distanceKm < 1) return "moins d'1\u00a0km";
  if (distanceKm < 10) {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(distanceKm)}\u00a0km`;
  }
  return `${Math.round(distanceKm)}\u00a0km`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* `now` est obligatoire, ici comme dans formatAge. Une valeur par défaut
   lisait l'horloge en cachette : la vignette d'une demande, rendue dans
   l'aperçu client du dépôt, écrivait « 1 min » au build et « 26 min » à
   l'hydratation, et React abandonnait l'arbre (erreur #418). Côté serveur
   on passe Date.now(), côté client l'instant figé que la page transmet. */
export function formatRelativeTime(isoDate: string, now: number): string {
  const elapsed = now - new Date(isoDate).getTime();
  if (Number.isNaN(elapsed)) return UNKNOWN_VALUE;

  if (elapsed < HOUR) return RELATIVE.format(-Math.round(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return RELATIVE.format(-Math.round(elapsed / HOUR), "hour");
  if (elapsed < 30 * DAY) return RELATIVE.format(-Math.round(elapsed / DAY), "day");
  if (elapsed < 365 * DAY) return RELATIVE.format(-Math.round(elapsed / (30 * DAY)), "month");
  return RELATIVE.format(-Math.round(elapsed / (365 * DAY)), "year");
}

/* Forme courte pour les bandeaux denses : « 3 h », « 12 j ». */
export function formatAge(isoDate: string, now: number): string {
  const elapsed = now - new Date(isoDate).getTime();
  if (Number.isNaN(elapsed)) return UNKNOWN_VALUE;
  if (elapsed < HOUR) return `${Math.max(1, Math.round(elapsed / MINUTE))} min`;
  if (elapsed < DAY) return `${Math.round(elapsed / HOUR)} h`;
  return `${Math.round(elapsed / DAY)} j`;
}

export function formatRating(ratingAvg: number | null): string {
  if (ratingAvg === null) return UNKNOWN_VALUE;
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratingAvg);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(isoDate));
}

export function formatTime(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(new Date(isoDate));
}

/* « 12345678900017 » se lit « 123 456 789 00017 » : le SIREN, puis
   l'établissement. Absent, il s'affiche « — ». */
export function formatSiret(siret: string | null): string {
  if (siret === null) return UNKNOWN_VALUE;
  return siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1\u00a0$2\u00a0$3\u00a0$4");
}

/* Un site s'affiche par son nom de domaine : le protocole et la barre
   finale n'apprennent rien à personne. */
export function formatWebsite(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
