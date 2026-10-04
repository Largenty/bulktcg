/* Le cycle de vie d'une annonce après sa publication : en ligne tant que son
   vendeur s'en occupe, sortie du marché à sa vente ou à son expiration, puis
   archivée trente jours plus tard — ses photos sont alors supprimées, le
   texte reste, et son lien répond toujours.

   Tout se déduit des dates de l'annonce et de l'instant : aucune tâche ne
   fait expirer une annonce, elle l'est dès que sa date est passée. La tâche
   quotidienne (run_listing_lifecycle, migration 15) ne fait que ce qui
   demande une écriture — prévenir le vendeur une semaine avant, retirer les
   photos d'une annonce archivée —, et la base tient les mêmes durées
   (tests/schema-sync.test.mjs les compare).

   Comme lib/format, aucun appel à l'horloge : `now` est toujours passé —
   Date.now() côté serveur, l'instant figé de la page dans un aperçu client.
   Les fonctions lisent une forme minimale, que remplissent une annonce du
   domaine comme une ligne de la base : lib/data filtre sur les lignes. */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const LISTING_LIFECYCLE = {
  /* Quatre-vingt-dix jours sans un geste de son vendeur — la prolonger, la
     modifier, changer son statut, la remonter — et l'annonce quitte les
     listes. C'est l'annonce morte, vendue ailleurs et jamais passée en
     « Vendu », que le site promet de ne pas laisser traîner. */
  lifetimeDays: 90,
  /* Le décompte passe au premier plan dans « Mes annonces ». */
  warningDays: 14,
  /* La cloche prévient le vendeur, et la vue d'ensemble le compte. */
  noticeDays: 7,
  /* Trente jours après sa sortie du marché — vente ou expiration —,
     l'annonce est archivée : ses photos sont supprimées. Le même jour, une
     annonce vendue sort de l'index (SOLD_LISTING_INDEXED_DAYS, lib/metadata). */
  archiveAfterDays: 30,
  /* La remontée payante replace l'annonce en tête du tri par défaut une fois
     par jour, pendant la durée de l'option (BUMP_DURATION_DAYS, lib/site). */
  bumpIntervalHours: 24,
} as const;

/* Ce que lit l'expiration : une ligne de la base comme une annonce. */
type LifecycleFields = { status: string; renewedAt: string; soldAt: string | null };

/* Ce que lit le rang dans le tri par défaut. */
type BumpFields = { status: string; createdAt: string; bumpStartedAt: string | null; bumpUntil: string | null };

const timeOf = (isoDate: string) => Date.parse(isoDate);

/* La fin de la mise en ligne, comptée depuis le dernier geste du vendeur. */
export function getExpiresAt(listing: Pick<LifecycleFields, "renewedAt">): number {
  return timeOf(listing.renewedAt) + LISTING_LIFECYCLE.lifetimeDays * DAY_MS;
}

/* En ligne : ni vendue, ni passée sa date. Seule une annonce en ligne entre
   dans les listes, les recherches, le plan du site et les croisements. */
export function isOnMarket(listing: Omit<LifecycleFields, "soldAt">, now: number): boolean {
  return listing.status !== "sold" && now < getExpiresAt(listing);
}

/* Expirée : son vendeur ne l'a pas prolongée. Une annonce vendue n'expire
   jamais — elle est vendue. */
export function isExpired(listing: Omit<LifecycleFields, "soldAt">, now: number): boolean {
  return listing.status !== "sold" && now >= getExpiresAt(listing);
}

/* Quand l'annonce a quitté le marché : sa vente, ou son expiration ; null
   tant qu'elle y est. */
export function getMarketExitAt(listing: LifecycleFields, now: number): number | null {
  if (listing.status === "sold") return listing.soldAt === null ? null : timeOf(listing.soldAt);
  const expiresAt = getExpiresAt(listing);
  return now >= expiresAt ? expiresAt : null;
}

/* Le jour où ses photos partent : trente jours après la sortie du marché. */
export function getArchiveAt(listing: LifecycleFields, now: number): number | null {
  const exitAt = getMarketExitAt(listing, now);
  return exitAt === null ? null : exitAt + LISTING_LIFECYCLE.archiveAfterDays * DAY_MS;
}

/* Archivée : ses photos sont supprimées, ou le seront au prochain passage de
   la tâche quotidienne. Aucune page ne les montre plus dès cet instant. */
export function isArchived(listing: LifecycleFields, now: number): boolean {
  const archiveAt = getArchiveAt(listing, now);
  return archiveAt !== null && now >= archiveAt;
}

/* Les jours qui restent avant une échéance, le jour entamé compté : « dans
   1 jour » jusqu'à la dernière heure, jamais « dans 0 jour ». */
export function daysUntil(at: number, now: number): number {
  return Math.max(1, Math.ceil((at - now) / DAY_MS));
}

/* En ligne, et plus que `days` jours avant de ne plus l'être. */
export function isExpiringWithin(listing: Omit<LifecycleFields, "soldAt">, days: number, now: number): boolean {
  return isOnMarket(listing, now) && getExpiresAt(listing) - now <= days * DAY_MS;
}

/* La dernière remontée passée : l'option replace l'annonce en tête une fois
   par intervalle, de son début jusqu'à sa fin. null sans option, ou avant
   son début. */
export function getLastBumpAt(listing: Pick<BumpFields, "bumpStartedAt" | "bumpUntil">, now: number): number | null {
  if (listing.bumpStartedAt === null || listing.bumpUntil === null) return null;
  const startedAt = timeOf(listing.bumpStartedAt);
  const latest = Math.min(now, timeOf(listing.bumpUntil) - 1);
  if (latest < startedAt) return null;
  const interval = LISTING_LIFECYCLE.bumpIntervalHours * HOUR_MS;
  return startedAt + Math.floor((latest - startedAt) / interval) * interval;
}

/* La date qui range l'annonce dans le tri par défaut : son dépôt, ou sa
   dernière remontée. Elle ne s'affiche jamais — la vignette garde la date
   du dépôt, qui est la vraie. */
export function getRankedAt(listing: BumpFields, now: number): number {
  const createdAt = timeOf(listing.createdAt);
  const bumpedAt = listing.status === "sold" ? null : getLastBumpAt(listing, now);
  return bumpedAt !== null && bumpedAt > createdAt ? bumpedAt : createdAt;
}

/* Son rang vient d'une remontée payée — l'option court, ou elle a replacé
   l'annonce au-dessus de sa date de dépôt : la vignette le dit. Un
   classement acheté qui ne se signale pas est une pratique trompeuse
   (directive 2005/29/CE, annexe I, point 11 bis) — la mise à la une a son
   sceau, la remontée sa mention. */
export function isBumped(listing: BumpFields, now: number): boolean {
  if (listing.status === "sold") return false;
  const isRunning =
    listing.bumpStartedAt !== null && listing.bumpUntil !== null && timeOf(listing.bumpStartedAt) <= now && now < timeOf(listing.bumpUntil);
  return isRunning || getRankedAt(listing, now) > timeOf(listing.createdAt);
}

/* Où en est l'annonce, pour son vendeur : la ligne du tableau de bord et la
   fiche disent la même chose, depuis cette seule lecture. */
export type ListingLifecycle =
  | { phase: "online"; expiresAt: number; isWarning: boolean }
  | { phase: "expired"; expiredAt: number; archiveAt: number; isArchived: boolean }
  | { phase: "sold"; archiveAt: number | null; isArchived: boolean };

export function getListingLifecycle(listing: LifecycleFields, now: number): ListingLifecycle {
  const archiveAt = getArchiveAt(listing, now);
  const isPastArchive = archiveAt !== null && now >= archiveAt;
  if (listing.status === "sold") return { phase: "sold", archiveAt, isArchived: isPastArchive };
  const expiresAt = getExpiresAt(listing);
  if (now >= expiresAt) return { phase: "expired", expiredAt: expiresAt, archiveAt: archiveAt ?? expiresAt, isArchived: isPastArchive };
  return { phase: "online", expiresAt, isWarning: expiresAt - now <= LISTING_LIFECYCLE.warningDays * DAY_MS };
}
