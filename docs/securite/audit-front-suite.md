# Audit de sécurité du front — suite

Suite de [`audit-front.md`](audit-front.md) : constats faibles et informatifs, ce qui est déjà
bien protégé, ce qui n'a pas pu être vérifié, et les points de base de données à transmettre
à la modélisation. Mêmes conventions : gravité, état, numéros de ligne relevés le 30 septembre
2026 entre 11 h 15 et 11 h 50.

## Constats faibles

### F1 — `suivant` n'est pas consommé aujourd'hui, et devra être validé

**Faible · latent.** `src/lib/data/session.ts:25-28` produit `/connexion?suivant=<chemin
encodé>` ; `src/app/connexion/page.tsx` ne lit pas le paramètre. Vérifié :
`/connexion?suivant=https%3A%2F%2Fevil.example%2F` n'apparaît que dans l'état du routeur,
échappé. Il n'y a donc pas de redirection ouverte — ni de retour après connexion.

Le risque arrive avec la page de connexion de la phase 2 et la route `/auth/callback`
(`supabase/README.md:96-97`, § 3) : `redirect(suivant)` ou la concaténation
`${origin}${next}` des exemples courants laissent passer `//evil.example`,
`/\evil.example`, ou `@evil.example` (collé à l'origine : `https://bulktcg.fr@evil.example`).
L'utilisateur fraîchement connecté atterrit sur un faux site qui lui redemande son mot de
passe.

**Correction.** Un seul `safeReturnPath(value, fallback = "/mon-compte")` dans `src/lib/` :
refuser ce qui ne commence pas par « / » ou commence par « // » ou « /\ », puis
`new URL(value, base)` dont l'origine doit être `base`, et rendre
`pathname + search + hash`. (Vérifié avec Node : `new URL("/\t/evil.example", base)` a
l'origine d'evil.example — le test d'origine est indispensable, le préfixe seul ne suffit
pas.) Les chemins de retour construits avec un paramètre brut — `src/app/deposer/page.tsx:24`
(`?pour=`), `src/app/messages/nouveau/page.tsx:23` — encodent leur valeur.

**Test.** Table de cas : `https://evil.example`, `//evil.example`, `/\evil.example`,
`/\t/evil.example`, `@evil.example`, `javascript:alert(1)` refusés ; `/mon-compte?x=1#y`
accepté.

### F2 — Mot de passe, e-mail et suppression du compte sans réauthentification

**Faible · latent** (conception de la phase 2). `src/app/mon-compte/parametres/page.tsx:39-46` :
« Nouveau mot de passe — Laissez vide pour conserver le mot de passe actuel », aucun champ
« mot de passe actuel » ; `:94` : `DeleteAction` → `deleteAccountAction`
(`src/app/actions/profile.ts:21-25`), sans argument ni preuve de présence. Une session volée
(E1) ou un poste partagé resté ouvert suffisent pour changer le mot de passe, l'e-mail, ou
supprimer le compte : la prise de contrôle devient définitive.

**Correction.** Mot de passe actuel, ou `supabase.auth.reauthenticate()` et son code, pour
changer le mot de passe ; « Secure email change » (confirmation sur les deux adresses) laissé
actif dans le tableau de bord ; `deleteAccount` exige une authentification récente.
**Test.** `deleteAccount` sans authentification récente rend `unauthenticated`.

### F3 — Pseudos : changement libre, recyclage, aucun nom réservé

**Faible · latent.** `src/lib/schemas/profile-form.ts:8-12` ne contrôle que la forme ;
`src/lib/data/profile-mutations.ts:28-35` réécrit le pseudo à chaque enregistrement ;
`src/app/mon-compte/parametres/page.tsx:97` : « Le pseudo est libéré ». Un compte prend
`bulktcg`, `support` ou `moderation` et écrit « Le service BulkTCG doit vérifier votre
annonce ». Ou il attend qu'un vendeur réputé supprime son compte, reprend son pseudo, et
republie ses anciennes photos : le filigrane `@pseudo` — la ligne de crédit posée sur la
photo — correspond de nouveau, alors que `/securite` le présente comme la preuve qu'une photo n'est
pas reprise.

**Correction.** Liste de pseudos réservés (marque, rôles, routes du site) ; pseudo retiré gelé
douze mois ; changement limité (une fois par 30 jours) et historique affiché
(« anciennement … ») ; comparaison qui ignore points et tirets et confond `l`/`1`, `o`/`0`.
**Test.** `bulktcg`, `support` et `b.u.l.k.t.c.g` refusés ; un pseudo retiré ne se reprend pas.

### F4 — Bornes numériques, doublons, identifiants : des erreurs SQL au lieu de refus

**Faible · latent.**
* `src/lib/decimal.ts:4` : `Number()` accepte `0x10`, `0b11`, `1e3`.
* `src/lib/schemas/fields.ts:22-33` (`optionalPositiveNumber`) : aucun plafond — nombre de
  cartes et volume minimum (`integer` en base), poids (`numeric(6,2)`, donc 9 999,99 au plus),
  budget d'une demande (`integer` en centimes).
* `src/lib/schemas/wanted-form.ts:20-26` : `maxDistanceKm` accepte 5,5 ; la colonne est
  entière.
* `src/lib/schemas/listing-form.ts:57` : `tags` sans maximum ni dédoublonnage (clé primaire
  `(listing_id, tag)` en base) ; `editions` accepte les doublons.
* `src/lib/listing-query.ts:84-88` : `?page=1e21` accepté ; `:44-48` : `?rayon=` sans plafond.
* Les identifiants ne sont que `z.string().min(1).max(64)` (par exemple
  `src/app/actions/listings.ts:22`), et `listingId` / `wantedId` de `submitListing` /
  `submitWanted` (`src/app/actions/listings.ts:29`, `src/app/actions/wanted.ts:23`) ne
  passent même pas par ce schéma.

En phase 2, chacune de ces entrées part en requête et revient en erreur Postgres (22003,
23505, 22P02) : une page d'erreur au lieu d'un message sous le champ.

**Preuve.** Script `/tmp` : `listingFormSchema` accepte `priceEuros "0x10"` (16 €),
`cardCount "1e20"`, `weightKg "1e300"`, 5 000 fois `tags=booster-box` et trois fois la même
série ; `wantedFormSchema` accepte `maxPriceEuros "1e300"`, `minCardCount "1e20"`,
`maxDistanceKm "5.5"`.

**Correction.** `parseDecimal` n'accepte que `/^\d+([.,]\d+)?$/` ; plafonds alignés sur la
base (cartes ≤ 1 000 000, poids ≤ 9 999,99 à deux décimales, budget ≤ 5 000 € comme le prix,
distance entière) ; `tags` bornés au nombre de produits et sans doublon, `editions` sans
doublon ; `z.uuid()` à la bascule, pour tous les identifiants ; `page` ramenée au nombre de
pages, `rayon` pris dans `RADIUS_OPTIONS_KM`.
**Test.** Chaque valeur ci-dessus refusée avec son message ; `page=1e21` retombe à 1.

### F5 — Une référence `storage:` d'un autre compte passe la couche données

**Faible · actif** (la base refuse en phase 2). `src/lib/photo-refs.ts:11-15` annonce que « la
propriété du dossier se vérifie côté couche données », mais `findForeignPhotoRefs` (`:29-32`),
appelé par `src/lib/data/listing-mutations.ts:44` et `:92`, ne contrôle que les URL
`https://`. Script `/tmp` : `createListing({ …, photos: ["storage:u-99/photo-volee.jpg"] })`
rend `not-persisted`. La politique « photos écrites par le vendeur »
(`20260929120900_security.sql:109-114`) refusera — par une erreur SQL, là où la couche promet
une réponse lisible (`listing-mutations.ts:27-29`).

**Correction.** `findForeignPhotoRefs(refs, ownUrls, ownerId)` signale aussi toute référence
`storage:` dont le premier segment n'est pas `ownerId`.
**Test.** « Une photo du dossier d'un autre compte est refusée » (photo-files et mutations).

### F6 — L'autorisation des conversations est laissée aux appelants

**Faible · actif.** `src/lib/data/conversations.ts:33-38` : `getConversationById` rend la
conversation quel que soit `viewerId` ; `:40-46` : `getMessages(conversationId)` ne prend
même pas de lecteur. Chaque appelant refait le test de participation
(`src/app/messages/[conversationId]/page.tsx:32-33`, `src/app/signaler/page.tsx:41-42`,
`conversation-mutations.ts:20`, `message-mutations.ts:107`, `deal-mutations.ts:19`,
`waitlist-mutations.ts:48`) : aucune fuite aujourd'hui. Mais `getDealById` filtre déjà par
partie (`src/lib/data/deals.ts:47-50`), et le guide de Next place ce contrôle dans la couche
d'accès (`data-security.md`, « Data Access Layer … Perform authorization checks ») : le prochain
appelant qui l'oublie lira les messages des autres.

**Correction.** `getConversationById` rend `null` à qui n'est pas participant ;
`getMessages(conversationId, viewerId)` de même.
**Test.** Un non-participant lit `null` et aucun message.

### F7 — Le blocage est ignoré par la couche données et par `reserve_listing()`

**Faible · latent.** Aucune lecture des blocages dans `src/lib/data/` ni dans les données de
démonstration : `contactSeller`, `proposeListing`, `sendMessage` (`message-mutations.ts`) et
`reserveForBuyer` (`waitlist-mutations.ts:44-54`) ne le consultent pas. En phase 2, la RLS
refuse les messages — par une erreur SQL — mais `reserve_listing()`
(`20260929120700_reservations_notifications.sql:12-25`) ne vérifie pas
`is_blocked_between`, contrairement à `close_deal()` : un vendeur peut réserver un lot pour
quelqu'un qui l'a bloqué.

**Correction.** Une lecture `isBlockedBetween(a, b)` dans la couche données, appelée par les
quatre écritures ; `reserve_listing()` lève comme `close_deal()`.
**Test.** Écrire, proposer ou réserver entre deux comptes bloqués rend `invalid` ;
schema-security : `reserve_listing` appelle `is_blocked_between`.
**État au 4 octobre 2026.** La base est réglée : `reserve_listing()` lève comme
`close_deal()` (migration 17), schema-security le vérifie et un scénario PostgreSQL le
rejoue. La couche données, elle, ne lit toujours pas les blocages : un envoi refusé par la
base s'affiche « introuvable » plutôt qu'avec sa raison.

### F8 — Site d'une boutique : `https://` est bien exigé, l'affichage peut tromper

**Faible · actif.** `src/lib/schemas/profile-form.ts:30-35` (`/^https:\/\/\S+$/`) et la base
(`20260929120200_profiles.sql:36`) exigent `https://` ; React 19 bloque de toute façon les URL
`javascript:`. Script `/tmp` : `javascript:`, `JAVASCRIPT:`, ` javascript:`, `data:` et
`http:` sont refusés. Sont acceptés `https://аpple.com` (le premier « а » est cyrillique,
U+0430) et `https://boutique.example/` suivi du caractère U+202E puis `gpj.exe` (inversion
bidi, qui s'affiche « …/exe.gpj »), que `ShopDetails.tsx:17-19` affiche tels quels via
`formatWebsite` (`src/lib/format.ts:103-105`).

**Correction.** Analyser avec `new URL()`, exiger `protocol === "https:"` et un nom d'hôte à
point, afficher `url.hostname` — la forme punycode (`xn--pple-43d.com`, vérifié) — plutôt que
la chaîne saisie ; refuser U+202A–U+202E et U+2066–U+2069 ; ajouter `noreferrer` au lien.
**Test.** La chaîne bidi est refusée ; `formatWebsite("https://аpple.com")` rend le punycode.

### F9 — `resolvePhotoUrl` et l'image de partage acceptent toute URL absolue

**Faible · latent.** `src/lib/data/mappers/shared.ts:41-48` rend tel quel un `storage_path`
qui commence par `http(s)` (utile en phase 1 pour Unsplash) ; `src/lib/og-fonts.ts:60-72`
(`loadOpenGraphPhoto`) le télécharge côté serveur sans liste d'hôtes, sans délai, sans taille
maximale. La base empêche aujourd'hui un `storage_path` en URL (`security.sql:113`) : rien
d'exploitable. Mais une écriture faite avec la clé de service — la fonction `create_listing`
suggérée, un import, un script de reprise — ne passe pas par cette politique ; l'image de
partage ferait alors une requête serveur vers l'adresse choisie (réseau interne, métadonnées
de l'hébergeur) et `next/image` lèverait sur l'hôte inconnu.

**Correction.** En phase 2, `resolvePhotoUrl` refuse toute URL qui ne commence pas par
`NEXT_PUBLIC_PHOTOS_URL` (plus Unsplash tant que la démonstration existe) ;
`loadOpenGraphPhoto` vérifie l'hôte contre la même liste, pose `AbortSignal.timeout(3000)` et
abandonne au-delà de 10 Mo.
**Test.** `resolvePhotoUrl("https://169.254.169.254/x")` rend `null` ; une URL hors liste ne
déclenche aucune requête (fetch simulé).

### F10 — Le plan de site publie le profil de chaque compte

**Faible · actif.** `src/app/sitemap.ts:42-47` déclare `getAllUsernames()`
(`src/lib/data/profiles.ts:29-31`), soit tous les profils. Un acheteur qui n'a jamais rien
vendu voit son pseudo, sa ville et ses avis proposés à l'indexation sans l'avoir choisi ; à
l'échelle, le plan de site devient l'annuaire des comptes.

**Correction.** Ne déclarer que les vendeurs qui ont une annonce publique ; `noindex` pour les
autres profils ; une case « Ne pas référencer mon profil » dans les réglages.
**Test.** tests/seo : le plan de site ne contient que des vendeurs actifs.

### F11 — Une action à `FormData` lève sur un autre argument

**Faible · actif.** Une action serveur reçoit ce que le client sérialise, pas le type déclaré.
`submitListing` (`src/app/actions/listings.ts:25-26`) appelle `readListingFormData`, donc
`Object.fromEntries` et `getAll` ; `saveProfile` (`src/app/actions/profile.ts:10`),
`submitWanted` (`src/app/actions/wanted.ts:20`), `reviewDealAction`
(`src/app/actions/deals.ts:27-34`), les actions de messages et `reportAction` font de même.
Un `POST` qui passe une chaîne lève un `TypeError` : erreur 500 avec digest, sans fuite, mais
du bruit et une surface de déni.

**Correction.** Un utilitaire `asFormData(value)` en tête de chaque action : ce qui n'est pas
un `FormData` rend `invalid`.
**Test.** `submitListing("x")` rend `invalid`.

## Informations

* **I1** — `X-Powered-By: Next.js` sur chaque réponse (traité avec M1).
* **I2** — `robots.txt` n'écarte pas `/notifications`, `/signaler` ni `/pro/lots` ; ces pages
  sont en `noindex` par leurs métadonnées, ce qui suffit. `robots.txt` n'est pas une
  protection.
* **I3** — Le contrôle d'origine des actions accepte une requête sans en-tête `Origin`
  (vérifié) : c'est voulu, un navigateur envoie toujours `Origin` sur un `POST` intersite.
  Ce contrôle protège d'une requête forgée depuis un autre site, pas de l'abus d'un compte
  (M5, M7).
* **I4** — `remotePatterns` autorise tout Unsplash (`pathname: "/**"`) : l'optimiseur
  redimensionne n'importe quelle image Unsplash à la demande. À retirer avec les photos de
  démonstration.
* **I5** — `next dev` affiche les piles d'appel, jusque dans le HTML d'une 404 : normal en
  développement, à ne jamais exposer sur Internet.

## Ce qui est déjà bien protégé — à ne pas casser

* **XSS.** Un seul `dangerouslySetInnerHTML` (`src/app/layout.tsx:93`), un script de thème
  constant qui ne pose que « light » ou « dark » (`src/lib/theme.ts:17`) ; `ThemeSync` relit le
  stockage par la même liste blanche. Aucun `innerHTML`, `eval`, JSON-LD, `next/script`.
  Paramètres réfléchis (`?q=`, `?ville=`, `?suivant=` avec `</script><script>…` et
  `"><img onerror>`) : échappés en `\u003c` dans le flux RSC et en `&lt;` dans le HTML.
  Messages et descriptions rendus en texte (`whitespace-pre-line`), sans liens automatiques.
  Liens `target="_blank"` tous en `noopener` (`PhotoCredits`, `ShopDetails`). Styles en ligne
  construits sur des énumérations seulement.
* **Actions serveur.** Chaque action revalide avec Zod côté serveur ; l'identité vient de la
  session, jamais du client ; la propriété est vérifiée dans la couche données et un refus
  répond « introuvable ». Affectation de masse impossible : Zod retire les clés inconnues
  (essayé : `featured_until`, `status`, `seller_id`, `extra_photos`, `view_count`,
  `account_type`, `pro_until`, `siret` disparaissent), les mappers écrivent des colonnes
  nommées, et les droits de colonnes de la base les répètent. Un `POST` avec un `Origin`
  étranger est refusé (« Invalid Server Actions request. », vérifié).
* **Annonces réservées aux pros.** `PUBLIC_ROWS` pour toute lecture publique ; vérifié en
  direct avec l-35 : la fiche répond 404, identique octet pour octet à une annonce inexistante
  (pas d'oracle d'existence) ; image de partage identique au repli de marque (même empreinte
  MD5) ; `/signaler?annonce=` en 404 ; recherche et plan de site sans le titre ;
  `generateMetadata` en `noindex` sans aperçu ; avis sans titre ni lien
  (`reviews.mock.ts:109`) ; `contactSeller` et `joinWaitlist` refusent. Hors les deux pages
  de M2, aucune charge RSC relevée ne contient `reservedForId`, `proUntil` ou `siret` d'un tiers.
* **Frontière des données.** `server-only` sur tous les modules de lecture et d'écriture ;
  aucun composant client n'importe `lib/data` ni `lib/mock` (hors `import type`).
  Variables publiques limitées à `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_PHOTOS_URL` ; `SUPABASE_SECRET_KEY` documentée serveur seulement ; aucun
  secret dans l'historique Git (recherche de jetons JWT, `sk_`, `sb_secret_`, clés privées).
* **Images.** `remotePatterns` strict : l'optimiseur refuse un autre hôte, une URL en `//` et
  `http:` (400, vérifié) ; ses réponses portent `Content-Security-Policy: script-src 'none';
  frame-src 'none'; sandbox;` et `Content-Disposition: attachment` ; pas de
  `dangerouslyAllowSVG`. Côté navigateur, types et tailles filtrés (`photo-files.ts`) ; en
  phase 2, Cloudflare Images le refait à la réception — formats acceptés, taille bornée —
  et ne sert que des variantes ré-encodées (`supabase/README.md`, § 6).
* **Redirections.** Celles de `next.config.ts` sont statiques, à motif borné ; `//evil.example`
  est normalisé sur la même origine (308 vers `/evil.example/`).
* **Pages d'erreur.** Seul le digest s'affiche, jamais le message ; en production il est
  opaque.
* **Stockage navigateur.** Une seule clé, `theme`, en liste blanche ; aucun cookie en phase 1.
* **Dépendances.** Quatre paquets d'exécution, fichier de verrouillage présent ;
  `npm audit --omit=dev` et `npm audit` : 0 vulnérabilité au 30 septembre 2026.
* **Base (phase 2).** RLS sur toutes les tables, droits de colonnes sur les écritures,
  `is_blocked_between` gardé contre l'interrogation d'autrui, dossier du vendeur exigé pour
  les photos, contraintes qui répètent Zod (pseudo, `shop_website`, longueurs),
  déclencheurs de photos, de séries, de commune et de vente close.
* **Tests existants à garder** : `listings-data.test.mjs` (« aucune lecture publique ne rend
  une annonce réservée aux pros »), `mutations.test.mjs` (propriété, participation, statut,
  vente close, signalement), `schema-sync.test.mjs` et `schema-security.test.mjs`
  (colonnes, droits, RLS), `render-purity.test.mjs`.

## Ce qui n'a pas pu être vérifié

* **La production.** Seul `next dev` a été interrogé ; aucun déploiement connu. Les en-têtes
  ajoutés par l'hébergeur (HSTS chez Vercel) ne sont pas mesurés.
* **Build, smoke, tests complets** : non lancés, comme demandé. Le fichier
  `.next/server/app/messages.html` cité en M8 vient du build d'un autre agent (11 h 33).
* **Le code de la phase 2** n'existe pas : session, `proxy.ts`, `/auth/callback`,
  téléversement signé, webhook de paiement, Edge Function. E1, E2, F1, F2 et M5 à M8 sont
  des recommandations préventives, déduites du plan écrit dans `supabase/README.md`.
* **La RLS** a été lue, pas exécutée : aucune base Postgres n'était disponible. Le plantage
  de M6 et les erreurs SQL de F4, F5 et F7 sont déduits de la lecture.
* **Le blocage des URL `javascript:` par React 19** est constaté dans le bundle serveur
  (`react-dom-server.node.production.js`), pas éprouvé dans un navigateur.
* **`@supabase/ssr`** : valeurs par défaut lues dans la version 0.12.7, pas dans celle qui
  sera installée. Les réglages du tableau de bord Supabase (changement d'e-mail sécurisé,
  rotation des jetons, limites de GoTrue) ne sont pas vérifiables d'ici.
* **`npm audit`** reflète la base d'avis au jour de l'audit.
* **Fichiers mouvants** : `src/lib/schemas/listing-form.ts` a été réécrit pendant la lecture
  (champs partagés déplacés dans `src/lib/schemas/fields.ts`) ; les constats ont été
  revérifiés sur la nouvelle version, sans changement de fond.

## À transmettre à la modélisation (Supabase)

Signalés, pas corrigés — `docs/donnees/` et `supabase/` sont hors de ce périmètre.

1. **`listings.reserved_for` lisible par tous** ceux qui lisent l'annonce, rôle anonyme
   compris (`security.sql:73-75`) : la fuite de M2 au niveau de l'API. Droit de colonne en
   lecture, ou vue publique sans la colonne.
2. **Contenu d'une annonce modifiable après une vente close** : aucun déclencheur ne le fige,
   et `deals` ne garde ni prix ni titre (M4).
3. **Ouverture de conversation sans contrôle d'audience** (`security.sql:158-168`) : ajouter
   `l.audience = 'everyone' or public.is_active_pro(buyer_id)` (M6).
4. **`reserve_listing()` ignore les blocages** (`reservations_notifications.sql:12-25`) (F7).
   Réglé depuis, le 4 octobre 2026 : la migration 17 (`20261004120000_reserve_respects_blocks.sql`)
   lève comme `close_deal()`, et `supabase/tests/scenarios/16-reserve-blocks.sql` le rejoue.
5. **`company_name` dans les droits de mise à jour de `profiles`** (`security.sql:60`) alors
   que `ProfileUpdate` (`src/lib/data/rows.ts:326-333`) ne l'écrit pas : une boutique
   renommerait son enseigne depuis l'API, sans lien avec le SIRET vérifié. Le test
   correspondant (`tests/schema-security.test.mjs:26-53`) est une liste d'interdits ; le rendre
   exact, comme pour `listings`.
6. **`conversations.buyer_deleted_at` / `seller_deleted_at` lisibles par l'autre partie**,
   alors que `src/lib/data/conversations.ts:12-14` promet que « l'autre partie ne sait pas
   qu'on l'a retirée ».
7. **`profiles.pro_until` lisible par tous** : déjà consigné comme limite connue
   (`docs/donnees/MPD-securite.md`, § 6).
8. **Photos** : réglé depuis (E2) — Cloudflare Images reçoit le fichier, le garde privé
   jusqu'à la publication et ne sert que des variantes sans métadonnées
   (`supabase/README.md`, § 6).
9. **Quotas** : si la limitation de débit se fait en base, une table de compteurs par compte
   et par action (M7).
