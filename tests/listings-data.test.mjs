import assert from "node:assert/strict";
import test from "node:test";
import {
  countListings,
  getFeaturedListings,
  getLatestListings,
  getListingBySlug,
  getListingForViewer,
  getListings,
  getListingCountByGame,
  getListingsBySeller,
  getListingsOwnedBy,
  getProOnlyCountByGame,
  getProOnlyListings,
  getRelatedListings,
} from "../src/lib/data/listings.ts";
import { MOCK_LISTING_ROWS } from "../src/lib/mock/listings.mock.ts";
import { getDistanceKm } from "../src/lib/geo.ts";
import { getRankedAt, isArchived, isOnMarket } from "../src/lib/listing-lifecycle.ts";

/* Le centre d'Avignon, origine des tests de distance. */
const AVIGNON = { latitude: 43.9493, longitude: 4.8055 };

const sumOf = (counts) => Object.values(counts).reduce((sum, count) => sum + count, 0);

test("la liste publique exclut les annonces vendues", async () => {
  const listings = await getListings();
  assert.equal(
    listings.some((listing) => listing.status === "sold"),
    false,
  );
});

test("includeSold ramène les annonces vendues", async () => {
  const listings = await getListings({ includeSold: true, limit: 100 });
  assert.equal(
    listings.some((listing) => listing.status === "sold"),
    true,
  );
});

test("le filtre par jeu ne laisse passer que ce jeu", async () => {
  const listings = await getListings({ gameId: "magic", limit: 100 });
  assert.ok(listings.length > 0);
  assert.equal(
    listings.every((listing) => listing.gameId === "magic"),
    true,
  );
});

test("le tri par prix croissant est réellement croissant", async () => {
  const listings = await getListings({ sort: "price-asc", limit: 100 });
  const prices = listings.map((listing) => listing.priceCents);
  assert.deepEqual(prices.toSorted((a, b) => a - b), prices);
});

test("la mise en avant remonte en tête du tri par défaut, pas du tri par prix", async () => {
  const recent = await getListings({ limit: 100 });
  const featured = await getFeaturedListings(10);
  assert.ok(featured.length > 0);
  assert.equal(recent[0].id, featured[0].id);

  const byPrice = await getListings({ sort: "price-asc", limit: 100 });
  const prices = byPrice.map((listing) => listing.priceCents);
  assert.deepEqual(prices.toSorted((a, b) => a - b), prices);
});

test("« Déposé récemment » suit l'ordre de dépôt et ne répète pas « À la une »", async () => {
  /* Le classeur de l'accueil lisait le tri par défaut, qui remonte les
     annonces payées : un lot de six jours passait devant un lot de vingt
     heures, et les quatre premières pochettes étaient exactement les quatre
     lots de la section « À la une », deux écrans plus bas. */
  const latest = await getLatestListings(6);
  const featured = await getFeaturedListings(10);
  assert.equal(latest.length, 6);
  const dates = latest.map((listing) => new Date(listing.createdAt).getTime());
  assert.deepEqual(dates.toSorted((a, b) => b - a), dates, "le classeur n'est pas dans l'ordre de dépôt");
  const featuredIds = new Set(featured.map((listing) => listing.id));
  assert.deepEqual(latest.filter((listing) => featuredIds.has(listing.id)).map((listing) => listing.id), []);
  assert.ok(latest.every((listing) => listing.status !== "sold"));

  /* Et c'est bien le plus récent qui ouvre le classeur. */
  const everyone = await getListings({ limit: 500 });
  const newest = everyone
    .filter((listing) => !featuredIds.has(listing.id))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
  assert.equal(latest[0].id, newest.id);
});

test("le filtre de prix borne des deux côtés", async () => {
  const listings = await getListings({ minPriceCents: 4000, maxPriceCents: 9000, limit: 100 });
  assert.ok(listings.length > 0);
  assert.equal(
    listings.every((listing) => listing.priceCents >= 4000 && listing.priceCents <= 9000),
    true,
  );
});

test("la recherche textuelle ignore les accents et la casse", async () => {
  const listings = await getListings({ search: "POKEMON scelle", limit: 100 });
  assert.ok(listings.length > 0);
});

test("un prix illisible dans le filtre ne renvoie pas une liste vide", async () => {
  const listings = await getListings({ minPriceCents: undefined, limit: 100 });
  assert.ok(listings.length > 0);
});

const PUBLIC_ROWS = MOCK_LISTING_ROWS.filter((row) => row.audience === "everyone");

const PRO_ONLY_ROWS = MOCK_LISTING_ROWS.filter((row) => row.audience === "pros");

/* u-13 : boutique au forfait actif ; u-15 : forfait expiré ; u-01 : particulier. */
const ACTIVE_PRO = "u-13";

const EXPIRED_PRO = "u-15";

const PERSON = "u-01";
/* Un particulier qui n'a jamais écrit à propos d'un lot réservé aux pros :
   le compte de démonstration, lui, a un fil sur l-35 (c-06). */
const OUTSIDER = "u-03";

test("chaque slug est unique, et retrouvable par qui a le droit de le voir", async () => {
  const slugs = MOCK_LISTING_ROWS.map((row) => row.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const row of PUBLIC_ROWS) {
    assert.ok(await getListingBySlug(row.slug), `slug introuvable : ${row.slug}`);
  }
  assert.ok(PRO_ONLY_ROWS.length >= 3, "les annonces réservées aux pros ne sont plus exercées");
  for (const row of PRO_ONLY_ROWS) {
    assert.equal(await getListingBySlug(row.slug), null, `${row.slug} est lisible sans session`);
    assert.ok(await getListingForViewer(row.slug, row.seller_id), "son vendeur ne la voit plus");
    assert.ok(await getListingForViewer(row.slug, ACTIVE_PRO), "un pro au forfait actif ne la voit pas");
    assert.equal(await getListingForViewer(row.slug, OUTSIDER), null, "un particulier la voit");
    assert.equal(await getListingForViewer(row.slug, EXPIRED_PRO), null, "un forfait expiré la voit");
    assert.equal(await getListingForViewer(row.slug, null), null, "un visiteur anonyme la voit");
  }
});

test("qui a déjà parlé d'un lot passé « pros » garde l'accès à sa fiche, et lui seul", async () => {
  /* Décision de septembre 2026 : le compte de démonstration avait écrit à
     propos de l-35 avant que sa vendeuse le réserve aux pros. Sa
     conversation y renvoie ; la fiche lui reste lisible et dit pourquoi il
     ne peut plus écrire. Le miroir de la clause « participant » de la
     politique de lecture des annonces. */
  const l35 = PRO_ONLY_ROWS.find((row) => row.id === "l-35");
  assert.ok(await getListingForViewer(l35.slug, PERSON), "le participant du fil ne voit plus l'annonce");
  assert.equal(await getListingForViewer(l35.slug, OUTSIDER), null, "un particulier sans fil la voit");
  assert.equal(await getListingBySlug(l35.slug), null, "la lecture publique la rend");
});

test("aucune lecture publique ne rend une annonce réservée aux pros", async () => {
  const reserved = new Set(PRO_ONLY_ROWS.map((row) => row.id));
  const leaks = (listings) => listings.filter((listing) => reserved.has(listing.id)).map((listing) => listing.id);

  assert.deepEqual(leaks(await getListings({ includeSold: true, limit: 1000 })), []);
  assert.deepEqual(leaks(await getFeaturedListings(1000)), []);
  for (const row of PUBLIC_ROWS) {
    assert.deepEqual(leaks(await getRelatedListings(await getListingBySlug(row.slug), 1000)), []);
  }
  for (const row of PRO_ONLY_ROWS) {
    assert.deepEqual(leaks(await getListingsBySeller(row.seller_id)), [], "le profil public montre un lot réservé");
  }
});

test("le tableau de bord d'un vendeur garde ses lots réservés", async () => {
  for (const row of PRO_ONLY_ROWS) {
    const owned = await getListingsOwnedBy(row.seller_id, { includeSold: true });
    assert.ok(owned.some((listing) => listing.id === row.id), `${row.id} manque au tableau de bord`);
  }
});

test("l'espace pro ne s'ouvre qu'au forfait actif, et ne montre que des chiffres aux autres", async () => {
  assert.equal((await getProOnlyListings(ACTIVE_PRO)).length, PRO_ONLY_ROWS.filter((row) => row.status !== "sold").length);
  assert.deepEqual(await getProOnlyListings(PERSON), []);
  assert.deepEqual(await getProOnlyListings(EXPIRED_PRO), []);
  assert.deepEqual(await getProOnlyListings(null), []);

  const counts = await getProOnlyCountByGame();
  const total = sumOf(counts);
  assert.equal(total, PRO_ONLY_ROWS.filter((row) => row.status !== "sold").length);
});

test("les annonces liées excluent l'annonce elle-même et les ventes closes", async () => {
  const listing = await getListingBySlug(MOCK_LISTING_ROWS[0].slug);
  const related = await getRelatedListings(listing, 8);
  assert.equal(
    related.some((candidate) => candidate.id === listing.id),
    false,
  );
  assert.equal(
    related.some((candidate) => candidate.status === "sold"),
    false,
  );
});

test("le compte par jeu correspond aux annonces publiques en ligne — ni vendues, ni expirées", async () => {
  const counts = await getListingCountByGame();
  const total = sumOf(counts);
  const now = Date.now();
  assert.equal(total, PUBLIC_ROWS.filter((row) => isOnMarket({ status: row.status, renewedAt: row.renewed_at }, now)).length);
  assert.ok(PUBLIC_ROWS.some((row) => row.status !== "sold" && !isOnMarket({ status: row.status, renewedAt: row.renewed_at }, now)), "plus aucune annonce expirée : le compte ne la met plus à l'épreuve");
});

test("la pagination découpe sans perdre ni dupliquer d'annonce", async () => {
  const total = await countListings();
  const first = await getListings({ limit: 10, offset: 0 });
  const second = await getListings({ limit: 10, offset: 10 });
  const third = await getListings({ limit: 10, offset: 20 });

  assert.equal(first.length, 10);
  assert.equal(second.length, 10);
  assert.equal(third.length, total - 20);

  const ids = [...first, ...second, ...third].map((listing) => listing.id);
  assert.equal(new Set(ids).size, ids.length, "une annonce apparaît sur deux pages");
  assert.equal(ids.length, total);
});

test("countListings compte avant pagination, pas après", async () => {
  const withLimit = await countListings({ limit: 3 });
  const all = await getListings({ limit: 1000 });
  assert.equal(withLimit, all.length);
});

test("countListings tient compte des filtres", async () => {
  const magic = await countListings({ gameId: "magic" });
  const listings = await getListings({ gameId: "magic", limit: 1000 });
  assert.equal(magic, listings.length);
  assert.ok(magic < (await countListings()));
});

test("un décalage au-delà du total renvoie une page vide, pas une erreur", async () => {
  const listings = await getListings({ offset: 10_000, limit: 24 });
  assert.deepEqual(listings, []);
});

test("le tri par distance ordonne réellement du plus proche au plus lointain", async () => {
  const origin = AVIGNON;
  const listings = await getListings({ sort: "distance", origin, limit: 100 });
  const distances = listings.map((listing) =>
    getDistanceKm(origin, { latitude: listing.latitude, longitude: listing.longitude }),
  );
  assert.deepEqual(distances.toSorted((a, b) => a - b), distances);
  assert.equal(listings[0].city, "Avignon");
});

test("le tri par distance sans origine ne réordonne rien plutôt que d'inventer un ordre", async () => {
  const byDistance = await getListings({ sort: "distance", limit: 100 });
  const byRecent = await getListings({ sort: "recent", limit: 100 });
  assert.deepEqual(
    byDistance.map((listing) => listing.id),
    byRecent.map((listing) => listing.id),
  );
});

test("le rayon exclut ce qui est au-delà et garde ce qui est en deçà", async () => {
  const origin = AVIGNON;
  const near = await getListings({ origin, maxDistanceKm: 25, limit: 100 });
  const far = await getListings({ origin, maxDistanceKm: 200, limit: 100 });

  assert.ok(near.length > 0);
  assert.ok(near.length < far.length, "le rayon de 25 km n'a rien exclu");
  for (const listing of near) {
    const distance = getDistanceKm(origin, {
      latitude: listing.latitude,
      longitude: listing.longitude,
    });
    assert.ok(distance <= 25, `${listing.city} est à ${distance.toFixed(1)} km`);
  }
});

test("un rayon sans origine est ignoré au lieu de vider la liste", async () => {
  const listings = await getListings({ maxDistanceKm: 1, limit: 100 });
  assert.ok(listings.length > 0);
});

test("les annonces d'un même jeu épuisent les photos avant d'en répéter une", async () => {
  const { STOCK_PHOTOS } = await import("../src/lib/photos.ts");

  const byGame = new Map();
  for (const row of MOCK_LISTING_ROWS) {
    /* Une annonce archivée n'a plus de photo : elle n'en répète aucune. */
    if (STOCK_PHOTOS[row.game_id].length === 0 || row.photos.length === 0) continue;
    const urls = byGame.get(row.game_id) ?? [];
    urls.push(row.photos[0]?.storage_path);
    byGame.set(row.game_id, urls);
  }

  for (const [gameId, urls] of byGame) {
    /* Deux vignettes voisines identiques donnent l'impression d'un bug
       d'affichage : on n'accepte une répétition que si le pool est plus
       petit que le nombre d'annonces. */
    const size = STOCK_PHOTOS[gameId].length;
    assert.equal(
      new Set(urls).size,
      Math.min(urls.length, size),
      `${gameId} : ${new Set(urls).size} photos distinctes pour ${urls.length} annonces et ${size} photos disponibles`,
    );
  }
});

test("aucune annonce de démonstration ne dépasse les photos gratuites sans l'option", async () => {
  /* La base refuse la quatrième photo d'une annonce qui n'a pas payé
     l'option : les données de démonstration tiennent la même règle. */
  const { FREE_PHOTOS } = await import("../src/lib/site.ts");
  const listings = await getListings({ includeSold: true, limit: 500 });
  const offenders = listings.filter((listing) => listing.photos.length > FREE_PHOTOS && !listing.hasExtraPhotos);
  assert.deepEqual(offenders.map((listing) => listing.slug), []);
});

test("une photo ne sert jamais deux jeux", async () => {
  /* Le pool « anime » de One Piece et Naruto reprenait trois photos du pool
     Yu-Gi-Oh : une photo présente dans deux pools montre forcément un jeu
     qui n'est pas celui de l'annonce. Un pool n'a pas non plus de doublon. */
  const { STOCK_PHOTOS } = await import("../src/lib/photos.ts");
  const owners = new Map();
  const shared = [];
  for (const [gameId, photos] of Object.entries(STOCK_PHOTOS)) {
    for (const photo of photos) {
      if (owners.has(photo.id)) shared.push(`${photo.id} : ${owners.get(photo.id)} et ${gameId}`);
      owners.set(photo.id, gameId);
    }
  }
  assert.deepEqual(shared, []);
});

test("toute photo de démonstration est créditable", async () => {
  const { getStockPhotoByUrl } = await import("../src/lib/photos.ts");
  const orphans = MOCK_LISTING_ROWS.flatMap((row) => row.photos)
    .map((photo) => photo.storage_path)
    .filter((url) => url !== null && getStockPhotoByUrl(url) === null);
  assert.deepEqual(orphans, [], "une photo n'a pas de crédit photographe associé");
});

test("une annonce a des photos si et seulement si son jeu en a d'honnêtes, et qu'elle n'est pas archivée", async () => {
  const { STOCK_PHOTOS } = await import("../src/lib/photos.ts");
  const now = Date.now();
  for (const row of MOCK_LISTING_ROWS) {
    /* Archivée — trente jours après sa vente ou son expiration —, ses photos
       sont parties : la démonstration montre la base après la tâche. */
    if (isArchived({ status: row.status, renewedAt: row.renewed_at, soldAt: row.sold_at }, now)) {
      assert.equal(row.photos.length, 0, `${row.id} est archivée et garde ses photos`);
      continue;
    }
    if (STOCK_PHOTOS[row.game_id].length === 0) {
      /* Aucune ligne vide : elle ferait afficher « 4 photos » sur une
         vignette qui n'en montre aucune. */
      assert.equal(row.photos.length, 0, `${row.id} a des photos alors que son jeu n'en a pas`);
      continue;
    }
    assert.ok(row.photos.length >= 3, `${row.id} n'a que ${row.photos.length} photo(s)`);
    assert.equal(
      row.photos.every((photo) => photo.storage_path !== null),
      true,
      `${row.id} a une photo sans URL`,
    );
  }
});

test("le filtre « Ouvert à l'échange » ne rend que les lots dont le vendeur l'accepte", async () => {
  const open = await getListings({ openToTrade: true, limit: 100 });
  assert.ok(open.length > 0, "aucun lot de démonstration n'est ouvert à l'échange");
  assert.ok(open.every((listing) => listing.openToTrade));
  const expected = MOCK_LISTING_ROWS.filter(
    (row) => row.open_to_trade && row.audience === "everyone" && row.status !== "sold",
  ).length;
  assert.equal(open.length, expected);
  /* Une note n'existe jamais sans l'échange : la contrainte de la base. */
  assert.ok(MOCK_LISTING_ROWS.every((row) => row.trade_note === null || row.open_to_trade));
});

/* --- Le cycle de vie : expiration, archivage, remontée --- */

test("une annonce expirée ne sort d'aucune lecture publique, mais sa page répond et son vendeur la garde", async () => {
  /* l-41 : déposée il y a 102 jours par u-01, jamais prolongée. */
  const everywhere = [
    ...(await getListings({ includeSold: true, limit: 500 })),
    ...(await getFeaturedListings(50)),
    ...(await getLatestListings(50)),
    ...(await getListingsBySeller("u-01")),
    ...(await getRelatedListings((await getListings({ gameId: "magic", limit: 1 }))[0], 50)),
  ];
  assert.ok(!everywhere.some((listing) => listing.id === "l-41"), "une lecture publique rend encore l'annonce expirée");
  assert.ok(!(await getListings({ includeSold: true, status: "available", limit: 500 })).some((listing) => listing.id === "l-41"), "le filtre de statut la laisse repasser");
  const page = (await getListings({ includeExpired: true, limit: 500 })).find((listing) => listing.id === "l-41");
  assert.ok(page, "includeExpired ne la ramène pas");
  assert.equal((await getListingBySlug(page.slug))?.id, "l-41", "son lien ne répond plus");
  const owned = await getListingsOwnedBy("u-01", { includeSold: true });
  assert.ok(owned.some((listing) => listing.id === "l-41"), "son vendeur ne la retrouve plus pour la remettre en ligne");
});

test("une annonce remontée se range à sa dernière remontée dans le tri par défaut, pas dans « Déposé récemment »", async () => {
  /* l-06 : déposée il y a 23 jours, remontée il y a 6 heures. */
  const now = Date.now();
  const rankOf = (listing) => getRankedAt(listing, now);
  const recent = (await getListings({ limit: 500 })).filter((listing) => !listing.featuredUntil || Date.parse(listing.featuredUntil) <= now);
  const ranks = recent.map(rankOf);
  assert.deepEqual(ranks.toSorted((a, b) => b - a), ranks, "le tri par défaut ne suit plus le rang");
  const bumped = recent.findIndex((listing) => listing.id === "l-06");
  assert.ok(bumped >= 0, "l'annonce remontée de la démonstration a disparu");
  assert.ok(
    recent.slice(bumped + 1).some((listing) => Date.parse(listing.createdAt) > Date.parse(recent[bumped].createdAt)),
    "la remontée n'a fait passer l'annonce devant aucune annonce plus récente",
  );
  assert.ok(!(await getLatestListings(6)).some((listing) => listing.id === "l-06"), "« Déposé récemment » range une remontée comme un dépôt");
  /* Le tri par prix ne se laisse pas acheter. */
  const byPrice = (await getListings({ sort: "price-asc", limit: 500 })).map((listing) => listing.priceCents);
  assert.deepEqual(byPrice.toSorted((a, b) => a - b), byPrice);
});
