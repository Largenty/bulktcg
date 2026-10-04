import assert from "node:assert/strict";
import test from "node:test";
import { declaredColumns, grantedColumns, rows, sql, tableBody, writableColumns } from "./schema.mjs";

/* La sécurité du schéma, lue dans les migrations : la RLS de chaque table,
   les droits de colonnes rendus au rôle connecté, et les fonctions qui voient
   au-delà de sa RLS. Le filtre de lib/data n'est qu'un miroir : c'est la base
   qui tranche. La structure et les colonnes sont dans schema-sync.test.mjs. */

test("une annonce réservée n'est lisible que par son vendeur et les pros actifs", () => {
  /* Le filtre de lib/data n'est qu'un miroir : c'est la base qui tranche.
     Une politique « using (true) » rendrait les lots réservés à n'importe
     quelle requête anonyme, quelle que soit la page. */
  const policy = sql.match(/create policy "[^"]+" on public\.listings for select using \(([\s\S]+?)\);/);
  assert.ok(policy, "politique de lecture des annonces introuvable");
  assert.match(policy[1], /audience = 'everyone'/);
  assert.match(policy[1], /seller_id = auth\.uid\(\)/);
  assert.match(policy[1], /public\.is_active_pro\(auth\.uid\(\)\)/);
  /* Qui en a déjà parlé la garde, même passée « pros » après coup : sa
     conversation y renvoie. Rejoué sur PostgreSQL (supabase/tests). */
  assert.match(policy[1], /exists \(select 1 from public\.conversations c\s+where c\.listing_id = listings\.id and auth\.uid\(\) in \(c\.buyer_id, c\.seller_id\)\)/);
  assert.match(sql, /pro_until > now\(\)/, "is_active_pro ne regarde plus la date du forfait");
  /* Et les tables de liaison suivent l'annonce, au lieu d'être publiques. */
  for (const table of ["listing_photos", "listing_editions", "listing_tags"]) {
    assert.doesNotMatch(sql, new RegExp(`on public\\.${table} for select using \\(true\\)`), `${table} est lisible par tous`);
  }
});

test("personne ne se passe pro depuis son navigateur", () => {
  /* La politique de mise à jour laisse chacun modifier sa ligne : sans
     restriction de colonnes, account_type et pro_until s'écriraient depuis la
     console. Seules les colonnes sans enjeu sont rendues au rôle connecté. */
  assert.match(sql, /revoke insert, update on public\.profiles from anon, authenticated;/);
  const granted = sql.match(/grant update \(([^)]+)\) on public\.profiles to authenticated;/);
  assert.ok(granted, "aucune colonne modifiable déclarée");
  for (const column of [
    "account_type",
    "pro_until",
    "siret",
    "rating_avg",
    "rating_count",
    "punctuality_avg",
    "responsiveness_avg",
    "reliability_avg",
    "sold_listing_count",
  ]) {
    assert.ok(!granted[1].includes(column), `${column} est modifiable par son titulaire`);
  }
  /* La fiche boutique, elle, est à la boutique : sans ces droits, un pro ne
     pourrait pas renseigner ses horaires. Le SIRET reste au service de
     paiement, qui le vérifie. */
  for (const column of ["shop_address", "shop_hours", "shop_website"]) {
    assert.ok(granted[1].includes(column), `${column} n'est pas modifiable par la boutique`);
  }
  assert.match(sql, /constraint profiles_shop_only_for_pros check \(account_type = 'pro' or/);
});

test("un vendeur ne se met ni « À la une » ni « Urgent » sans payer", () => {
  /* La politique de mise à jour laisse le vendeur modifier sa ligne : sans
     droits de colonnes, featured_until et urgent_until s'écriraient depuis
     la console du navigateur. */
  assert.match(sql, /revoke insert, update on public\.listings from anon, authenticated;/);
  for (const [privilege, typeName] of [["insert", "ListingInsert"], ["update", "ListingUpdate"]]) {
    const granted = grantedColumns(privilege);
    assert.deepEqual(granted, writableColumns(typeName), `les droits en ${privilege} ne suivent plus ${typeName}`);
    for (const column of ["featured_until", "urgent_until", "extra_photos", "view_count"]) {
      assert.ok(!granted.includes(column), `${column} est accessible en ${privilege} au vendeur`);
    }
  }
});

test("un avis ne s'écrit que par une partie d'une vente clôturée, sur l'autre", () => {
  /* Une conversation seule suffisait : n'importe qui ayant écrit un message
     pouvait noter un vendeur. */
  const policy = sql.match(/create policy "[^"]+" on public\.reviews for insert with check \(([\s\S]+?)\n\);/);
  assert.ok(policy, "politique d'écriture des avis introuvable");
  assert.match(policy[1], /reviewer_id = auth\.uid\(\)/);
  assert.match(policy[1], /public\.deals/);
  assert.match(policy[1], /auth\.uid\(\) in \(d\.buyer_id, d\.seller_id\)/);
  /* Le navigateur ne désigne jamais la personne notée : la base la déduit
     de la vente, avec son rôle et l'annonce. Les droits d'écriture sont
     exactement ReviewInsert. */
  const granted = sql.match(/grant insert \(([^)]+)\) on public\.reviews to authenticated;/);
  assert.ok(granted, "aucun droit d'écriture déclaré sur les avis");
  const columns = granted[1].split(",").map((column) => column.trim()).sort();
  const declared = rows.match(/export type ReviewInsert = Pick<\s*ReviewRow,\s*([^>]+)>/);
  assert.ok(declared, "ReviewInsert introuvable dans rows.ts");
  assert.deepEqual(columns, [...declared[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]).sort());
  for (const column of ["reviewed_id", "reviewed_role", "listing_id"]) {
    assert.ok(!columns.includes(column), `${column} est fourni par le navigateur`);
  }
  assert.match(sql, /create trigger reviews_stamp before insert on public\.reviews/);
  /* Un avis par personne et par vente, et il ne se modifie pas. */
  assert.match(sql, /unique \(deal_id, reviewer_id\)/);
  assert.doesNotMatch(sql, /grant update \([^)]*\) on public\.reviews/);
});

test("seul le vendeur clôture une vente, et une vente clôturée ne se défait pas", () => {
  /* Aucune écriture directe sur les ventes : close_deal() déduit tout de la
     conversation et n'admet que son vendeur. */
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*on public\.deals to authenticated/);
  assert.match(sql, /revoke insert, update, delete on public\.deals from anon, authenticated;/);
  const close = sql.match(/create or replace function public\.close_deal\([\s\S]+?\n\$\$;/);
  assert.ok(close, "close_deal introuvable");
  assert.match(close[0], /security definer/);
  assert.match(close[0], /seller_id = auth\.uid\(\)/);
  assert.match(close[0], /is_blocked_between/);
  /* Un lot ne se vend qu'une fois, et son annonce ne peut ni repasser
     « Disponible » ni disparaître avec les avis qui s'y rattachent. */
  assert.match(sql, /listing_id uuid not null unique references public\.listings \(id\) on delete restrict/);
  assert.match(sql, /create trigger listings_keep_closed_deal_sold before update of status on public\.listings/);
  /* Le blocage tient dans la base, pas seulement dans l'interface. */
  const messages = sql.match(/create policy "[^"]+" on public\.messages for insert with check \(([\s\S]+?)\n\);/);
  assert.match(messages[1], /is_blocked_between/);
  /* Un signalement n'est lisible que par la modération. */
  assert.doesNotMatch(sql, /on public\.reports for select/);
});

test("seul le vendeur réserve, et jamais entre deux comptes dont l'un a bloqué l'autre", () => {
  /* Audit du front, suite, F7 : close_deal() refusait une vente entre deux
     comptes bloqués, reserve_listing() la réservation non (migration 17).
     La dernière définition est celle que la base garde. */
  const reserve = [...sql.matchAll(/create or replace function public\.reserve_listing\([\s\S]+?\n\$\$;/g)].at(-1);
  assert.ok(reserve, "reserve_listing introuvable");
  assert.match(reserve[0], /security definer/);
  assert.match(reserve[0], /seller_id = auth\.uid\(\)/);
  assert.match(reserve[0], /is_blocked_between\(thread\.seller_id, thread\.buyer_id\)/);
});

test("une annonce dont la vente est clôturée ne se réécrit plus, photos, séries et produits compris", () => {
  /* Audit de sécurité, M4 : réécrite après la vente, l'annonce faisait
     mentir l'avis « lot conforme à l'annonce ». Toute colonne que le vendeur
     peut modifier est figée, sauf le statut, qui a sa propre règle, et la
     date de vente, que close_deal() pose sur un lot déjà « Vendu » d'un
     clic. Une colonne ajoutée aux droits de mise à jour choisit son camp
     ici. Rejoué sur PostgreSQL : supabase/tests/scenarios/06-deals.sql. */
  const freeze = sql.match(/create or replace function public\.freeze_listing_after_deal\(\)[\s\S]+?\n\$\$;/);
  assert.ok(freeze, "freeze_listing_after_deal introuvable");
  const FOLLOWS_ITS_OWN_RULE = new Set(["status", "sold_at"]);
  for (const column of grantedColumns("update").filter((name) => !FOLLOWS_ITS_OWN_RULE.has(name))) {
    assert.match(freeze[0], new RegExp(`new\\.${column}\\b[\\s\\S]+old\\.${column}\\b`), `${column} reste modifiable après la vente`);
  }
  assert.match(sql, /create trigger listings_freeze_after_deal before update on public\.listings/);
  for (const table of ["listing_photos", "listing_editions", "listing_tags"]) {
    assert.match(
      sql,
      new RegExp(`create trigger ${table}_freeze_after_deal before insert or update or delete on public\\.${table}`),
      `${table} reste modifiable après la vente`,
    );
  }
});

test("une note d'échange n'existe pas sans l'échange, et le vendeur écrit les deux", () => {
  assert.match(sql, /constraint listings_trade_note_needs_trade check \(trade_note is null or open_to_trade\)/);
  /* Les droits suivent ListingInsert et ListingUpdate (test plus haut) :
     les deux colonnes y sont, puisque le vendeur les choisit. */
  for (const privilege of ["insert", "update"]) {
    const granted = grantedColumns(privilege);
    assert.ok(granted.includes("open_to_trade") && granted.includes("trade_note"), `échange absent des droits en ${privilege}`);
  }
});

test("un lot passé « pros » après coup se relit, et seul le vendeur ou une boutique y écrit encore", () => {
  const writing = sql.match(/create policy "[^"]+" on public\.messages for insert with check \(([\s\S]+?)\n\);/);
  assert.ok(writing, "politique d'écriture des messages introuvable");
  assert.match(writing[1], /l\.audience = 'pros'\s+and auth\.uid\(\) <> c\.seller_id and not public\.is_active_pro\(auth\.uid\(\)\)/);
});

test("un lot réservé ne se relance plus : seule la personne désignée écrit encore", () => {
  /* Une conversation ne s'ouvre que sur un lot disponible. */
  const opening = sql.match(/create policy "[^"]+" on public\.conversations\s+for insert with check \(([\s\S]+?)\n  \);/);
  assert.ok(opening, "politique d'ouverture des conversations introuvable");
  assert.match(opening[1], /l\.status = 'available'/);
  /* Dans un fil existant, le vendeur et la personne désignée seulement. */
  const messages = sql.match(/create policy "[^"]+" on public\.messages for insert with check \(([\s\S]+?)\n\);/);
  assert.match(messages[1], /l\.status = 'reserved'/);
  assert.match(messages[1], /reserved_for/);
  /* reserved_for ne s'écrit que par reserve_listing(), sur l'autre partie
     d'une conversation du vendeur, et s'efface en quittant « Réservé ». */
  const reserve = sql.match(/create or replace function public\.reserve_listing\([\s\S]+?\n\$\$;/);
  assert.ok(reserve, "reserve_listing introuvable");
  assert.match(reserve[0], /security definer/);
  assert.match(reserve[0], /seller_id = auth\.uid\(\)/);
  assert.match(sql, /create trigger listings_clear_reservation before update of status on public\.listings/);
  assert.match(sql, /constraint listings_reserved_for_matches_status check \(reserved_for is null or status = 'reserved'\)/);
});

test("la liste d'attente est à chacun, et le vendeur n'en lit que le nombre", () => {
  assert.match(sql, /create policy "[^"]+" on public\.listing_waitlist for select using \(user_id = auth\.uid\(\)\);/);
  const joining = sql.match(/create policy "[^"]+" on public\.listing_waitlist for insert with check \(([\s\S]+?)\n\);/);
  assert.ok(joining, "politique d'inscription introuvable");
  assert.match(joining[1], /l\.status = 'reserved'/);
  assert.match(joining[1], /l\.seller_id <> auth\.uid\(\)/);
  const count = sql.match(/create or replace function public\.waitlist_count\([\s\S]+?\n\$\$;/);
  assert.ok(count, "waitlist_count introuvable");
  assert.match(count[0], /l\.seller_id = auth\.uid\(\)/);
  assert.doesNotMatch(count[0], /username/);
  /* Tous les inscrits sont prévenus en même temps, puis la liste se vide. */
  const notify = sql.match(/create or replace function public\.notify_waitlist\([\s\S]+?\n\$\$;/);
  assert.match(notify[0], /old\.status = 'reserved' and new\.status = 'available'/);
  assert.match(notify[0], /select user_id, 'listing_available'/);
  assert.match(notify[0], /delete from public\.listing_waitlist/);
});

test("une notification ne s'écrit jamais depuis le navigateur, et ne se lit que par son destinataire", () => {
  assert.match(sql, /revoke insert, update, delete on public\.notifications from anon, authenticated;/);
  assert.match(sql, /grant update \(read_at\) on public\.notifications to authenticated;/);
  assert.doesNotMatch(sql, /grant insert[^;]*on public\.notifications/);
  assert.match(sql, /on public\.notifications for select using \(user_id = auth\.uid\(\)\)/);
  /* Chaque sorte a sa source : la liste d'attente, la clôture, l'avis. */
  assert.match(sql, /create trigger listings_notify_waitlist after update of status on public\.listings/);
  assert.match(sql, /create trigger reviews_notify after insert on public\.reviews/);
  const close = sql.match(/create or replace function public\.close_deal\([\s\S]+?\n\$\$;/);
  assert.match(close[0], /'deal_closed'/);
});

test("toutes les tables ont la sécurité au niveau des lignes activée", () => {
  const tables = [...sql.matchAll(/create table public\.([a-z_]+) \(/g)].map((match) => match[1]);
  const protectedTables = new Set(
    [...sql.matchAll(/alter table public\.([a-z_]+) enable row level security;/g)].map((match) => match[1]),
  );
  assert.deepEqual(tables.filter((table) => !protectedTables.has(table)), []);
});

test("une photo vient des téléversements de son vendeur, que le serveur seul inscrit", () => {
  /* Les photos vivent chez Cloudflare. Cloudflare Images tire lui-même
     l'identifiant d'une image privée : aucun préfixe de chemin ne peut dire à
     qui elle appartient, c'est le registre qui le dit. Rejoué sur
     PostgreSQL : supabase/tests/scenarios/03-photos.sql. */
  /* Restrict : le ménage ne retire pas un fichier encore affiché. Cascade à
     la mise à jour : quand Cloudflare rend un autre identifiant à une image
     qui change de visibilité, les photos suivent la clé remplacée. */
  assert.match(tableBody("listing_photos"), /storage_path text not null references public\.photo_uploads \(key\) on delete restrict on update cascade,/);
  /* Un fichier, une photo : la clé que Cloudflare rend en changeant la
     visibilité d'un fichier ne touche qu'une annonce, jamais une annonce
     vendue et figée avec elle. */
  assert.match(tableBody("listing_photos"), /constraint listing_photos_one_photo_per_file unique \(storage_path\)/);
  const policy = sql.match(/create policy "[^"]+" on public\.listing_photos for all[\s\S]+?\);\n/);
  assert.ok(policy, "politique d'écriture des photos introuvable");
  assert.match(policy[0], /public\.photo_uploads u where u\.key = storage_path and u\.owner_id = auth\.uid\(\)/);
  /* La RLS ne retient pas la clé de service, qui accroche les photos 4 à 8
     après le paiement : un déclencheur tient la même règle pour tous les
     rôles, sur le fichier comme sur l'annonce qui le reçoit. Relecture
     Cloudflare, F1. */
  const check = sql.match(/create or replace function public\.check_photo_upload\(\)[\s\S]+?\n\$\$;/);
  assert.ok(check, "check_photo_upload introuvable");
  assert.match(check[0], /security definer set search_path = public/);
  assert.match(check[0], /upload\.owner_id is distinct from \(select l\.seller_id from public\.listings l where l\.id = new\.listing_id\)/);
  assert.match(sql, /create trigger listing_photos_check_upload before insert or update of storage_path, listing_id on public\.listing_photos/);
  /* Un compte qui s'inscrirait lui-même un téléversement pourrait y
     déclarer l'image d'un autre ; un anonyme n'a rien à y lire. */
  assert.match(sql, /revoke all on public\.photo_uploads from anon;/);
  assert.match(sql, /revoke insert, update, delete on public\.photo_uploads from authenticated;/);
  assert.doesNotMatch(sql, /grant [^;]*on public\.photo_uploads to (anon|authenticated)/);
  assert.match(sql, /on public\.photo_uploads\s+for select using \(owner_id = auth\.uid\(\)\);/);
  /* Le fichier survit à la suppression d'un compte, le temps du ménage : la
     cascade n'atteint pas Cloudflare. */
  assert.match(tableBody("photo_uploads"), /owner_id uuid references public\.profiles \(id\) on delete set null,/);
  /* Plus rien de Supabase Storage : un bucket oublié serait public. */
  assert.doesNotMatch(sql, /storage\.(objects|buckets)/);
});

test("le ménage ne prend qu'un fichier qu'aucune photo n'affiche, et plus rien ne l'accroche ensuite", () => {
  /* Rejoué sur PostgreSQL : supabase/tests/scenarios/11-photo-purge.sql.
     PGlite n'a qu'une connexion : ce qui ne tient que sous la concurrence —
     verrous, relecture, instantané — se vérifie ici, dans le texte. */
  const claim = sql.match(/create or replace function public\.claim_photo_purge\([\s\S]+?\n\$\$;/);
  assert.ok(claim, "claim_photo_purge introuvable");
  assert.match(claim[0], /security definer set search_path = public/);
  /* Jamais un fichier affiché : écarté à la sélection, puis relu sous le
     verrou — une photo accrochée entre les deux garde son fichier. Deux
     passages simultanés ne prennent pas le même fichier, reprises
     comprises. */
  assert.match(claim[0], /and not exists \(select 1 from public\.listing_photos p where p\.storage_path = u\.key\)/);
  assert.equal(claim[0].match(/for update of u skip locked/g)?.length, 2, "les deux sélections ne sautent pas les lignes verrouillées");
  assert.match(claim[0], /if not exists \(select 1 from public\.listing_photos p where p\.storage_path = candidate\) then/);
  assert.equal(claim[0].match(/set purge_started_at = now\(\)/g)?.length, 2, "une reprise n'est pas remise en fin de file");
  /* La relecture ne voit la photo d'un autre qu'avec un instantané neuf à
     chaque instruction (F7). */
  assert.match(claim[0], /if current_setting\('transaction_isolation'\) <> 'read committed' then\s+raise exception/);
  /* Il rend les fichiers de tous les comptes, en efface le registre et tient
     un bail : la clé de service seule. */
  for (const signature of ["claim_photo_purge\\(uuid, integer\\)", "release_photo_purge\\(uuid\\)", "forget_purged_photos\\(text\\[\\]\\)"]) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${signature} from public, anon, authenticated;`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature} to service_role;`));
  }
  assert.match(sql, /revoke all on public\.photo_purge_lease from anon, authenticated;/);
  /* Un seul passage à la fois : le bail se prend dans la même instruction
     qu'il se vérifie ailleurs — deux passages simultanés se départagent sur
     sa clé primaire, et le second est refusé. */
  assert.match(claim[0], /insert into public\.photo_purge_lease as lease[\s\S]+on conflict \(singleton\) do update[\s\S]+where lease\.expires_at < now\(\);/);
  assert.match(claim[0], /raise exception 'un autre passage du ménage est en cours' using errcode = '55P03';/);
  const forget = sql.match(/create or replace function public\.forget_purged_photos\([\s\S]+?\n\$\$;/);
  assert.ok(forget, "forget_purged_photos introuvable");
  assert.match(forget[0], /security definer set search_path = public/);
  assert.match(forget[0], /where key = any \(file_keys\) and purge_started_at is not null/);
  /* Le registre date lui-même le décrochage, cascades comprises, et refuse
     d'accrocher un fichier pris — même à la clé de service, que la RLS ne
     retient pas. Le verrou partagé attend un ménage en cours. */
  assert.match(sql, /create trigger listing_photos_track_upload after insert or update of storage_path or delete on public\.listing_photos/);
  const check = sql.match(/create or replace function public\.check_photo_upload\(\)[\s\S]+?\n\$\$;/);
  assert.ok(check, "check_photo_upload introuvable");
  assert.match(check[0], /where key = new\.storage_path for share;/);
  assert.match(check[0], /if upload\.purge_started_at is not null then/);
  /* Le fichier décroché est verrouillé avant d'être daté : une photo qui le
     reprend au même moment n'y laisse pas une date de retrait (F4). */
  const track = sql.match(/create or replace function public\.track_photo_upload_use\(\)[\s\S]+?\n\$\$;/);
  assert.ok(track, "track_photo_upload_use introuvable");
  const lock = track[0].indexOf("perform 1 from public.photo_uploads where key = released for update;");
  assert.ok(lock > 0 && lock < track[0].indexOf("set detached_at = now()"), "le fichier n'est pas verrouillé avant d'être daté");
});

test("une conversation s'ouvre avec le vendeur de l'annonce, qui ne démarche pas", () => {
  const opening = sql.match(/create policy "[^"]+" on public\.conversations\s+for insert with check \(([\s\S]+?)\n  \);/);
  assert.match(opening[1], /l\.seller_id = conversations\.seller_id/);
  assert.match(opening[1], /w\.status = 'open' and w\.game_id = l\.game_id/);
  /* Audit de sécurité, M6 : un vendeur proposait son lot réservé aux pros
     à un particulier, qui recevait un fil sur une annonce illisible pour
     lui. Rejoué sur PostgreSQL : supabase/tests/scenarios/05-conversations.sql. */
  assert.match(opening[1], /l\.audience = 'everyone' or public\.is_active_pro\(conversations\.buyer_id\)/);
  /* Et personne ne sonde qui bloque qui entre deux autres comptes. */
  const blocked = sql.match(/create or replace function public\.is_blocked_between\([\s\S]+?\n\$\$;/);
  assert.match(blocked[0], /auth\.uid\(\) in \(first_user, second_user\)/);
});

test("chaque écriture directe n'a que les colonnes que l'application envoie", () => {
  /* Comme pour les annonces : sans droits de colonnes, un acheteur rajeunirait
     sa demande, un message naîtrait lu, un signalement déjà traité, et le
     destinataire d'un message en réécrirait le texte. */
  for (const [privilege, table, typeName] of [
    ["insert", "wanted_listings", "WantedInsert"], ["update", "wanted_listings", "WantedUpdate"],
    ["insert", "conversations", "ConversationInsert"], ["insert", "messages", "MessageInsert"],
    ["insert", "blocks", "BlockInsert"], ["insert", "reports", "ReportInsert"],
    ["update", "account_settings", "AccountSettingsUpdate"],
  ]) {
    assert.match(sql, new RegExp(`revoke [a-z, ]*${privilege}[a-z, ]* on public\\.${table} from anon, authenticated;`), `${privilege} ouvert sur ${table}`);
    assert.deepEqual(grantedColumns(privilege, table), declaredColumns(typeName), `${table} ne suit plus ${typeName}`);
  }
  assert.match(sql, /revoke insert, update on public\.messages from anon, authenticated;/);
  assert.match(sql, /grant update \(read_at\) on public\.messages to authenticated;/);
});

test("les lots réservés se comptent sans se montrer, et les vues ne se gonflent pas", () => {
  const counts = sql.match(/create or replace function public\.pro_only_count_by_game\(\)[\s\S]+?\n\$\$;/);
  assert.ok(counts, "pro_only_count_by_game introuvable");
  assert.match(counts[0], /security definer/);
  assert.doesNotMatch(counts[0], /title|price|slug/);
  assert.match(sql, /revoke execute on function public\.record_listing_view\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.record_listing_view\(uuid\) to service_role;/);
});

test("les réglages d'alerte ne regardent que leur titulaire, qui ne les crée pas", () => {
  assert.match(sql, /on public\.account_settings for select using \(user_id = auth\.uid\(\)\)/);
  assert.match(sql, /revoke insert, update, delete on public\.account_settings from anon, authenticated;/);
  assert.match(sql, /create trigger profiles_create_settings after insert on public\.profiles/);
});

test("un signalement vise ce qu'on peut lire, et jamais soi-même", () => {
  const check = sql.match(/create or replace function public\.check_report_target\(\)[\s\S]+?\n\$\$;/);
  assert.ok(check, "check_report_target introuvable");
  assert.doesNotMatch(check[0], /security definer/, "la cible doit se lire sous la RLS de celui qui signale");
  assert.match(check[0], /owner_id = new\.reporter_id/);
  assert.match(sql, /create trigger reports_check_target before insert on public\.reports/);
});

test("le dépôt, la modification et l'ouverture d'un fil passent sous la RLS du rôle connecté, seul à les exécuter", () => {
  /* security definer, ces fonctions passeraient outre la RLS : un compte
     déposerait au nom d'un autre, ou ouvrirait un fil sur un lot réservé. */
  for (const [name, signature] of [["create_listing", "jsonb"], ["update_listing", "uuid, jsonb"], ["open_conversation", "uuid, uuid, uuid, text"]]) {
    const definition = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]+?\\n\\$\\$;`));
    assert.ok(definition, `${name} introuvable`);
    assert.match(definition[0], /language plpgsql security invoker/, `${name} passerait outre la RLS`);
    assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\(${signature}\\) from public, anon;`), `${name} ouverte aux visiteurs`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(${signature}\\) to authenticated;`), `${name} fermée au rôle connecté`);
  }
  /* Un double envoi retombe sur l'annonce du vendeur connecté, et sur
     aucune autre, sans se dire créé ; les photos attendent la phase 3. */
  const create = sql.match(/create or replace function public\.create_listing\([\s\S]+?\n\$\$;/)[0];
  assert.match(create, /returns table \(permalink text, created boolean\)/);
  assert.match(create, /on conflict \(id\) do nothing/);
  assert.match(create, /return query select l\.slug, false from public\.listings l where l\.id = draft\.id and l\.seller_id = auth\.uid\(\)/);
  for (const name of ["create_listing", "update_listing"]) {
    const definition = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]+?\\n\\$\\$;`))[0];
    assert.match(definition, /les photos arrivent avec la phase 3/, `${name} accepterait des photos qu'aucun stockage ne garde`);
  }
});

/* La dernière définition d'une fonction ou d'une politique : une migration
   plus récente la remplace (create or replace, drop puis create), et c'est
   celle-là que la base applique. */
function lastMatch(pattern) {
  const found = [...sql.matchAll(pattern)].at(-1);
  assert.ok(found, `${pattern} introuvable`);
  return found;
}

test("un vendeur ne repousse pas son échéance ni ne se remonte sans payer, et seul lui prolonge son annonce", () => {
  /* Hors des droits du rôle connecté : renewed_at se pose par un geste du
     vendeur ou par renew_listing, les dates de la remontée par le service de
     paiement. Rejoué sur PostgreSQL : 14-listing-lifecycle.sql. */
  for (const privilege of ["insert", "update"]) {
    const granted = grantedColumns(privilege);
    for (const column of ["renewed_at", "bump_started_at", "bump_until"]) {
      assert.ok(!granted.includes(column), `${column} est accessible en ${privilege} au vendeur`);
    }
  }
  const renew = lastMatch(/create or replace function public\.renew_listing\([\s\S]+?\n\$\$;/g)[0];
  assert.match(renew, /security definer/);
  assert.match(renew, /where id = listing and seller_id = auth\.uid\(\) and status <> 'sold'/);
  assert.match(sql, /revoke execute on function public\.renew_listing\(uuid\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.renew_listing\(uuid\) to authenticated;/);
  /* Tout geste du vendeur la relance — lui seul : ni une vue comptée, ni le
     paiement, ni la tâche quotidienne. */
  const activity = lastMatch(/create or replace function public\.renew_on_seller_activity\(\)[\s\S]+?\n\$\$;/g)[0];
  assert.match(activity, /if auth\.uid\(\) = new\.seller_id then\s+new\.renewed_at := now\(\);/);
  assert.match(sql, /create trigger listings_renew_on_activity before update on public\.listings/);
});

test("une annonce expirée ne reçoit plus ni conversation ni inscription, et ne se compte plus dans l'espace pro", () => {
  const opening = lastMatch(/create policy "conversation ouverte par un participant" on public\.conversations\s+for insert with check \(([\s\S]+?)\n  \);/g);
  assert.match(opening[1], /l\.status = 'available'[\s\S]*public\.listing_on_market\(l\)/);
  /* La politique remplacée garde tout ce qu'elle tenait. */
  assert.match(opening[1], /l\.audience = 'everyone' or public\.is_active_pro\(conversations\.buyer_id\)/);
  assert.match(opening[1], /not public\.is_blocked_between\(buyer_id, seller_id\)/);
  const waitlist = lastMatch(/create policy "inscription sur le lot réservé d'un autre" on public\.listing_waitlist for insert with check \(([\s\S]+?)\n\);/g);
  assert.match(waitlist[1], /l\.status = 'reserved' and l\.seller_id <> auth\.uid\(\)\s+and public\.listing_on_market\(l\)/);
  const counts = lastMatch(/create or replace function public\.pro_only_count_by_game\(\)[\s\S]+?\n\$\$;/g)[0];
  assert.match(counts, /l\.audience = 'pros' and public\.listing_on_market\(l\)/);
});

test("l'archivage ne retire que des photos, et la tâche quotidienne ne se lance qu'avec la clé de service", () => {
  /* Une vente clôturée reste figée — texte, prix, séries, produits — ; seule
     la suppression de ses photos, une fois archivée, passe. */
  const freeze = lastMatch(/create or replace function public\.freeze_listing_parts_after_deal\(\)[\s\S]+?\n\$\$;/g)[0];
  assert.match(freeze, /if tg_op = 'DELETE' and tg_table_name = 'listing_photos'\s+and exists \(select 1 from public\.listings l where l\.id = old\.listing_id and public\.listing_archived\(l\)\) then\s+return old;/);
  assert.match(freeze, /raise exception 'vente clôturée : l''annonce reste telle qu''elle a été vendue'/);
  const job = lastMatch(/create or replace function public\.run_listing_lifecycle\(\)[\s\S]+?\n\$\$;/g)[0];
  /* Un signalement ouvert garde les photos : elles sont la pièce du dossier. */
  assert.match(job, /r\.target_type = 'listing' and r\.target_id = l\.id and r\.resolved_at is null/);
  /* Une seule fois par mise en ligne : prolongée, l'annonce sera prévenue
     de nouveau à sa prochaine échéance, pas avant. */
  assert.match(job, /n\.kind = 'listing_expiring' and n\.listing_id = l\.id and n\.created_at >= l\.renewed_at/);
  assert.match(job, /pg_advisory_xact_lock/);
  assert.match(sql, /revoke execute on function public\.run_listing_lifecycle\(\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.run_listing_lifecycle\(\) to service_role;/);
});

test("le statut professionnel ne s'écrit qu'après vérification, et la boutique ne déclare que ses liens", () => {
  /* account_type, siret, legal_name et pro_verified_at : la clé de service
     seule, après la vérification du SIRET (declareProStatus). Les profils
     de places de marché, la boutique elle-même. */
  const granted = [...sql.matchAll(/grant update \(([^)]+)\) on public\.profiles to authenticated;/g)]
    .flatMap((grant) => grant[1].split(",").map((column) => column.trim()));
  for (const column of ["account_type", "siret", "legal_name", "pro_verified_at", "pro_until"]) {
    assert.ok(!granted.includes(column), `${column} est modifiable par son titulaire`);
  }
  for (const column of ["cardmarket_url", "cardnexus_url"]) assert.ok(granted.includes(column), `${column} n'est pas modifiable par la boutique`);
  /* Un SIRET, un compte ; le forfait suppose le statut ; un particulier n'a
     ni raison sociale ni profils déclarés. */
  assert.match(sql, /create unique index profiles_one_account_per_siret on public\.profiles \(siret\) where siret is not null;/);
  assert.match(tableBody("profiles"), /constraint profiles_plan_needs_pro check \(pro_until is null or account_type = 'pro'\)/);
  assert.match(tableBody("profiles"), /constraint profiles_pro_details_only_for_pros check \(\s*account_type = 'pro' or \(legal_name is null and pro_verified_at is null and cardmarket_url is null and cardnexus_url is null\)/);
  /* Repasser en particulier : soi-même, jamais avec un forfait en cours. */
  const leave = lastMatch(/create or replace function public\.leave_pro_status\(\)[\s\S]+?\n\$\$;/g)[0];
  assert.match(leave, /security definer/);
  assert.match(leave, /where id = auth\.uid\(\) for update/);
  assert.match(leave, /me\.pro_until is not null and me\.pro_until > now\(\)/);
  assert.match(sql, /revoke execute on function public\.leave_pro_status\(\) from public, anon;/);
  /* L'accès aux lots réservés reste au forfait, pas au statut. */
  assert.match(lastMatch(/create or replace function public\.is_active_pro\(uid uuid\)[\s\S]+?\n\$\$;/g)[0], /account_type = 'pro' and pro_until > now\(\)/);
});
