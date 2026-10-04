import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_LIFECYCLE,
  daysUntil,
  getArchiveAt,
  getExpiresAt,
  getLastBumpAt,
  getListingLifecycle,
  getRankedAt,
  isArchived,
  isBumped,
  isExpired,
  isExpiringWithin,
  isOnMarket,
} from "../src/lib/listing-lifecycle.ts";

/* Le cycle de vie d'une annonce, sans horloge : chaque règle se joue à des
   instants choisis. La base tient les mêmes durées (schema-sync), et la
   rejoue sur PostgreSQL (supabase/tests/scenarios/14-listing-lifecycle.sql). */

const DAY = 86_400_000;
const HOUR = 3_600_000;
const T0 = Date.parse("2026-06-01T10:00:00.000Z");
const at = (days) => new Date(T0 + days * DAY).toISOString();

const online = { status: "available", renewedAt: at(0), soldAt: null };

test("une annonce quitte le marché quatre-vingt-dix jours après le dernier geste de son vendeur, pas avant", () => {
  assert.equal(LISTING_LIFECYCLE.lifetimeDays, 90);
  assert.equal(getExpiresAt(online), T0 + 90 * DAY);
  assert.equal(isOnMarket(online, T0 + 90 * DAY - 1), true);
  assert.equal(isExpired(online, T0 + 90 * DAY - 1), false);
  assert.equal(isOnMarket(online, T0 + 90 * DAY), false);
  assert.equal(isExpired(online, T0 + 90 * DAY), true);
  /* Réservée aussi : une réservation qui traîne trois mois est morte. */
  assert.equal(isExpired({ ...online, status: "reserved" }, T0 + 91 * DAY), true);
  /* Un geste la relance : la date part du dernier, pas du dépôt. */
  assert.equal(isOnMarket({ ...online, renewedAt: at(80) }, T0 + 91 * DAY), true);
});

test("une annonce vendue n'expire jamais : elle est vendue", () => {
  const sold = { status: "sold", renewedAt: at(0), soldAt: at(5) };
  assert.equal(isExpired(sold, T0 + 400 * DAY), false);
  assert.equal(isOnMarket(sold, T0 + 6 * DAY), false);
  assert.equal(getListingLifecycle(sold, T0 + 6 * DAY).phase, "sold");
});

test("trente jours après sa sortie du marché — vente ou expiration —, l'annonce est archivée", () => {
  const sold = { status: "sold", renewedAt: at(0), soldAt: at(10) };
  assert.equal(getArchiveAt(sold, T0 + 11 * DAY), T0 + 40 * DAY);
  assert.equal(isArchived(sold, T0 + 40 * DAY - 1), false);
  assert.equal(isArchived(sold, T0 + 40 * DAY), true);
  /* Expirée à 90 jours, archivée à 120. */
  assert.equal(getArchiveAt(online, T0 + 95 * DAY), T0 + 120 * DAY);
  assert.equal(isArchived(online, T0 + 119 * DAY), false);
  assert.equal(isArchived(online, T0 + 120 * DAY), true);
  /* En ligne, rien n'est daté : elle n'a pas quitté le marché. */
  assert.equal(getArchiveAt(online, T0 + 10 * DAY), null);
  assert.equal(isArchived(online, T0 + 10 * DAY), false);
});

test("le décompte passe au premier plan à quatorze jours, la cloche et la vue d'ensemble à sept", () => {
  assert.deepEqual(getListingLifecycle(online, T0 + 75 * DAY), { phase: "online", expiresAt: T0 + 90 * DAY, isWarning: false });
  assert.equal(getListingLifecycle(online, T0 + 76 * DAY).isWarning, true);
  assert.equal(isExpiringWithin(online, LISTING_LIFECYCLE.noticeDays, T0 + 82 * DAY), false);
  assert.equal(isExpiringWithin(online, LISTING_LIFECYCLE.noticeDays, T0 + 83 * DAY), true);
  /* Expirée, elle n'« expire » plus bientôt : elle l'est. */
  assert.equal(isExpiringWithin(online, LISTING_LIFECYCLE.noticeDays, T0 + 90 * DAY), false);
  assert.deepEqual(getListingLifecycle(online, T0 + 100 * DAY), {
    phase: "expired",
    expiredAt: T0 + 90 * DAY,
    archiveAt: T0 + 120 * DAY,
    isArchived: false,
  });
});

test("« dans 1 jour » jusqu'à la dernière heure, jamais « dans 0 jour »", () => {
  assert.equal(daysUntil(T0 + 4 * DAY, T0), 4);
  assert.equal(daysUntil(T0 + 4 * DAY, T0 + 1), 4);
  assert.equal(daysUntil(T0 + HOUR, T0), 1);
  assert.equal(daysUntil(T0, T0), 1);
});

test("la remontée replace l'annonce une fois par jour, de son début à sa fin, puis la laisse à sa dernière place", () => {
  const listing = { status: "available", createdAt: at(-20), bumpStartedAt: at(0), bumpUntil: at(7) };
  assert.equal(getLastBumpAt(listing, T0 - 1), null, "remontée avant d'avoir commencé");
  assert.equal(getLastBumpAt(listing, T0), T0);
  assert.equal(getLastBumpAt(listing, T0 + 23 * HOUR), T0);
  assert.equal(getLastBumpAt(listing, T0 + 25 * HOUR), T0 + DAY);
  /* Sept remontées : la dernière au sixième jour, même longtemps après. */
  assert.equal(getLastBumpAt(listing, T0 + 6 * DAY + HOUR), T0 + 6 * DAY);
  assert.equal(getLastBumpAt(listing, T0 + 30 * DAY), T0 + 6 * DAY);
  assert.equal(getLastBumpAt({ ...listing, bumpStartedAt: null, bumpUntil: null }, T0), null);
});

test("le rang est la date de dépôt ou la dernière remontée, et la vignette dit qu'elle a été remontée", () => {
  const listing = { status: "available", createdAt: at(-20), bumpStartedAt: at(0), bumpUntil: at(7) };
  assert.equal(getRankedAt(listing, T0 + 2 * DAY + HOUR), T0 + 2 * DAY);
  assert.equal(isBumped(listing, T0 + 2 * DAY), true);
  /* Après l'option, elle garde sa dernière place — et sa mention. */
  assert.equal(isBumped(listing, T0 + 30 * DAY), true);
  /* Sans option, rien. */
  const plain = { ...listing, bumpStartedAt: null, bumpUntil: null };
  assert.equal(getRankedAt(plain, T0), T0 - 20 * DAY);
  assert.equal(isBumped(plain, T0), false);
  /* Achetée au dépôt, l'option court déjà : l'aperçu le dit. */
  const fresh = { status: "available", createdAt: at(0), bumpStartedAt: at(0), bumpUntil: at(7) };
  assert.equal(isBumped(fresh, T0), true);
  /* Vendue, elle ne se range plus et ne se dit plus remontée. */
  assert.equal(getRankedAt({ ...listing, status: "sold" }, T0 + 2 * DAY), T0 - 20 * DAY);
  assert.equal(isBumped({ ...listing, status: "sold" }, T0 + 2 * DAY), false);
});
