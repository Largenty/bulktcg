/* Les écritures du chargement, avec la clé de service : la RLS ne la retient
   pas, les déclencheurs si. Chaque étape lit d'abord ce qui est déjà là et
   n'insère que ce qui manque — un déclencheur BEFORE INSERT s'exécute même
   pour une ligne qu'un « on conflict do nothing » écarterait, et celui qui
   fige une annonce vendue refuserait un second passage. */
import { STABLE_PROFILE_FIELDS } from "./plan.mjs";

function fail(operation, error) {
  throw new Error(`${operation} : ${error.message}${error.code ? ` (${String(error.code)})` : ""}`);
}

async function run(operation, request) {
  const { data, error } = await request;
  if (error) fail(operation, error);
  return data;
}

const keyOf = (row, columns) => columns.map((column) => String(row[column])).join("|");

/* N'insère que les lignes absentes, reconnues à leur clé (la première
   colonne sert de filtre). Rend le nombre de lignes ajoutées. L'ordre du
   tableau est celui de l'insertion. */
export async function insertMissing(admin, table, rows, key = ["id"]) {
  if (rows.length === 0) return 0;
  const [filterColumn] = key;
  const values = [...new Set(rows.map((row) => row[filterColumn]))];
  const present = await run(`${table} : lecture`, admin.from(table).select(key.join(",")).in(filterColumn, values));
  const existing = new Set(present.map((row) => keyOf(row, key)));
  const missing = rows.filter((row) => !existing.has(keyOf(row, key)));
  if (missing.length > 0) await run(`${table} : insertion`, admin.from(table).insert(missing));
  return missing.length;
}

async function findAccount(admin, id) {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (data.user) return data.user;
  if (error && error.status !== 404) fail(`compte ${id} : lecture`, error);
  return null;
}

/* Un compte par profil de démonstration, confirmé d'office : le déclencheur
   d'inscription en fait le profil, et le profil ses réglages. Un compte déjà
   là garde le sien — sauf si le mot de passe vient d'être tiré, faute de le
   retrouver dans .env : il reçoit alors le nouveau. */
export async function ensureAccounts(admin, accounts, password, passwordIsNew) {
  const created = new Set();
  for (const account of accounts) {
    if (await findAccount(admin, account.id)) {
      if (passwordIsNew) await run(`compte ${account.email} : mot de passe`, admin.auth.admin.updateUserById(account.id, { password }));
      continue;
    }
    await run(
      `compte ${account.email} : création`,
      admin.auth.admin.createUser({ id: account.id, email: account.email, password, email_confirm: true, user_metadata: account.metadata }),
    );
    created.add(account.id);
  }
  return created;
}

/* Les colonnes que l'inscription ne pose pas. Un profil créé à l'instant, ou
   resté incomplet, les reçoit toutes ; un profil déjà complet n'est pas
   retouché — ses dates, relatives à l'heure du premier chargement, ne
   glissent pas d'un passage à l'autre. */
export async function ensureProfiles(admin, profiles, createdIds) {
  const current = await run(
    "profiles : lecture",
    admin.from("profiles").select(["id", ...STABLE_PROFILE_FIELDS].join(",")).in("id", profiles.map((profile) => profile.id)),
  );
  const byId = new Map(current.map((row) => [row.id, row]));
  let updated = 0;
  for (const profile of profiles) {
    const row = byId.get(profile.id);
    if (!row) throw new Error(`profil ${profile.id} absent : le déclencheur d'inscription ne l'a pas créé`);
    const complete = STABLE_PROFILE_FIELDS.every((field) => row[field] === profile[field]);
    if (complete && !createdIds.has(profile.id)) continue;
    const { id, ...fields } = profile;
    await run(`profil ${id} : mise à jour`, admin.from("profiles").update(fields).eq("id", id));
    updated += 1;
  }
  return updated;
}

/* Finit les annonces nées « Disponible » (derive_listing_display), comme le
   site les aurait vues évoluer :
   - le prix : née au prix d'avant, l'annonce qui a baissé est baissée, et la
     base garde l'ancien prix, comme pour un vendeur ;
   - le statut : « Réservé » pour la personne désignée, ou « Vendu » — et
     count_sale ajoute la vente à l'historique du vendeur ;
   - les vues et la date de mise à jour, en dernier. Chaque mise à jour a daté
     la fiche de l'instant (set_updated_at), sauf celle qui fait bouger les
     vues : une vue comptée n'est pas une modification. C'est donc elle qui
     rend sa date à la fiche.
   Les vues disent qu'une annonce est finie : elle naît sans, et ne les reçoit
   qu'à la dernière étape. Une annonce finie n'est plus touchée — ni par un
   second passage, ni pour défaire ce qu'on y a changé depuis — et un passage
   interrompu reprend où il s'était arrêté. */
export async function finishListings(admin, finishes) {
  const current = await run(
    "listings : lecture",
    admin.from("listings").select("id,price_cents,status,reserved_for,view_count").in("id", finishes.map((target) => target.id)),
  );
  const byId = new Map(current.map((row) => [row.id, row]));
  const counts = { prices: 0, statuses: 0, dates: 0 };
  for (const target of finishes) {
    const row = byId.get(target.id);
    if (!row) throw new Error(`annonce ${target.id} absente avant d'être finie`);
    if (row.view_count === target.view_count) continue;
    const update = (label, fields) => run(`annonce ${target.id} : ${label}`, admin.from("listings").update(fields).eq("id", target.id));
    if (target.previous_price_cents !== null && row.price_cents !== target.price_cents) {
      await update("baisse de prix", { price_cents: target.price_cents });
      counts.prices += 1;
    }
    if (row.status !== target.status || row.reserved_for !== target.reserved_for) {
      await update("statut", target.status === "sold" ? { status: "sold", sold_at: target.sold_at } : { status: target.status, reserved_for: target.reserved_for });
      counts.statuses += 1;
    }
    await update("vues et date", { view_count: target.view_count, updated_at: target.updated_at });
    counts.dates += 1;
  }
  return counts;
}

/* L'avis d'un compte supprimé depuis : le compte, son lot, la conversation,
   la vente et l'avis, puis la suppression du compte — les cascades retirent
   la vente et le lot, et l'avis reste à la personne notée, auteur, vente et
   annonce à null. */
export async function ensureDeletedAccountReviews(admin, entries, throwawayPassword) {
  let replayed = 0;
  for (const entry of entries) {
    const present = await run("reviews : lecture", admin.from("reviews").select("id").eq("id", entry.review.id));
    if (present.length > 0) continue;
    if (!(await findAccount(admin, entry.account.id))) {
      await run(
        "compte supprimé : création",
        admin.auth.admin.createUser({ id: entry.account.id, email: entry.account.email, password: throwawayPassword, email_confirm: true, user_metadata: entry.account.metadata }),
      );
    }
    await insertMissing(admin, "listings", [entry.listing]);
    await insertMissing(admin, "conversations", [entry.conversation]);
    await insertMissing(admin, "deals", [entry.deal]);
    await insertMissing(admin, "reviews", [entry.review]);
    await run("compte supprimé : suppression", admin.auth.admin.deleteUser(entry.account.id));
    const [left] = await run("reviews : vérification", admin.from("reviews").select("reviewer_id,deal_id,listing_id").eq("id", entry.review.id));
    if (!left || left.reviewer_id !== null || left.deal_id !== null || left.listing_id !== null) {
      throw new Error(`avis ${entry.review.id} : la suppression du compte ne l'a pas laissé sans auteur, vente ni annonce`);
    }
    replayed += 1;
  }
  return replayed;
}

/* notify_review signale chaque avis à l'instant de son insertion. Chargé
   d'un coup, chaque avis daterait sa notification d'aujourd'hui : elle
   reprend la date de l'avis, déjà lue — les cloches comptent alors ce
   qu'elles comptaient en démonstration. */
export async function alignReviewNotifications(admin, reviewIds) {
  const reviews = await run("reviews : lecture", admin.from("reviews").select("deal_id,reviewed_id,created_at").in("id", reviewIds));
  let aligned = 0;
  for (const review of reviews.filter((row) => row.deal_id !== null)) {
    const rows = await run(
      "notifications : alignement",
      admin
        .from("notifications")
        .update({ created_at: review.created_at, read_at: review.created_at })
        .eq("user_id", review.reviewed_id)
        .eq("kind", "review_received")
        .eq("deal_id", review.deal_id)
        .neq("created_at", review.created_at)
        .select("id"),
    );
    aligned += rows.length;
  }
  return aligned;
}

/* Retire les comptes de démonstration : les cascades emportent profils,
   réglages, annonces, demandes, conversations, ventes, avis et
   notifications. */
export async function deleteAccounts(admin, ids) {
  let deleted = 0;
  for (const id of ids) {
    if (!(await findAccount(admin, id))) continue;
    await run(`compte ${id} : suppression`, admin.auth.admin.deleteUser(id));
    deleted += 1;
  }
  return deleted;
}

async function countIn(admin, table, column, values) {
  if (values.length === 0) return 0;
  const { count, error } = await admin.from(table).select(column, { count: "exact", head: true }).in(column, values);
  if (error) fail(`${table} : comptage`, error);
  return count ?? 0;
}

/* Ce que la base contient de la démonstration, table par table. */
export async function countDemoRows(admin, plan) {
  const accountIds = plan.accounts.map((account) => account.id);
  const listingIds = plan.listings.map((listing) => listing.id);
  return {
    profiles: await countIn(admin, "profiles", "id", accountIds),
    account_settings: await countIn(admin, "account_settings", "user_id", accountIds),
    listings: await countIn(admin, "listings", "id", listingIds),
    listing_photos: await countIn(admin, "listing_photos", "listing_id", listingIds),
    listing_editions: await countIn(admin, "listing_editions", "listing_id", listingIds),
    listing_tags: await countIn(admin, "listing_tags", "listing_id", listingIds),
    wanted_listings: await countIn(admin, "wanted_listings", "id", plan.wanted.map((row) => row.id)),
    conversations: await countIn(admin, "conversations", "id", plan.conversations.map((row) => row.id)),
    messages: await countIn(admin, "messages", "id", plan.messages.map((row) => row.id)),
    deals: await countIn(admin, "deals", "id", plan.deals.map((row) => row.id)),
    reviews: await countIn(admin, "reviews", "reviewed_id", accountIds),
    listing_waitlist: await countIn(admin, "listing_waitlist", "listing_id", listingIds),
    notifications: await countIn(admin, "notifications", "user_id", accountIds),
  };
}

/* La note et l'historique des ventes que les déclencheurs ont tirés des
   données chargées. */
export async function readProfileStats(admin, ids) {
  return run(
    "profiles : notes",
    admin.from("profiles").select("id,username,rating_avg,rating_count,sold_listing_count").in("id", ids).order("username"),
  );
}

/* Tout le chargement, dans l'ordre du plan (SEED_STEPS) : ce que chaque étape
   a ajouté ou changé. Un second passage rend des zéros partout. */
export async function seedDemo(admin, plan, { password, passwordIsNew, throwawayPassword }) {
  const created = await ensureAccounts(admin, plan.accounts, password, passwordIsNew);
  const profiles = await ensureProfiles(admin, plan.profiles, created);
  const listings = await insertMissing(admin, "listings", plan.listings);
  const editions = await insertMissing(admin, "listing_editions", plan.listingEditions, ["listing_id", "edition_id"]);
  const tags = await insertMissing(admin, "listing_tags", plan.listingTags, ["listing_id", "tag"]);
  const finished = await finishListings(admin, plan.listingFinishes);
  return [
    ["comptes créés", created.size],
    ["profils complétés", profiles],
    ["annonces", listings],
    ["séries d'annonces", editions],
    ["produits d'annonces", tags],
    ["baisses de prix", finished.prices],
    ["réservations et ventes", finished.statuses],
    ["vues et dates rendues", finished.dates],
    ["demandes", await insertMissing(admin, "wanted_listings", plan.wanted)],
    ["conversations", await insertMissing(admin, "conversations", plan.conversations)],
    ["messages", await insertMissing(admin, "messages", plan.messages)],
    ["ventes clôturées", await insertMissing(admin, "deals", plan.deals)],
    ["avis", await insertMissing(admin, "reviews", plan.reviews.map((review) => review.row))],
    ["avis d'un compte supprimé", await ensureDeletedAccountReviews(admin, plan.deletedAccountReviews, throwawayPassword)],
    ["listes d'attente", await insertMissing(admin, "listing_waitlist", plan.waitlist, ["listing_id", "user_id"])],
    ["notifications", await insertMissing(admin, "notifications", plan.notifications)],
    ["notifications d'avis datées", await alignReviewNotifications(admin, plan.reviews.map((review) => review.row.id))],
  ];
}
