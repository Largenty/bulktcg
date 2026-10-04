import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

/* Les lectures en mode Supabase, sans réseau : fetch est remplacé par un
   PostgREST simulé, qui plafonne ses réponses à 1 000 lignes comme Supabase
   et garde en cache, comme Next, toute réponse demandée avec des étiquettes.
   Ce fichier tourne dans son propre processus : les variables posées ici ne
   touchent aucun autre test, qui restent en démonstration. */

Object.assign(process.env, {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://projet.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_exemple",
  SUPABASE_SECRET_KEY: "sb_secret_exemple",
});

/* Le client de la personne lit ses cookies : hors d'une requête de Next,
   une requête sans session. */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/headers") {
      return { url: "data:text/javascript,export async function cookies(){return{getAll:()=>[],set(){}}}", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { TABLES, isSupabaseMode, profileRows, publicListingRows } = await import("../src/lib/data/source.ts");
const { getProfileById, getProfileByUsername } = await import("../src/lib/data/profiles.ts");
const { isViewerActivePro } = await import("../src/lib/data/listings.ts");
const { getDealById } = await import("../src/lib/data/deals.ts");
const { getAlertSettings } = await import("../src/lib/data/account-settings.ts");
const { getUnreadConversationCount } = await import("../src/lib/data/conversations.ts");
const { getUnreadNotificationCount } = await import("../src/lib/data/notifications.ts");

const MAX_ROWS = 1000;
const database = {};
const requests = [];
const dataCache = new Map();

function matches(row, key, condition) {
  const [operator, ...rest] = condition.split(".");
  const value = rest.join(".");
  const actual = String(row[key]);
  if (operator === "eq") return actual === value;
  if (operator === "neq") return actual !== value;
  if (operator === "gt") return actual > value;
  if (operator === "is") return actual === value;
  throw new Error(`filtre non simulé : ${key}=${condition}`);
}

/* Une jointure « table!inner(…) » : les lignes de la table jointe, reliées
   par <table parente au singulier>_id, filtrées par les paramètres
   « table.colonne » ; une ligne parente sans aucune ne revient pas. */
function joinInner(rows, table, url) {
  const inner = /(\w+)!inner\(/.exec(url.searchParams.get("select") ?? "")?.[1];
  if (!inner) return rows;
  const foreignKey = `${table.replace(/s$/, "")}_id`;
  const filters = [...url.searchParams].filter(([key]) => key.startsWith(`${inner}.`) && key !== `${inner}.limit`);
  const limit = Number(url.searchParams.get(`${inner}.limit`) ?? Infinity);
  return rows
    .map((row) => ({
      ...row,
      [inner]: (database[inner] ?? [])
        .filter((child) => child[foreignKey] === row.id && filters.every(([key, condition]) => matches(child, key.slice(inner.length + 1), condition)))
        .slice(0, limit),
    }))
    .filter((row) => row[inner].length > 0);
}

function respond(url, headers) {
  const table = url.pathname.replace("/rest/v1/", "");
  let rows = [...(database[table] ?? [])];
  for (const [key, condition] of url.searchParams) {
    if (!["select", "order", "limit", "offset"].includes(key) && !key.includes(".")) rows = rows.filter((row) => matches(row, key, condition));
  }
  rows = joinInner(rows, table, url);
  const order = url.searchParams.get("order");
  if (order) {
    const column = order.split(".")[0];
    rows.sort((left, right) => (String(left[column]) < String(right[column]) ? -1 : 1));
  }
  const total = rows.length;
  rows = rows.slice(0, Math.min(Number(url.searchParams.get("limit") ?? MAX_ROWS), MAX_ROWS));
  const counted = /count=exact/.test(headers.get("prefer") ?? "");
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "content-type": "application/json", "content-range": `0-${rows.length - 1}/${counted ? total : "*"}` },
  });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const headers = new Headers(init.headers);
  requests.push({ table: url.pathname.replace("/rest/v1/", ""), params: Object.fromEntries(url.searchParams), prefer: headers.get("prefer"), next: init.next });
  const key = `${url.href} ${headers.get("prefer") ?? ""}`;
  if (init.next?.tags?.length && dataCache.has(key)) return dataCache.get(key).clone();
  const response = respond(url, headers);
  if (init.next?.tags?.length) dataCache.set(key, response.clone());
  return response;
};

function reset(tables) {
  for (const key of Object.keys(database)) delete database[key];
  Object.assign(database, structuredClone(tables));
  requests.length = 0;
  dataCache.clear();
}

const PROFILE = TABLES.profiles.find((row) => row.account_type === "individual");
const uuid = (index) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const profile = (index, overrides = {}) => ({ ...PROFILE, id: uuid(index), username: `compte_${index}`, ...overrides });

test("ces lectures tournent en mode Supabase", () => {
  assert.equal(isSupabaseMode(), true);
});

test("une table de plus de 1 000 lignes se lit en entier, par pages que le cache garde chacune", async () => {
  reset({ profiles: Array.from({ length: 1234 }, (_, index) => profile(index)) });
  const rows = await profileRows();
  assert.equal(rows.length, 1234, "la lecture s'est arrêtée au plafond de Supabase");
  assert.equal(new Set(rows.map((row) => row.id)).size, 1234);

  const pages = requests.filter((request) => request.table === "profiles");
  assert.equal(pages.length, 3);
  assert.ok(pages.every((page) => page.params.order === "id.asc" && page.params.limit === "500"));
  assert.deepEqual(pages.map((page) => page.params.id), [undefined, `gt.${uuid(499)}`, `gt.${uuid(999)}`]);
  assert.deepEqual(pages.map((page) => Boolean(page.prefer?.includes("count=exact"))), [true, false, false]);
  assert.ok(pages.every((page) => page.next?.tags?.includes("profiles") && page.next.revalidate === 3600), "une page échappe au cache");
});

test("un compte qui vient de naître retrouve son profil, quand la liste en cache ne l'a pas encore", async () => {
  reset({ profiles: [profile(1)], listings: [] });
  await profileRows();
  database.profiles.push(profile(2, { username: "vient_de_naitre" }));

  assert.equal(await getProfileByUsername("vient_de_naitre"), null, "la liste en cache n'est pas périmée : le test ne vérifie rien");
  const own = await getProfileById(uuid(2));
  assert.equal(own?.username, "vient_de_naitre", "le compte qui vient de naître répond introuvable");
  const read = requests.findLast((request) => request.table === "profiles");
  assert.equal(read?.params.id, `eq.${uuid(2)}`);
  assert.equal(read?.next, undefined, "son propre profil passe par le cache partagé");
});

test("un forfait que le paiement vient d'écrire ouvre l'espace pro tout de suite", async () => {
  reset({ profiles: [profile(1)] });
  await profileRows();
  const next = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  Object.assign(database.profiles[0], { account_type: "pro", company_name: "La Boutique", pro_until: next });
  assert.equal(await isViewerActivePro(uuid(1)), true);
});

test("une vente dont une partie manque à la liste en cache se lit quand même", async () => {
  const deal = TABLES.deals.find((row) => TABLES.conversations.some((conversation) => conversation.id === row.conversation_id));
  assert.ok(deal);
  reset({
    profiles: TABLES.profiles.filter((row) => row.id !== deal.buyer_id),
    listings: TABLES.listings,
    conversations: TABLES.conversations,
    deals: TABLES.deals,
    reviews: TABLES.reviews,
  });
  await profileRows();
  database.profiles.push(structuredClone(TABLES.profiles.find((row) => row.id === deal.buyer_id)));
  const read = await getDealById(deal.id, deal.seller_id);
  assert.equal(read?.buyer.id, deal.buyer_id, "la vente passait pour incomplète");
});

test("les réglages d'alerte se lisent par le chargeur de source.ts", async () => {
  reset({ account_settings: [{ alert_matches: false, alert_messages: true }] });
  assert.deepEqual(await getAlertSettings(), { alertMatches: false, alertMessages: true });
  assert.equal(requests.at(-1)?.table, "account_settings");
});

test("la cloche de l'en-tête se compte en base, sans lire une notification", async () => {
  const viewer = uuid(1);
  const notification = (index, overrides) => ({ id: uuid(100 + index), user_id: viewer, kind: "deal_closed", read_at: null, ...overrides });
  reset({
    notifications: [
      notification(1),
      notification(2),
      notification(3, { read_at: new Date().toISOString() }),
      notification(4, { user_id: uuid(2) }),
    ],
  });
  assert.equal(await getUnreadNotificationCount(viewer), 2);
  assert.equal(requests.length, 1, "la cloche lit plus d'une requête");
  const [read] = requests;
  assert.equal(read.table, "notifications");
  assert.equal(read.params.read_at, "is.null");
  assert.equal(read.params.user_id, `eq.${viewer}`);
  assert.match(read.prefer ?? "", /count=exact/);
});

test("la pastille des messages ne lit que les fils qui ont un message reçu non lu", async () => {
  /* Avant, chaque page d'un compte connecté chargeait toutes ses
     conversations avec tous leurs messages pour en compter les non-lus. */
  const viewer = uuid(1);
  const other = uuid(2);
  const at = (minutes) => new Date(Date.UTC(2026, 9, 1, 12, minutes)).toISOString();
  const thread = (index, overrides = {}) => ({
    id: uuid(200 + index),
    buyer_id: viewer,
    seller_id: other,
    buyer_deleted_at: null,
    seller_deleted_at: null,
    last_message_at: at(30),
    ...overrides,
  });
  const message = (index, threadIndex, overrides = {}) => ({
    id: uuid(300 + index),
    conversation_id: uuid(200 + threadIndex),
    sender_id: other,
    read_at: null,
    created_at: at(30),
    ...overrides,
  });
  reset({
    conversations: [
      thread(1),
      /* Son propre message non lu par l'autre : rien à lire pour elle. */
      thread(2),
      /* Retiré de sa boîte après le dernier message : il ne compte plus. */
      thread(3, { buyer_deleted_at: at(45) }),
      /* Retiré, puis revenu avec un message plus récent. */
      thread(4, { buyer_deleted_at: at(10) }),
      /* Lu. */
      thread(5),
    ],
    messages: [
      message(1, 1),
      message(2, 1),
      message(3, 2, { sender_id: viewer }),
      message(4, 3),
      message(5, 4),
      message(6, 5, { read_at: at(40) }),
    ],
  });
  assert.equal(await getUnreadConversationCount(viewer), 2);
  assert.deepEqual(
    requests.map((request) => request.table),
    ["conversations"],
    "le compteur relit la messagerie",
  );
  const [read] = requests;
  assert.match(read.params.select, /messages!inner\(id\)/);
  assert.doesNotMatch(read.params.select, /messages\(\*\)|body/, "les messages eux-mêmes partent avec le compteur");
  assert.equal(read.params["messages.read_at"], "is.null");
  assert.equal(read.params["messages.sender_id"], `neq.${viewer}`);
  assert.equal(read.params["messages.limit"], "1");
});

test("une colonne qu'une migration n'a pas encore créée fait lever la lecture, au lieu de vider les listes", async () => {
  /* Sans renewed_at (migration 15), chaque annonce passait pour expirée :
     toutes sortaient des listes, sans une erreur nulle part. */
  const withoutRenewal = TABLES.listings.slice(0, 3).map(({ renewed_at: _renewed, ...row }) => row);
  reset({ listings: withoutRenewal });
  await assert.rejects(publicListingRows(), /listings\.renewed_at/);

  /* Une jointure se vérifie comme la table lue : le vendeur, en profiles. */
  const withoutVerification = TABLES.listings.slice(0, 3).map((row) => {
    const { pro_verified_at: _verified, ...seller } = row.seller;
    return { ...row, seller };
  });
  reset({ listings: withoutVerification });
  await assert.rejects(publicListingRows(), /profiles\.pro_verified_at/);

  /* Toutes les colonnes présentes : la lecture passe. */
  reset({ listings: TABLES.listings.slice(0, 3) });
  assert.equal((await publicListingRows()).length, 3);
});
