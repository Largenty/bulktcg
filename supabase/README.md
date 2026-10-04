# Bascule vers Supabase et Cloudflare (phase 2)

La phase 1 tourne sur des données factices, mais **toute la chaîne est déjà en place** :
les pages lisent par `src/lib/data/`, les formulaires écrivent par des actions serveur
(`src/app/actions/`) qui délèguent à `src/lib/data/*-mutations.ts`, et chaque écriture
s'arrête à une seule couture, `deferWrite`, avec la charge exacte qu'elle enverra.
La base et l'authentification sont Supabase ; **les photos vivent chez Cloudflare
Images** — décidé, R2 écarté (§ 6).

La bascule remplace surtout des corps de fonctions — aucun composant ne change. Surtout,
pas seulement : le rendu (§ 7), les photos (§ 6) et la gestion des échecs (§ 5) demandent
aussi du travail, décrit ici.

```
src/app/actions/*.ts          actions serveur minces : revalident l'entrée (Zod), délèguent, rafraîchissent
src/lib/data/*-mutations.ts   contrôle d'identité et de propriété, construction des lignes
src/lib/data/write-seam.ts    deferWrite : la liste de ce qu'il reste à brancher
src/lib/data/mutation-result.ts  ce que rend une écriture, échecs passagers compris
src/lib/data/mappers.ts       snake_case ⇄ camelCase, dans les deux sens, testé
src/lib/data/rows.ts          forme des lignes, synchronisée avec les migrations SQL (test)
src/lib/env.ts                les variables du serveur, vérifiées au démarrage (src/instrumentation.ts)
src/components/ui/useMutation.ts  l'appel d'une action depuis le navigateur, échec réseau compris
supabase/migrations/          schéma, contraintes, index, déclencheurs, RLS, registre des photos
supabase/tests/               les migrations rejouées sur un vrai PostgreSQL, sous les rôles de l'API
docs/donnees/                 le modèle que ces migrations implémentent : MCD, MLD, MPD
```

## 1. Créer le projet

**Sans la CLI**, sur un projet neuf : ouvrir l'éditeur SQL du tableau de bord (SQL
Editor), y coller tout `supabase/setup.sql`, puis Run. Ce fichier unique contient toute la
base — les migrations ci-dessous, bout à bout et dans l'ordre. Il est généré
(`node scripts/supabase-setup.mjs`) et ne se modifie pas à la main :
`tests/supabase-setup.test.mjs` échoue dès qu'il ne suit plus les migrations. Il ne sert
qu'à créer une base vide ; une fois celle-ci en place, un changement de schéma s'applique
par sa seule nouvelle migration.

**Une base déjà créée** reçoit seulement les migrations qui lui manquent, chacune collée
seule dans l'éditeur SQL, dans l'ordre. Le projet créé le 1er octobre 2026 avec les dix
premières a reçu la onzième, `supabase/migrations/20261001120000_writes.sql` (les
écritures de la phase 2), le même jour. Les deux suivantes ajoutent le produit « Cartes à
l'unité », et se collent **en deux exécutions séparées**, dans cet ordre :

1. `supabase/migrations/20261001120100_product_tag_singles.sql` — la valeur `singles` ;
2. `supabase/migrations/20261001120200_product_tag_singles_games.sql` — les jeux qui la
   proposent.

PostgreSQL refuse d'employer une valeur d'énumération dans la transaction qui l'ajoute
(« unsafe use of new value »), et l'éditeur SQL joue un fichier collé en une seule
transaction : collées ensemble, elles échouent. `setup.sql` n'a pas ce problème, puisque
l'énumération y naît dans la même transaction, où la règle ne s'applique pas ;
`tests/product-tags.test.mjs` rejoue les deux cas sur PGlite.

**Une base neuve, dans l'ordre** : `setup.sql` (le schéma), puis `npm run supabase:communes`
(toutes les communes, ci-dessous), `npm run supabase:editions` (toutes les séries,
ci-dessous), puis, si l'on veut la démonstration, `npm run supabase:seed` (§ 10). Les trois
scripts lisent les clés de `.env`.

**Avec la CLI** :

```
npm install @supabase/supabase-js @supabase/ssr
npx supabase init            # si le dossier n'est pas encore lié
npx supabase link --project-ref <ref>
npx supabase db push         # applique supabase/migrations/, dans l'ordre
```

Une base créée par `setup.sql` qui passe ensuite à la CLI marque d'abord les migrations qu'il
contenait comme appliquées — la commande, avec leurs horodatages, est en tête du fichier
(`npx supabase migration repair --status applied …`) —, sans quoi `db push` les rejouerait
sur des tables qui existent déjà.

### Les migrations

Le schéma est découpé en dix-sept migrations, ordonnées par leur horodatage et toutes sous
500 lignes. `supabase db push` les applique dans cet ordre ; sans la CLI,
`supabase/setup.sql` les réunit dans ce même ordre, en un fichier à coller. Chaque fichier
ne référence que ce que les précédents ont créé (types avant tables, tables avant les clés
étrangères qui les visent, fonctions avant les déclencheurs qui les appellent), et
`tests/schema-sync.test.mjs` le vérifie. Avec `tests/schema-security.test.mjs`, il lit les
fichiers concaténés dans l'ordre (`tests/schema.mjs`) et les compare à `rows.ts` : le
premier pour la structure, les colonnes et les référentiels, le second pour la RLS et les
droits. Le modèle qu'ils implémentent — MCD, MLD, MPD — est dans `docs/donnees/`.

| Fichier | Contenu |
|---|---|
| `20260929120000_types.sql` | les quatorze énumérations (`game_id` dans l'ordre de `GAME_IDS`), `distance_km`, `set_updated_at` |
| `20260929120100_referentials.sql` | `communes`, `editions`, `product_tag_games`, remplies avec les référentiels du code (`lib/cities.ts`, `lib/editions.ts`, `lib/product-tags.ts`) |
| `20260929120200_profiles.sql` | `profiles`, `account_settings`, l'inscription (`handle_new_user`) et la naissance des réglages |
| `20260929120300_listings.sql` | `listings`, `photo_uploads` (le registre des fichiers chez Cloudflare), `listing_photos`, `listing_editions`, `listing_tags`, leurs contrôles, le contrôle des fichiers (`check_photo_upload`), le ménage (`claim_photo_purge`, `forget_purged_photos`, `track_photo_upload_use`), `listings_within`, `pro_only_count_by_game`, `record_listing_view` |
| `20260929120400_wanted.sql` | `wanted_listings`, `wanted_reaching` |
| `20260929120500_messaging.sql` | `conversations`, `messages`, `touch_conversation`, `hide_conversation` |
| `20260929120600_deals_reviews.sql` | `deals`, `close_deal`, `keep_closed_deal_sold`, le gel d'une annonce vendue, `count_sale`, `reviews`, `stamp_review`, `refresh_rating` |
| `20260929120700_reservations_notifications.sql` | `reserve_listing`, `clear_reservation`, `listing_waitlist`, `notifications`, `waitlist_count`, `notify_waitlist`, `notify_review` |
| `20260929120800_blocks_reports.sql` | `blocks`, `is_blocked_between`, `reports`, `check_report_target` |
| `20260929120900_security.sql` | `is_active_pro`, la RLS de toutes les tables, les droits de colonnes et de fonctions |
| `20261001120000_writes.sql` | les écritures de la phase 2 qui demandent plus qu'un insert : `create_listing`, `update_listing`, `open_conversation`, et le droit d'écrire l'identifiant tiré par le formulaire (§ 5) |
| `20261001120100_product_tag_singles.sql` | le produit « Cartes à l'unité » : la valeur `singles`, seule, après `graded` |
| `20261001120200_product_tag_singles_games.sql` | les huit jeux qui la proposent (`product_tag_games`) |
| `20261002120000_listing_expiring_kind.sql` | la notification « annonce bientôt expirée » : la valeur `listing_expiring`, seule |
| `20261002120100_listing_lifecycle.sql` | le cycle de vie d'une annonce (§ 5) : `renewed_at`, les dates de la remontée, `listing_expires_at`, `listing_on_market`, `listing_archived`, la relance par un geste du vendeur, `renew_listing`, la tâche quotidienne `run_listing_lifecycle`, et ce qui n'est plus en ligne ne reçoit plus rien (conversation, liste d'attente, espace pro) |
| `20261002120200_pro_status.sql` | le statut professionnel, séparé du forfait (§ 8) : `legal_name`, `pro_verified_at`, `cardmarket_url`, `cardnexus_url`, un SIRET par compte, le forfait qui suppose le statut, `leave_pro_status` |
| `20261004120000_reserve_respects_blocks.sql` | `reserve_listing` refuse, comme `close_deal`, de réserver entre deux comptes dont l'un a bloqué l'autre |

Ces fichiers remplacent l'ancien `20260929120000_initial_schema.sql`, jamais appliqué à
un projet, et une onzième migration qui créait un bucket Supabase Storage, retirée quand
les photos sont passées chez Cloudflare. Un projet qui aurait reçu l'un ou l'autre se remet
à zéro (`npx supabase db reset`).

Les produits sont remplis par la migration avec la liste du code, et
`tests/schema-sync.test.mjs` compare ces lignes au code : en ajouter un se fait des deux
côtés, ou les tests échouent.

**Les séries viennent d'un script, pas de la migration.** La migration 2 n'en pose que les
98 de la phase 1. `node scripts/editions-update.mjs` tire les autres des API gratuites de
chaque jeu — TCGdex (Pokémon, noms français), Scryfall (Magic), YGOPRODeck (Yu-Gi-Oh),
Lorcast (Lorcana), OPTCG API (One Piece), RiftHunt (Riftbound) ; Naruto n'en a pas — et
réécrit `src/lib/editions/editions.json` ; `npm run supabase:editions`
(`scripts/supabase-editions.mjs`) l'écrit dans la table, avec la clé de service (214 séries
le 1er octobre 2026). Aucune API n'est appelée pendant le rendu d'une page : seulement par
le script, avec un délai par appel, le nom de l'application en `User-Agent`, 100 ms entre
deux appels, un arrêt sur 429, et chaque réponse vérifiée par Zod avant écriture ; une API
qui échoue garde la liste précédente de son jeu. Le chargeur ajoute les nouvelles séries et
met à jour les noms et l'ordre (`sort_order`, décalé d'abord : `unique (game_id,
sort_order)` n'est pas différable), ne supprime jamais rien, et s'arrête avant toute
écriture sur une série qui changerait de jeu ou de code, hors des corrections listées
(`scripts/editions-update/curated.mjs` : « Destinées Radieuses » est EB04.5, pas EB07.5).
Une série que l'API ne donne plus reste en base et dans le fichier, marquée retirée : les
annonces qui la citent l'affichent encore, elle n'est plus proposée. Relancé, il n'écrit
rien. À relancer quand une extension sort, après `editions-update.mjs` et `npm test`.

**Les communes viennent d'un script, pas de la migration.** La migration 2 n'en pose que
les 112 villes de la phase 1 ; `npm run supabase:communes` (`scripts/supabase-communes.mjs`)
ajoute les autres couples commune et code postal du référentiel du code,
`src/lib/communes/communes.json` — 35 363 lignes en tout, une par couple, car les clés
étrangères des profils, des annonces et des demandes visent `(name, postal_code)`. La
ligne du code postal principal porte le slug de la page de la commune (`paris`,
`saint-denis-974`), les autres `<slug>-<code postal>` (`paris-75002`). Le script lit toute
la table, n'ajoute que les couples absents par lots de 1 000, et ne modifie ni ne supprime
rien : une ligne déjà en base avec d'autres valeurs, ou un slug pris par un autre couple,
l'arrête avant toute écriture, avec la liste. Relancé, il n'écrit rien (35 251 couples
ajoutés en 5 s au premier passage, aucun au second). **À relancer après chaque mise à jour
du référentiel** (`node scripts/communes-update.mjs`, une fois par an, après les fusions
de communes du 1er janvier). Une commune retirée du référentiel officiel y reste marquée
retirée et garde sa ligne en base : jamais supprimée, elle tient la clé étrangère des
annonces qui la citent. `tests/schema-sync.test.mjs` vérifie que les 112 lignes de la
migration 2 sont dans le référentiel à l'identique ; `tests/supabase-communes.test.mjs`
tient le plan du script (ajouts, arrêt sur conflit, lots).

### Variables

Décrites dans `.env.example`, **vérifiées au démarrage du serveur**
(`src/instrumentation.ts` appelle `assertServerEnv` de `src/lib/env.ts`) : une variable
mal formée, ou un groupe rempli à moitié, arrête le démarrage avec la liste de ce qui ne va
pas. Supabase et Cloudflare Images vont ensemble (décidé en octobre 2026) :

| Configuré | En local, en développement, en prévisualisation | En production (`VERCEL_ENV=production`) |
|---|---|---|
| ni l'un ni l'autre | admis : la phase 1, sur ses données de démonstration | admis |
| Supabase seul | admis : on y essaie la base sans les photos | **refusé** : toutes les annonces s'afficheraient « Sans photo », et un dépôt avec photos ne pourrait pas être publié |
| Cloudflare Images seul | **refusé** : aucun téléversement ne pourrait être inscrit au registre, et les photos de démonstration, servies par Unsplash, seraient bloquées par la CSP (`img-src`) | **refusé**, de même |
| les deux | admis | admis |

| Variable | Où | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | client et serveur | adresse publique ; le build d'un vrai déploiement échoue sans elle (`src/lib/site.ts`) |
| `NEXT_PUBLIC_SUPABASE_URL` | serveur | URL du projet (lue côté serveur seulement : le navigateur ne parle jamais à Supabase, § 3) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | serveur | clé publique (anciennement *anon key*) |
| `SUPABASE_SECRET_KEY` | serveur seulement | client administrateur : notifications de croisement, vues, suppression de compte, webhooks, registre des photos |
| `CLOUDFLARE_ACCOUNT_ID` | serveur | compte Cloudflare |
| `CLOUDFLARE_IMAGES_API_TOKEN` | serveur seulement | jeton limité à « Images : modifier » : adresses de dépôt, visibilité, suppression |
| `CLOUDFLARE_IMAGES_SIGNING_KEY` | serveur seulement | signe les URL des photos privées (Images > Clés, § 8) |
| `NEXT_PUBLIC_PHOTOS_URL` | client et serveur | gabarit de l'adresse d'une photo, `https://imagedelivery.net/<hash du compte>/{key}/{variant}` : l'identifiant, puis la variante (`resolvePhotoUrl`, chargeur `next/image`) |
| `CRON_SECRET` | serveur seulement | le secret que Vercel Cron présente au ménage quotidien des photos ; exigé dès que Cloudflare Images est configuré (§ 6) |
| `DEMO_USER_ID` | serveur | phase 1, développement et prévisualisation seulement : refusée en production et dès que Supabase est configuré |

## 2. Types générés

```
npx supabase gen types typescript --linked > src/lib/data/database.types.ts
```

`rows.ts` peut alors dériver de `Database["public"]["Tables"][…]["Row"]`. Le test
`tests/schema-sync.test.mjs` garantit dès aujourd'hui que les colonnes de `rows.ts` et
celles des migrations sont les mêmes : la dérivation ne devrait rien changer, et le test
reste, pour les types d'écriture et les droits que la génération ne décrit pas.

## 3. Session et compte

**Branché le 1er octobre 2026.** Supabase est en service dès que ses trois variables sont
posées (`isSupabaseMode`, `src/lib/data/source.ts`) ; sans elles, le site tourne sur ses
données de démonstration, avec son compte toujours connecté, et rien ne change.

### Les trois clients (`src/lib/data/supabase.ts`)

Le seul module qui importe `@supabase/*` ; `source.ts` les distribue à la couche données,
le proxy n'en prend que le rafraîchissement de la session (`tests/conventions.test.mjs`).

| Client | Clé | Pour |
|---|---|---|
| `publicClient({ tags, revalidate })` | publique, sans cookies | ce qu'un visiteur anonyme voit ; avec `tags`, la lecture entre dans le cache de données de Next par les options de `fetch` (une heure par défaut), qu'une action invalide par `updateTag(tag)` — la page suivante attend la donnée fraîche — ou `revalidateTag(tag, "max")` ailleurs |
| `userClient()` | publique, cookies de la requête | ce qui dépend de la personne : la RLS tranche ; jamais en cache partagé, un client par requête |
| `adminClient()` | secrète, serveur seulement | ce qu'aucun rôle connecté n'a le droit d'écrire : notifications de croisement, vues, suppression de compte ; elle passe outre la RLS |

Une écriture passe par `performWrite` (`src/lib/data/write-seam.ts`) : la couture et
`not-persisted` en démonstration, la requête puis `saved` en phase 2, ou l'échec traduit par
`toMutationFailure` (`mutation-result.ts`, tableau du § 5). Une mise à jour que la RLS
écarte ne touche aucune ligne sans échouer : `.select("id").single()` la fait répondre
« introuvable ».

### La session (`src/lib/data/session.ts`)

`getCurrentUserId` lit `auth.getClaims()`, qui vérifie la signature du jeton localement :
le projet signe ses jetons en ES256, une clé asymétrique, et la clé publique se lit une
fois (JWKS). Jamais `getSession()` seul, qui ne revérifie rien. Une session illisible vaut
« pas connecté ».

**Les cookies de session ne se lisent que côté serveur** : `httpOnly`, `sameSite: "lax"`,
et `Secure` dès que le site est en HTTPS — en `http://localhost`, tous les navigateurs ne
gardent pas un cookie Secure, et la connexion locale échouerait. Aucun client Supabase dans
le navigateur : c'est la meilleure réponse au risque E1 de l'audit (une régie publicitaire
ou une XSS lirait la session). Le prix : pas de temps réel Supabase dans le navigateur ; un
fil ouvert se rafraîchit par `router.refresh()`.

**Le proxy rafraîchit la session** (`src/proxy.ts`) : un jeton expiré est renouvelé une
fois, avant le rendu, et ses cookies entrent dans la requête que le rendu lit, puis dans la
réponse. Il ne décide d'aucun droit — c'est la couche données et la RLS qui tranchent — et
ne crée aucun client pour un visiteur sans cookie de session.

La session de démonstration disparaît d'elle-même : `resolveDemoUserId` (`src/lib/env.ts`)
ne rend aucun compte dès que Supabase est configuré, et fait échouer le démarrage si
`DEMO_USER_ID` est restée dans l'environnement.

### Le compte (`src/lib/data/auth-mutations.ts`)

* **Connexion** : un refus dit « Adresse ou mot de passe incorrect. », que l'adresse ait un
  compte ou non. Une adresse non confirmée ne se dit qu'au bon mot de passe.
* **Inscription** : le pseudo, la commune et le code postal partent en métadonnées, et
  `handle_new_user` en fait le profil, que l'action rend aussitôt lisible
  (`updateTag(CACHE_TAGS.profiles)`). Un pseudo pris se dit d'avance — il est public, le
  vérifier par la clé publique, hors cache, ne révèle rien. **Une adresse déjà inscrite
  reçoit la réponse d'une adresse neuve**, et ce qui en dépend aussi : le lien renvoyé à une
  adresse non confirmée (un par minute, sinon 429), le refus du SMTP intégré, un envoi qui
  échoue (500). La vraie issue va au journal du serveur, sans l'adresse
  (`src/lib/data/auth-outcomes.ts`). Restent dits un mot de passe refusé, une adresse que
  Supabase n'accepte pas, le réseau et le débit de tout le site. Le chemin d'où
  l'inscription est partie attend dans un cookie `httpOnly`, lu par la seule route de
  confirmation : le lien ne porte que son empreinte. **Une inscription acceptée mène à
  `/inscription/e-mail-envoye`** (`routes.signUpSent`) : un lien part si l'adresse est
  valide et n'a pas encore de compte confirmé, il arrive en quelques minutes, sert une
  fois pendant une heure, et sinon on recommence l'inscription — ce qui renvoie le lien et
  crée le compte si le premier essai ne l'avait pas fait. Chaque phrase reste vraie que
  l'adresse ait un compte ou non. L'adresse s'y montre à demi (`l•••@gmail.com`), par un
  cookie `httpOnly` de dix minutes que seule cette page reçoit, jamais dans l'URL. Une
  session déjà ouverte — « Confirm email » coupé — saute cette page et mène là où l'on
  allait. La réponse sous le bouton, seule, laissait croire que rien ne s'était passé.
* **Mot de passe oublié** : la même page dans tous les cas (`/mot-de-passe-oublie/e-mail-envoye`,
  mêmes conseils, même adresse masquée), et dans le même temps. La
  demande part après la réponse (`after()`) : une adresse inscrite demandée deux fois en
  une minute reçoit 429 de Supabase, son SMTP intégré refuse les adresses hors de l'équipe,
  une adresse inconnue reçoit toujours 200 — rien de cela n'arrive à l'écran, et la
  réponse n'attend pas l'envoi d'un e-mail. Le serveur consigne l'issue, sans l'adresse.
* **Le lien reçu par e-mail** mène à `/connexion/confirmation` (`routes.emailConfirmation`) :
  `verifyOtp({ type, token_hash })` ouvre la session, puis la route mène au nouveau mot de
  passe, ou là d'où l'inscription est partie (`safeReturnPath`). Un lien qui a servi ou
  expiré mène à `/connexion/lien-expire`, qui propose d'en recevoir un autre. Une adresse
  confirmée expire la liste des profils en cache (`revalidateTag(…, { expire: 0 })`, la
  forme que Next prescrit hors d'une action) : son compte se lit tout de suite.
* **Nouveau mot de passe, sans l'ancien** : seulement pour une session ouverte par un lien
  reçu par e-mail depuis moins d'une heure. Supabase l'inscrit `otp` dans la revendication
  `amr` du jeton — pour le lien de récupération comme pour celui de l'inscription, mesuré
  sur le projet —, et `password` pour une connexion par mot de passe : une session ouverte
  par mot de passe, ou volée, ne change pas le mot de passe. La page et l'action la
  traitent comme un lien expiré.
* **Déconnexion** : « Se déconnecter », dans l'en-tête du compte, ferme la session de cet
  appareil (`scope: "local"`) ; la démonstration n'affiche pas ce bouton.
* **Google reste désactivé** : aucune route d'échange de code OAuth n'existe. Le jour où il
  s'ouvre, une route `/connexion/google` fera cet échange, avec un retour filtré par
  `safeReturnPath`.

Une inscription Google n'aura pas de pseudo : `handle_new_user` ne crée le profil que si
les métadonnées en portent un. Il faudra rediriger un compte sans profil vers
`/mon-compte/profil` avant tout dépôt ; ce premier enregistrement est un `insert` (droits :
`id`, `username`, `city`, `postal_code`, `avatar_initials`, `bio`), pas l'`update` de
`profiles.update`. Les réglages d'alerte naissent avec le profil, par déclencheur.

La commune d'un profil, d'une annonce et d'une demande est une clé étrangère vers
`communes (name, postal_code)` : une inscription dont les métadonnées portent une commune
inconnue échoue. Le formulaire d'inscription la choisit donc dans la même liste que les
autres.

### Réglages du tableau de bord

À faire une fois, dans le projet Supabase :

1. **Authentication > URL Configuration**
   * *Site URL* : `http://localhost:3000` tant que le site tourne en local, puis l'adresse
     publique (`https://<domaine>`) le jour du déploiement. Les e-mails construisent leur
     lien sur elle.
   * *Redirect URLs* : `http://localhost:3000/**`, et `https://<domaine>/**` une fois le
     domaine connu. Les liens actuels n'en ont pas besoin — ils partent de la Site URL —,
     mais Supabase refuserait tout retour qui n'y figure pas.
2. **Authentication > Sign In / Providers > Email** : « Confirm email » activé, et
   *Minimum password length* à **12** — le site exige 12 caractères, Supabase en accepte 6
   par défaut. Activer *Secure password change* (« Require reauthentication when changing
   password ») : hors d'une session de moins de 24 heures, Supabase exige alors un code
   envoyé par e-mail pour changer de mot de passe — une seconde barrière, que le parcours
   du lien de récupération, toujours récent, ne rencontre pas. Laisser désactivée l'option
   qui exige le mot de passe actuel : ce parcours ne le connaît pas, et la documentation ne
   dit pas qu'il en est exempté. Google reste désactivé.
3. **Authentication > Emails > Templates**, deux modèles, dont seul le lien compte :

   *Confirm signup* — objet « Confirmez votre adresse — BulkTCG » :

   ```html
   <h2>Bienvenue sur BulkTCG</h2>
   <p>Confirmez votre adresse pour activer votre compte :</p>
   <p><a href="{{ .SiteURL }}/connexion/confirmation?token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse</a></p>
   <p>Le lien sert une fois, pendant une heure. Si vous n'avez pas créé de compte, ignorez ce message.</p>
   ```

   *Reset password* — objet « Choisir un nouveau mot de passe — BulkTCG » :

   ```html
   <h2>Nouveau mot de passe</h2>
   <p>Pour choisir un nouveau mot de passe sur BulkTCG :</p>
   <p><a href="{{ .SiteURL }}/connexion/confirmation?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
   <p>Le lien sert une fois, pendant une heure. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas.</p>
   ```

   Sans ces modèles, le lien par défaut passe par le serveur de Supabase puis revient sur la
   Site URL avec un code que le site n'échange pas : l'adresse serait confirmée sans que la
   session s'ouvre, et le lien du mot de passe oublié n'aboutirait pas.
4. **Authentication > Emails > SMTP Settings** : **un SMTP à vous avant d'ouvrir les
   inscriptions.** Le service d'e-mail par défaut de Supabase n'envoie qu'aux adresses de
   l'équipe du projet, deux messages par heure au plus : un visiteur qui s'inscrit ne
   recevrait jamais son lien. Les comptes de démonstration, créés confirmés, n'en ont pas
   besoin.

   **Ce quota rend l'inscription intestable au-delà de deux essais par heure**, pour tout
   le projet : inscriptions et demandes de mot de passe confondues. Au-delà, Supabase
   répond 429 et ne crée pas le compte — mesuré le 1er octobre 2026, où aucun compte n'était
   né —, alors que l'écran, qui ne doit jamais dire si une adresse a un compte, mène quand
   même à la page « e-mail envoyé ». Un SMTP à vous est donc nécessaire avant tout essai
   réel. D'ici là, un compte d'essai se crée sans e-mail par l'API d'administration
   (`auth.admin.createUser`, ou `generateLink`, qui rend le lien sans l'envoyer).

## 4. Lectures

Chaque fonction de `src/lib/data/` garde sa signature ; seul son corps change. Le filtrage
en mémoire de la phase 1 a été écrit sur des lignes `snake_case` pour se traduire mot à mot.

**Un seul fichier sait d'où viennent les données : `src/lib/data/source.ts`.** En phase 1 il
expose les tables factices (`TABLES`) ; c'est là que naissent les trois clients — public,
utilisateur, administrateur —, et chercher `TABLES.` donne la liste exacte des lectures à
brancher, comme `deferWrite(` celle des écritures. `unwrap()` et `DataSourceError` y sont
déjà écrits et testés (`tests/data-source.test.mjs`).

**Une lecture qui échoue lève ; elle ne rend jamais `null` pour « panne ».** `null` veut
dire « introuvable », et une page qui reçoit `null` répond 404 : pendant une régénération,
une panne passagère figerait un 404 et ferait désindexer la fiche. Un utilitaire `unwrap()`
lève sur `error` ; une régénération qui lève garde l'ancienne page servie, et l'écran
d'erreur propose de réessayer (`retry()`).

Deux clients : le **client public** (clé publique, sans cookies) pour tout ce qu'un
visiteur anonyme voit — il se met en cache ; le **client utilisateur** (cookies) pour ce qui
dépend de la personne — la RLS y tranche.

| Fonction | Requête |
|---|---|
| `getListings(query)` | client public : `from("listings").select("*, seller:profiles(*), photos:listing_photos(*), editions:listing_editions(*), tags:listing_tags(*)")` + filtres `eq`/`gte`/`lte` + `.range(offset, offset + limit - 1)` ; avec `origin`, `rpc("listings_within", …)` |
| `countListings(query)` | même requête, `{ count: "exact", head: true }` |
| recherche textuelle (`?q=`) | **à écrire** : une colonne `tsvector` (configuration `french` + `unaccent`), alimentée à l'écriture avec les noms de séries et les libellés de produits, qui vivent dans le code |
| `getEditionFacets`, `getTagFacets`, `countListingsWithoutEditions`, `getListingCountByGame`, `getWantedCountByGame` | **RPC à écrire** : `group by` sur la requête moins le critère piloté |
| `getWantedMatches`, `getListingsMatchingWanted` (et leurs comptes) | **RPC à écrire** : le croisement lit aujourd'hui toutes les demandes, ou 500 annonces du jeu, puis filtre en mémoire — au-delà, la troncature serait silencieuse |
| comptes des tableaux de bord (une annonce, une recherche à la fois) | une fonction de lot, `countWantedMatchesByListing(ids)`, plutôt qu'une requête par ligne |
| `getListingBySlug` | client public, `.eq("slug", slug).maybeSingle()` — garder le `cache()` |
| `getListingForViewer` | client utilisateur, même select : la RLS admet une annonce réservée pour son vendeur, un pro actif, ou les participants d'une conversation à son sujet |
| `getProOnlyListings` | client utilisateur, `.eq("audience", "pros")` : la RLS rend une liste vide à qui n'y a pas droit |
| `getWantedListings({ reachableOnly })` | `rpc("wanted_reaching", { origin_lat, origin_lon })` |
| `getConversationsForUser` | RLS : `from("conversations").select(…)` ne rend que les siennes |
| `getUnreadConversationCount` | messages `read_at is null and sender_id <> auth.uid()` |
| `getDealsForUser` / `getDealById` | RLS « vente lue par ses parties » : `from("deals").select("*, listing:listings(*, photos:listing_photos(*)), seller:profiles!seller_id(*), buyer:profiles!buyer_id(*), conversation:conversations(created_at), reviews(*, listing:listings(slug, title), reviewer:profiles!reviewer_id(username, avatar_initials))")` |
| `getReviewsForUser` | `from("reviews").select("*, listing:listings(slug, title), reviewer:profiles!reviewer_id(username, avatar_initials)").eq("reviewed_id", id)` — la RLS rend `listing` nul pour un lot réservé aux pros ; un auteur supprimé rend `reviewer` nul, que `toReview` affiche « Compte supprimé » |
| `getNotificationsForUser` / `getUnreadNotificationCount` | RLS : `from("notifications").select(…)` ne rend que les siennes ; le compteur, `read_at is null` |
| `isOnWaitlist` / `getWaitlistCountsForSeller` | sa propre ligne de `listing_waitlist` ; pour le vendeur, `rpc("waitlist_count", { listing })` — jamais les noms |
| `getProOnlyCountByGame` | `rpc("pro_only_count_by_game")` : un nombre par jeu, pour tout visiteur. Sous la RLS, un particulier ne compte aucune ligne réservée — le décompte doit passer par cette fonction |
| plan de site | `select distinct game_id, city` pour les couples peuplés, plutôt que 1 000 annonces lues ; `generateSitemaps` au-delà de 50 000 adresses |
| `getEditionById`, `getEditionBlocks` | lus dans `src/lib/editions/editions.json`, côté serveur, comme les communes : la table `editions` en est la copie que `npm run supabase:editions` tient à jour pour la clé étrangère |
| `getCityByName`, `searchCities`, `isKnownCommune` | `from("communes")` ; la page `/[game]/[city]` lit la commune par son `slug` |
| réglages d'alerte (`/mon-compte/parametres`) | `from("account_settings").select("alert_matches, alert_messages").maybeSingle()` — la RLS ne rend que la sienne |

`toListing`, `toWantedListing`, `toConversation` ne bougent pas.

## 5. Écritures

Branchées le 1er octobre 2026. Chaque mutation passe par `performWrite`
(`src/lib/data/write-seam.ts`) : sans Supabase, la couture et `not-persisted`, comme dans
la démonstration ; avec la base, la requête ci-dessous, puis `saved` ou l'échec traduit
par `toMutationFailure`. La fonction qui l'entoure garde ses contrôles d'identité et de
propriété, faits avant : la RLS les refait, mais ce sont eux qui disent « introuvable »
sans aller-retour. `tests/writes.test.mjs` refuse une écriture déclarée sans requête, et
une mutation qui appellerait la couture directement.

| Couture | Requête |
|---|---|
| `listings.insert` | `rpc("create_listing", { payload }).single()` (migration 11, `security invoker`) : l'annonce, ses séries et ses produits d'une seule transaction, et `(permalink, created)` en retour — un doublon rend le lien de l'annonce déjà déposée, `created` à faux. Les photos attendent la phase 3 : la fonction les refuse, et le formulaire n'en propose pas tant que `canAttachPhotos()` est faux |
| `listings.update` | `rpc("update_listing", { listing, payload })` : retirer les séries et les produits, mettre l'annonce à jour, réinsérer — `check_listing_game_change` refuse un changement de jeu tant que des séries ou produits de l'ancien restent. Le lien et le statut ne bougent pas ; les photos restent telles qu'elles sont jusqu'à la phase 3, où une photo gardée se reconnaîtra à sa clé et non à son adresse (`listing_photos_one_photo_per_file`) |
| `listings.status` | `update({ status, sold_at })` — le déclencheur `count_sale` tient l'historique, d'où l'invalidation des profils en plus des annonces |
| `listings.delete` | `delete` ; la RLS n'admet que le vendeur, et `on delete restrict` refuse une annonce à vente clôturée |
| `listings.renew` | `rpc("renew_listing", { listing })` (migration 15, `security definer`) : « Prolonger » et « Remettre en ligne », pour le vendeur seul et jamais sur une annonce vendue ; `renewed_at` n'est dans les droits de personne |
| `wanted.insert` | `upsert(…, { onConflict: "id", ignoreDuplicates: true })` : un doublon ne rend rien, et la demande déjà déposée doit être celle de l'acheteur connecté |
| `wanted.update`, `wanted.status`, `wanted.delete`, `profiles.update` | `update` / `delete` directs, `.select("id").single()` : une ligne que la RLS écarte rend `PGRST116`, traduit en « introuvable » |
| `messages.insert` | `insert` direct dans un fil existant ; la RLS refuse le reste (blocage, lot réservé pour un autre, passé « pros ») |
| `conversations.insert` | `rpc("open_conversation", { listing, buyer, seller, first_message })` (migration 11) : la conversation et son premier message d'un seul bloc — un message refusé ne laisse pas de fil vide — et l'identifiant en retour, vers lequel l'écran emmène |
| `conversations.delete` | `rpc("hide_conversation", { conversation })` : pose la date de retrait de l'appelant, et seulement la sienne |
| `blocks.insert` | `insert` des seules colonnes de `BlockInsert` (aucun écran ne débloque encore) |
| `reports.insert` | `insert` des seules colonnes de `ReportInsert` ; `check_report_target` refuse de se signaler soi-même ou ce qu'on ne peut pas lire |
| `profiles.delete` | `auth.admin.deleteUser(id)` avec la clé secrète, sur l'identifiant de la session, puis `signOut()` : les cookies partent tout de suite, au lieu de survivre jusqu'à l'expiration du jeton ; les suppressions en cascade suivent (§ 9) |
| `deals.close` | `rpc("close_deal", { conversation, deal_kind })` — passe le lot en « Vendu » et prévient l'acheteur |
| `listings.reserve` | `rpc("reserve_listing", { conversation })` — la personne désignée est l'autre partie de la conversation |
| `reviews.insert` | `insert` des seules colonnes de `ReviewInsert` ; `stamp_review` pose la personne notée, son rôle et l'annonce |
| `waitlist.insert` / `waitlist.delete` | `insert` / `delete` de sa propre ligne, la RLS fait le reste |
| `notifications.insert` | le croisement d'un dépôt **vraiment créé** (`created`), calculé sur l'annonce relue en base — jamais sur l'envoi, qu'un doublon pouvait changer de jeu, de prix ou d'audience —, réservé aux pros pour un lot qui l'est ; écrit avec la clé `service_role` — le rôle connecté n'a aucun droit d'écriture sur cette table —, hors du temps de réponse par `after()`, et en `upsert(…, { ignoreDuplicates: true })` sur l'index `notifications_one_per_match` : la base n'en garde qu'une par croisement. Un échec se lit dans les journaux |
| `notifications.read` | `update({ read_at })` sur ses propres lignes encore non lues, seule colonne permise |
| `messages.read` | à l'ouverture d'un fil (`MarkThreadRead`, un effet : une page préchargée ne lit rien) : `update({ read_at })` des messages de l'autre partie encore non lus — `read_at` est la seule colonne permise au destinataire |
| `accountSettings.update` | le formulaire des alertes de `/mon-compte/parametres` : `update` des deux cases, rien d'autre ; la lecture (`getAlertSettings`) est un `maybeSingle` sous la RLS |

Reste sans appelant **la vue d'une fiche** (« 412 vues », « Vues cumulées ») :
`rpc("record_listing_view", { listing })` **avec la clé `service_role`**, depuis un
gestionnaire de route que la fiche appellerait, dédoublonnée par visiteur et sans compter
le vendeur — aucun rôle connecté n'exécute la fonction, un vendeur gonflerait ses vues.

### Quand une écriture échoue

`MutationResult` a deux statuts pour ce qui ne tient pas à la demande : `failed`
(`retryable` dit si recommencer tel quel a une chance d'aboutir) et `rate-limited`
(`retryAfterSeconds`). Un `toMutationFailure(error)` traduit l'erreur de PostgREST :

| Code SQL | Statut |
|---|---|
| `23514` règle métier, `23505` doublon, `23503` commune ou série inconnue | `invalid`, avec le message du champ concerné |
| `42501` interdit, `P0002` introuvable | `not-found` — dire « interdit » confirmerait que l'objet existe |
| `57014` délai dépassé, erreur réseau, base indisponible | `failed`, `retryable: true` |

Dans le navigateur, chaque action passe par `useMutation` : un rejet — coupure, serveur
redéployé entre deux clics — devient `failed` au lieu de remplacer la page par l'écran
d'erreur, et la saisie reste. `tests/mutations-client.test.mjs` refuse un composant qui
attendrait une action sans lui.

**Idempotence.** Un double envoi — réseau lent, nouvel essai après un délai — ne crée pas
deux annonces ni deux demandes. L'identifiant (`uuid`) se tire quand la page du formulaire
s'affiche — côté serveur : un composant client ne tire pas le hasard pendant son rendu
(règle 8) —, part dans un champ caché (`draftId`), et l'insertion fait
`on conflict (id) do nothing` ; le rôle connecté a reçu le droit d'écrire la colonne `id`
(migration 11). Le lien permanent en tire son suffixe (`idSlugSuffix`). Une fois le dépôt
enregistré, le formulaire le sait (`useDraftIdentity`) : revenir au formulaire et renvoyer
modifie l'annonce, au lieu de rejouer un dépôt que la base ignorerait.

**Ce que la base tient d'elle-même (migration 11).** Le navigateur choisit maintenant
l'identifiant d'un dépôt, donc son lien ; la base garde la main sur ce qui s'affiche :

* **un lien permanent ne désigne jamais une autre annonce** — pour le rôle connecté, il finit
  par les huit premiers caractères de l'identifiant (`idSlugSuffix`), et un lien qui a servi
  ne ressert plus (`retired_slugs`, rempli à chaque suppression). Le serveur, lui, choisit
  ses liens : les données de démonstration gardent les leurs ;
* **une annonce naît « Disponible »**, sans réservation ni prix d'avant, quel que soit
  l'envoi et le rôle ; un lot vendu ou réservé l'est ensuite par une mise à jour ;
* **le prix d'avant suit le prix** (`derive_listing_display`) : l'ancien quand il baisse,
  plus rien quand il remonte, inchangé sinon — la valeur envoyée est ignorée ;
* **un croisement ne se notifie qu'une fois** (`notifications_one_per_match`).

**Débit (audit M7), encore ouvert.** Un `checkRateLimit(userId, action)` en tête de chaque
mutation — une table et une fonction `security definer` suffisent, sans nouveau
fournisseur — rendra `rate-limited`, que l'interface sait déjà dire. En complément, une
règle de pare-feu sur les `POST` d'actions. Supabase Auth limite déjà, de son côté, les
connexions et les inscriptions.

**Rafraîchir.** Les actions revalident, au statut `saved`, des chemins concrets : la fiche,
la page de son jeu (`/pokemon`) et de sa commune (`/pokemon/avignon`), l'ancienne aussi
quand une modification déplace le lot ; et `refresh()` pour ce qui ne regarde que la
personne (liste d'attente, notifications et fils lus, alertes). Jamais tout le site ni un
motif de route (`tests/actions.test.mjs`, audit M5). Les lectures publiques mises en cache
portent une étiquette par domaine (`src/lib/data/cache-tags.ts`) : une écriture les
invalide par `updateTag`, qui fait attendre à la requête suivante les lignes fraîches —
l'auteur voit sa propre écriture. Annonce : `listings` ; demande : `wanted` ; profil et
avis : `profiles` ; vente clôturée : `listings` et `profiles` ; compte supprimé : les trois.
Les pages voisines d'une commune relisent les mêmes lignes, et suivent du même coup.

### Le cycle de vie des annonces (migration 15)

Une annonce quitte les listes **quatre-vingt-dix jours après le dernier geste de son
vendeur** — le dépôt, une modification, un changement de statut, une réservation, ou
« Prolonger » —, et **trente jours après sa sortie du marché** — vente ou expiration — elle
est **archivée** : ses photos sont supprimées, le texte, le prix et les avis restent, et
son lien répond toujours. Les durées vivent dans `src/lib/listing-lifecycle.ts` ;
`tests/schema-sync.test.mjs` les compare à celles d'ici.

* **Rien n'expire par une tâche.** Une annonce est expirée dès que sa date est passée :
  `listing_on_market(l)` le dit à la base — la politique d'ouverture des conversations,
  celle de la liste d'attente et `pro_only_count_by_game` l'appellent —, `isOnMarket` au
  site, qui écarte une annonce expirée de toute lecture publique. Sa page répond, hors de
  l'index ; son vendeur la retrouve dans « Mes annonces », d'où il la remet en ligne
  gratuitement (`renew_listing`).
* **Un geste du vendeur la relance** (`listings_renew_on_activity`) : toute mise à jour de
  sa ligne faite sous son identité, `auth.uid()`, que voient aussi les fonctions
  `security definer` qu'il appelle (`reserve_listing`, `close_deal`). Ni une vue comptée,
  ni la clé de service — paiement, tâche quotidienne, données de démonstration — ne la
  relancent. `renewed_at` n'est dans aucun droit de colonne : sans quoi un vendeur
  repousserait son échéance à 2099 depuis la console.
* **La tâche quotidienne** (`run_listing_lifecycle`, clé de service seule) ne fait que ce qui
  demande une écriture : prévenir le vendeur d'une annonce qui expire dans sept jours — une
  fois par mise en ligne (`listing_expiring`, dans la cloche ; par e-mail le jour où un
  SMTP sera branché) —, puis retirer les photos des annonces archivées. Le registre date
  leur décrochage, et le ménage supprime les fichiers chez Cloudflare le lendemain (§ 6).
  Une annonce visée par un **signalement encore ouvert** garde ses photos jusqu'à la
  décision : elles sont la pièce du dossier. Une vente clôturée fige ses photos
  (`freeze_listing_parts_after_deal`) ; l'archivage est le seul geste qui les retire.
* **Vercel Cron l'appelle** une fois par jour, à 4 h UTC (`vercel.json`), sur
  `/taches/quotidiennes` (`src/app/taches/quotidiennes/route.ts`), avec
  `Authorization: Bearer <CRON_SECRET>` comparé en temps constant ; sans secret, la route
  répond 503 et ne fait rien. Un verrou (`pg_advisory_xact_lock`) l'empêche de tourner
  deux fois à la fois : Vercel Cron livre parfois deux fois une échéance. Le ménage des
  fichiers photo s'y ajoutera avec Cloudflare Images.
* **La remontée** (`bump_started_at`, `bump_until`) s'écrit comme les autres options, par
  le service de paiement seul, qui pose aussi `renewed_at` : une annonce qu'on paie pour
  remonter est vivante. Le rang se déduit des deux dates (`getRankedAt`), aucune tâche ne
  le réécrit. Le paiement n'étant pas ouvert, rien ne les écrit encore.

À la migration, les annonces déjà en ligne partent pour quatre-vingt-dix jours à compter
de son application : aucune n'expire le jour où la règle arrive. Les migrations 14 et 15 se
collent chacune dans une exécution à part, la 14 d'abord — une valeur ajoutée à une
énumération ne s'emploie pas dans la transaction qui l'ajoute —, et **avant** de recharger
la démonstration, qui écrit désormais `renewed_at` et les dates de la remontée.

## 6. Photos : Cloudflare Images

**Décidé : Cloudflare Images** (septembre 2026) ; R2 est écarté, en fin de section. Trois
propriétés ont décidé, et R2 n'en offre aucune sans chantier :

* **il ne sert jamais le fichier reçu**, seulement des variantes qu'il ré-encode — réglées
  sans métadonnées, elles ne rendent pas la position GPS d'un original envoyé en
  contournant le formulaire (audit, E2) ;
* **il sait rendre une image privée** : sans URL signée, la photo d'un lot réservé aux pros
  ne s'affiche pas (§ 8) ;
* **le navigateur lui envoie le fichier directement**, par une adresse à usage unique : la
  limite de 4,5 Mo d'un corps de requête serveur ne s'applique pas, et aucune photo ne
  transite par nos fonctions.

Les durées et les variantes sont écrites une fois, dans `src/lib/photo-hosting.ts` :
`tests/photo-hosting.test.mjs` refuse que ce guide les contredise, et
`tests/schema-sync.test.mjs` que la migration du ménage le fasse.

1. **L'adresse de dépôt.** Une action serveur `preparePhotoUploads(count)` — bornée à
   huit, et au débit du compte — demande pour chaque photo une adresse à usage unique :
   `POST /accounts/{id}/images/v2/direct_upload` avec le jeton d'API, `requireSignedURLs:
   true` et une expiration de **10 minutes** (`expiry`, `directUploadExpiry`). Cloudflare
   la borne entre 2 minutes et 6 heures, 30 minutes sans rien dire ; le formulaire
   téléverse à l'envoi, juste avant l'action (`useListingSubmit`) : dix minutes couvrent
   huit photos sur une connexion lente, et une adresse perdue se redemande plutôt que de
   rester ouverte des heures. L'image reste **privée jusqu'à la publication** : un dépôt
   abandonné ne fait pas du site un hébergeur d'images. Cloudflare rend l'identifiant de
   l'image et l'`uploadURL`. **Pas d'identifiant choisi** : une image à identifiant choisi
   ne peut pas exiger d'URL signée.
2. **Le registre.** Dans la même action, le serveur inscrit l'identifiant dans
   `photo_uploads`, au nom du compte, avec la clé de service — un compte ne peut pas s'y
   inscrire lui-même. C'est ce registre, et non la forme de la clé, qui prouve à qui
   appartient l'image : la politique d'écriture de `listing_photos` le consulte, et pour
   tous les rôles — la clé de service comprise, que la RLS ne retient pas — le
   déclencheur `listing_photos_check_upload` : le fichier appartient au vendeur de
   l'annonce qui le reçoit, et celui d'un compte supprimé à personne.
3. **L'envoi.** Le navigateur envoie le fichier — déjà recadré en 4:3 et converti en WebP
   (`src/lib/photo-convert.ts`) — directement à l'`uploadURL`. La limite de 4,5 Mo d'un
   corps de requête serveur ne s'applique pas ; celle de Cloudflare, oui : 10 Mo, 12 000 px
   de côté, 100 mégapixels, la borne même du formulaire (`MAX_PHOTO_BYTES`) pour un envoi
   qui le contournerait. La référence devient `storage:<identifiant>`
   (`src/lib/photo-refs.ts`), que `toListingPhotoInserts` convertit en `storage_path`.
4. **La publication.** Après l'écriture de l'annonce, le serveur rend publiques les photos
   d'une annonce visible de tous (`PATCH /images/v1/{id}`, `requireSignedURLs: false`) ;
   celles d'une annonce réservée aux pros restent privées (§ 8). Changer l'audience
   bascule la visibilité de ses photos dans la même action, et Cloudflare purge alors ses
   copies en cache. **Dans cet ordre** : vers les pros, les photos passent privées *avant*
   `audience = 'pros'` ; vers tout le monde, elles ne redeviennent publiques qu'*après*
   `audience = 'everyone'` — jamais une photo publique sur un lot réservé.
   **L'identifiant peut changer à cette occasion** : la référence de l'API dit de ce
   `PATCH` qu'il « rend un nouvel UID » quand la visibilité change — ce
   qu'aucun compte n'a permis de vérifier. Le serveur relit donc l'`id` rendu et, s'il
   diffère, remplace la clé au registre (`update photo_uploads set key = …`, clé de
   service) : les photos suivent (`on update cascade`), avant que les pages soient
   rafraîchies. Une annonce vendue ne change plus d'audience, ses clés ne bougent plus.
   Et un fichier n'affiche qu'une photo (`listing_photos_one_photo_per_file`) : la clé
   remplacée ne touche que cette annonce. Partagé avec une annonce vendue, que rien ne
   modifie plus, le fichier aurait refusé sa nouvelle clé — Cloudflare l'aurait déjà, la
   base garderait l'ancienne.
5. **La livraison.**
   * **Hôte : `imagedelivery.net`**, pas un domaine personnalisé. Celui-ci
     (`https://<domaine>/cdn-cgi/imagedelivery/…`) doit être mandaté par Cloudflare, sur
     le même compte : il faudrait déplacer chez Cloudflare la zone DNS du site, servi par
     Vercel — qui déconseille de placer le site lui-même derrière un autre mandataire —,
     pour une adresse plus belle. Et la documentation ne montre la signature d'une photo
     privée que sur `imagedelivery.net`. Rien n'est figé pour autant : la base garde des
     clés, jamais des adresses, et changer d'hôte revient à changer
     `NEXT_PUBLIC_PHOTOS_URL`, puis redéployer — la CSP s'en déduit.
   * **Cinq variantes nommées**, créées à l'identique chez Cloudflare : des boîtes en 4:3,
     `fit: scale-down`, **métadonnées : aucune** (`metadata: none`), et aucune « toujours
     publique » (`neverRequireSignedURLs`), qui contournerait la signature. La variante
     `public`, créée par défaut, est supprimée.

     | Variante | Boîte | Sert |
     |---|---|---|
     | `w160` | 160 × 120 | miniatures de 48 à 76 px : galerie, messagerie, ventes |
     | `w320` | 320 × 240 | vignette sur téléphone, lignes du compte |
     | `w640` | 640 × 480 | vignette en grand écran |
     | `w1024` | 1 024 × 768 | carte de contexte d'un fil, vignette sur tablette |
     | `w1600` | 1 600 × 1 200 | photo en grand, image de partage, données structurées ; la largeur maximale d'un envoi |

   * **Pas de variantes flexibles.** Elles ne servent pas une image privée (« Flexible
     variants cannot be used for images that require a signed delivery URL »), et
     laisseraient n'importe qui choisir ses réglages — `metadata=keep` compris, qui garde
     le GPS d'un JPEG.
   * **Le gabarit** `NEXT_PUBLIC_PHOTOS_URL` finit par l'identifiant puis la variante :
     `https://imagedelivery.net/<hash du compte>/{key}/{variant}` (`src/lib/env.ts` le
     vérifie). `resolvePhotoUrl` y pose la clé et la plus grande variante : l'image de
     partage, les données structurées et le plan de site veulent la photo entière.
   * **Le chargeur `next/image`** (`src/lib/photo-loader.ts`) donne à chaque largeur du
     `srcset` la plus petite variante qui la couvre, au lieu de faire ré-optimiser par Next
     une image que Cloudflare a déjà ré-encodée ; il ne touche ni une adresse signée ni une
     adresse étrangère. Écrit et testé, il **n'est pas branché en phase 1** : un chargeur
     déclaré éteint l'optimiseur de Next (`/_next/image` répond 404, `next-server.js`), dont
     les photos de démonstration Unsplash ont besoin. Il se branche dans `next.config.ts`
     avec les photos — `images: { loader: "custom", loaderFile: "./src/lib/photo-loader.ts" }`
     dès que `NEXT_PUBLIC_PHOTOS_URL` est posée —, et **avant la première photo privée** :
     l'optimiseur de Next ne la servirait pas — sa requête interne ne porte pas la
     session —, et une URL signée qui lui parviendrait finirait dans son cache, commun à
     tous les lecteurs.
6. **Le ménage.** Les suppressions en cascade n'atteignent pas Cloudflare. **Une fois par
   jour**, Vercel Cron appelle la tâche quotidienne (`/taches/quotidiennes`, déclarée dans
   `vercel.json`, `crons` — celle du cycle de vie des annonces, § 5), qui vérifie
   `Authorization: Bearer <CRON_SECRET>` en temps constant, tire un
   identifiant de passage, puis branche `purgePhotoFiles` (`src/lib/photo-purge.ts`),
   écrit et testé : un lot demandé à `claim_photo_purge(purge_run, batch_size)` avec la clé
   de service, chaque fichier rendu retiré (`DELETE /images/v1/{id}`), et les lignes de
   ceux dont Cloudflare a confirmé le retrait effacées (`forget_purged_photos(file_keys)` :
   mille clés dans l'adresse d'une suppression PostgREST dépasseraient ce que les relais
   acceptent) — jamais dans l'autre ordre, qui laisserait chez Cloudflare une image que
   plus rien ne désigne. Et ainsi **lot après lot**, jusqu'à un lot incomplet ou 240
   secondes :
   * **un seul passage à la fois.** Le premier lot prend un bail de cinq minutes
     (`photo_purge_lease`), que `release_photo_purge` rend à la fin ; un passage qui le
     trouve tenu s'arrête sans rien prendre, et un passage tué ne le garde que jusqu'à
     l'échéance. Vercel Cron livre parfois deux fois la même échéance, et deux passages
     doubleraient le débit ;
   * **deux retraits par seconde, 480 fichiers par passage** au plus : avec un seul
     passage, 600 requêtes par cinq minutes, la moitié de la limite de l'API de
     Cloudflare — 1 200 par utilisateur, au-delà de laquelle tous ses appels sont refusés
     cinq minutes, adresses de dépôt des vendeurs comprises. Un `429` arrête le passage ;
   * **chaque appel a son délai** — dix secondes, à la base comme à Cloudflare — et aucun
     ne court au-delà des 240 secondes ; seuls l'oubli des derniers fichiers et le bail
     rendu viennent après, chacun dans son délai : le pire passage finit à 260 secondes,
     avant que Vercel n'arrête la fonction (300). Un lot ne prend que ce que le temps
     restant permet de retirer, au rythme observé ;
   * **ce qui est fait s'oublie et se dit au fil de l'eau**, par paquets de 25 fichiers :
     arrêté net, un passage n'en perd qu'un paquet, que la reprise rattrape ;
   * seule **« image introuvable »** compte comme déjà parti — un passage précédent l'a
     retiré sans pouvoir oublier sa ligne. C'est le code `5404`, **non vérifié** : la
     référence de l'API ne liste aucun code, celui-ci vient des forums de Cloudflare. **À
     confirmer au branchement sur les deux cas ordinaires du ménage** : retirer deux fois
     la même image, et retirer l'identifiant d'une adresse de dépôt expirée sans avoir
     servi — un dépôt abandonné —, puis lire chaque réponse. Un autre 404 — une route mal
     construite, un mauvais compte — se retente et se journalise, comme tout échec :
     compté comme parti, il ferait oublier des lignes dont le fichier reste ;
   * un fichier pris sans être retiré revient en reprise (`retry`) **une heure** plus
     tard — pas avant : un passage en cours le traite peut-être —, puis repart en fin de
     file. Les reprises ne gardent que **la moitié d'un lot** tant que des fichiers neufs
     attendent : celles qui échouent toujours — un code « introuvable » mal reconnu, par
     exemple — ne bloquent jamais les nouveaux, et le journal les dit à part (« déjà en
     reprise ») ;
   * le journal dit ce qui n'a pas été retiré, une ligne par réponse de Cloudflare, et
     **le retard** quand le passage s'arrête avant d'avoir tout pris. S'il revient chaque
     jour, planifier le ménage plus souvent, mais **jamais plus souvent que toutes les cinq
     minutes** : c'est la durée du bail, et un passage qui tomberait sur le précédent
     s'arrêterait aussitôt.
     L'offre Hobby de Vercel s'en tient à une fois par jour.

   Deux délais de grâce, que la base tient elle-même :
   * **7 jours pour un fichier jamais accroché** — dépôt abandonné, photos 4 à 8 dont le
     paiement n'est pas venu. Celles-ci sont téléversées au dépôt, mais le webhook ne les
     accroche qu'une fois l'option payée : une session de paiement vit au plus 24 heures,
     et un webhook en échec est relancé pendant trois jours (Stripe). Sept jours laissent
     encore trois jours pour rejouer un événement à la main.
   * **1 jour pour un fichier décroché** — photo retirée, annonce ou compte supprimés. Le
     délai couvre ce qui a déjà été servi et montre encore la photo : un onglet resté
     ouvert, le cache du routeur, une lecture gardée une heure en cache (§ 7) — et une
     modification défaite dans la journée : la photo remise depuis un formulaire qui la
     gardait retrouve son fichier, et le registre efface la date. Il n'a rien à couvrir
     pour les aperçus de partage : l'image de partage est dessinée par le site, et Facebook
     ou WhatsApp en gardent leur propre copie. Plus long, il laisserait en ligne une photo
     que le vendeur a retirée — parce qu'elle montrait l'étiquette d'un colis, par
     exemple.

   Le registre date lui-même le décrochage : `detached_at` se pose quand la dernière photo
   qui affichait le fichier part — cascades d'une annonce ou d'un compte comprises — et
   s'efface quand une photo le reprend (`listing_photos_track_upload`), le fichier
   verrouillé d'abord : une photo qui le reprend au même moment n'y laisse pas une date de
   retrait. Un fichier rendu par le ménage est d'abord marqué (`purge_started_at`) : plus
   aucune photo ne peut l'accrocher, même avec la clé de service
   (`listing_photos_check_upload`), et sa ligne n'est effacée qu'une fois le retrait
   confirmé. Sans cette marque, une photo accrochée entre la sélection et le retrait — un
   webhook de paiement rejoué ce jour-là — aurait perdu son fichier sans que rien ne le
   signale. La sélection relit chaque fichier sous verrou, et seulement au niveau
   d'isolement `read committed`, celui de PostgREST — la fonction refuse tout autre : sous
   un instantané figé, la relecture ne verrait pas la photo accrochée entre-temps. PGlite,
   qui n'a qu'une connexion, ne rejoue pas cette concurrence ;
   `tests/schema-security.test.mjs` en tient le texte. La clé étrangère de
   `listing_photos` empêche toujours d'effacer la ligne d'un fichier affiché
   (`supabase/tests/scenarios/11-photo-purge.sql`).

   **Réconciliation, une fois par mois.** Le ménage ne rattrape pas ce que le registre
   ignore : une ligne oubliée à tort, un téléversement dont l'inscription a échoué, une
   image retirée à la main. Un script, à écrire au branchement, liste les images du
   compte (`GET /accounts/{id}/images/v2`, page après page avec `continuation_token`) et
   les compare à `photo_uploads` : une image sans ligne, déposée depuis plus de sept jours,
   se retire ; une ligne sans image s'oublie si elle est marquée, et se signale si une
   photo l'affiche encore — un vendeur a perdu une photo.
7. **La CSP** (`src/lib/csp.ts`) : `img-src` reçoit l'hôte de livraison, `connect-src`
   l'hôte de dépôt (`https://upload.imagedelivery.net`). Le navigateur ne parle jamais à
   Supabase : son hôte n'a rien à faire dans la CSP.

Les photos 4 à 8 d'une annonce sans l'option (« en attente du paiement ») sont
téléversées et inscrites au registre comme les autres ; leurs identifiants voyagent dans
les métadonnées de la session de paiement, et le webhook les accroche à l'annonce (clé de
service) une fois `extra_photos` écrit. La RLS ne retient pas cette clé : le serveur
refuse donc, avant le paiement, tout fichier que la base refuserait à l'accrochage
(`findUnattachableUploads`, `src/lib/data/photo-uploads.ts`) — celui d'un autre compte,
qu'un vendeur glisserait parmi ses photos 4 à 8 et que le webhook rendrait public s'il
venait d'un lot réservé aux pros (`listing_photos_check_upload`) ; un fichier qu'une autre
annonce affiche déjà (`listing_photos_one_photo_per_file`) ; un fichier que le ménage a
pris. Refusés après le paiement, ils l'auraient fait payer pour rien. Un paiement abandonné
les laisse orphelines : le ménage les retire au bout de sept jours.

**Écarté : R2.** Des URL présignées `PUT` (SigV4) y auraient tenu lieu d'adresse de dépôt,
sous une clé `<compte>/<uuid>.webp`. Moins cher au stockage, R2 aurait demandé trois
chantiers que Cloudflare Images fait déjà :

* il sert les octets tels quels : les métadonnées d'un original envoyé en contournant le
  formulaire seraient servies, sauf à poser un Worker de transformation devant la
  livraison ;
* il ne sait rien d'une image privée : il faut un bucket privé et un Worker qui vérifie le
  lecteur pour les lots réservés aux pros ;
* il n'accepte pas de `POST` avec politique, donc aucune borne de taille à l'envoi (un
  `HEAD` après coup), et une URL présignée ne fonctionne que sur le domaine S3, avec du
  CORS sur le bucket.

**Le filigrane reste la ligne de crédit (décidé en octobre 2026).** La page pose le pseudo
du vendeur, et la référence de l'annonce sur la photo en grand, au bas de chaque photo
(`src/lib/watermark.ts`) : un signal de lecture, pas une protection. L'incruster dans
l'image ne sera reconsidéré que si la reprise de photos devient un problème constaté. Les
variantes servies par `imagedelivery.net` n'incrustent rien — une variante règle une
taille, un ajustement et des métadonnées, pas un calque ; Cloudflare ne dessine sur une
photo que dans un Worker (`cf.image.draw`, ou le binding Images et ses `.draw()` et
`.text()`). Deux voies ont été écartées :

* **un Worker devant la livraison**, qui servirait toutes les photos : le gabarit
  `NEXT_PUBLIC_PHOTOS_URL` — que `src/lib/env.ts` réserve aux deux formes de Cloudflare
  Images —, la signature des photos privées (§ 8) et la CSP changeraient avec lui, pour
  une image que le binding ne met pas en cache de lui-même et facture comme une
  transformation par combinaison ;
* **l'incrustation dans le navigateur avant l'envoi** — `src/lib/photo-convert.ts`
  redessine déjà chaque photo : rien de plus à héberger, mais le pseudo seul, la
  référence d'une annonce qui n'existe pas encore étant inconnue, et un envoi fait
  directement à l'API, sans le formulaire, passe sans.

## 7. Pages statiques et session

**Il n'y a plus de page HTML statique, et ce n'est pas la session qui l'a décidé.** La CSP
n'admet que les scripts qui portent le nonce de la réponse (`src/lib/csp.ts`, README
« Sécurité ») ; Next ne pose ce nonce que sur une page rendue à la demande, et le gabarit
racine lit donc la requête. Brancher `getCurrentUserId` sur les cookies ne coûte plus aucune
page statique : l'en-tête du gabarit racine (`SiteHeader`, les badges de la cloche et des
messages), la fiche (les outils du vendeur, le lien « Signaler »), le profil public et la page
d'une demande la liront sans rien changer à leur rendu. Restent statiques les icônes, les
images de partage, le plan de site et robots.txt, qui ne lisent pas la session.

Le plan qui tenait ici — activer `cacheComponents` et ne rendre à la demande que les îles
de la session — **ne tient plus** : une coquille prérendue garde les scripts de son build,
sans nonce, et la CSP les refuse (« Partial Prerendering (PPR) is incompatible with
nonce-based CSP », `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
`tests/security-headers.test.mjs` refuse `cacheComponents` et toute page `force-static` tant
que la CSP repose sur un nonce.

Ce qui coûte, c'est la base : chaque rendu d'une liste, d'une fiche ou d'une ville
l'interroge. On met donc en cache **les lectures, pas les pages**. Les chargeurs de
`src/lib/data/source.ts` lisent ce qu'un visiteur anonyme voit — annonces publiques,
profils, avis, demandes, compte des lots réservés — par le client public, dans le cache de
données de Next : les options de `fetch` (`next: { tags, revalidate }`), une heure
(`PUBLIC_READ_TTL_SECONDS`), sous une étiquette par domaine (`src/lib/data/cache-tags.ts` :
`listings`, `wanted`, `profiles`). `unstable_cache` n'est plus la voie : Next 16 l'a remplacé
par `use cache`, qu'exclut la CSP à nonce. Chaque liste se lit en entier, par pages
(`readAllPages`) : Supabase rend au plus 1 000 lignes par réponse, sans erreur, et une
lecture d'un seul appel perdait la suite en silence. Les pages suivent l'ordre de la clé et
reprennent après la dernière ligne lue, et chacune est une entrée du cache, sous ses 2 Mo.
Ce qui dépend de la session — badges, outils du vendeur, lots réservés aux pros — n'entre
jamais dans un cache partagé, et **le profil de la personne connectée non plus** : son
compte, son en-tête et ses droits de pro se lisent à la base (`profileRowById`). Lu dans la
liste en cache, un compte qui venait de naître répondait introuvable dans son propre espace
pendant une heure.

**Une écriture faite hors du site n'invalide pas ce cache.** Le site le fait — ses actions
par `updateTag`, la confirmation d'une inscription par `revalidateTag` ; rien d'autre ne le
fait. Cela concerne :

* **le script de démonstration** (`npm run supabase:seed`, et `--delete`) ;
* **une correction dans le Studio** de Supabase ;
* **le futur webhook de paiement**, qui écrit `pro_until` avec la clé de service (§ 8).

Dans les trois cas, les pages publiques montrent l'état d'avant jusqu'à l'expiration du
cache, une heure au plus : un badge PRO, une note, une annonce. Le webhook appelle donc
`revalidateTag(CACHE_TAGS.profiles, { expire: 0 })` après un forfait — et `CACHE_TAGS.listings`
après une option payée sur une annonce (`featured_until`, `urgent_until`, `extra_photos`) :
celui qui vient de payer regarde tout de suite. `revalidateTag` prend deux arguments en
Next 16, et s'appelle dans un gestionnaire de route ; `updateTag` est réservé aux actions.
Les droits, eux, prennent effet sans attendre, puisqu'ils se lisent à la base. Après un
chargement de démonstration ou une correction dans le Studio, attendre l'heure, ou vider
le cache. En local, arrêter le serveur, supprimer `.next/dev/cache/fetch-cache`
(`.next/cache/fetch-cache` pour `next start`), puis relancer. En production, une route
protégée par un secret, qui appelle `revalidateTag`, reste à écrire.

Les restes de l'ancien modèle sont partis. Aucune page n'exporte plus `revalidate` : seul
le plan de site le garde, régénéré toutes les heures. Et `generateStaticParams` ne reste
qu'à `/[game]` et `/[game]/[city]`, pour `dynamicParams = false`, qui répond 404 hors de la
liste. Ailleurs il ne prérendait rien : le build tentait chaque page et y renonçait au
premier en-tête lu — pas même les images de partage, qui se rendent à la première demande
puis restent en cache, avec ou sans lui (`MISS` puis `HIT` dans les deux cas). Il a quitté
les annonces, les profils et les demandes le 1er octobre 2026 : 68 rendus de moins à chaque
build, dix mille de moins à dix mille annonces, et le même comportement — 404 hors de la
liste, lot réservé aux pros introuvable pour un particulier, lot vendu toujours servi.
`tests/security-headers.test.mjs` refuse qu'il revienne sur une page sans
`dynamicParams = false`.

Les segments rendus à la demande peuvent recevoir leurs `loading.tsx` : le flux HTML
partirait avant la fin du rendu. En phase 1, les données sont en mémoire et un squelette ne
ferait que clignoter.

## 8. Offre pro : statut, forfait et annonces réservées

Les migrations portent déjà tout le modèle : `profiles.account_type`, `company_name`,
`siret`, `legal_name`, `pro_verified_at`, `pro_until`, `listings.audience`, la fonction
`is_active_pro(uid)`, la politique de lecture qui n'admet une annonce réservée que pour son
vendeur, un pro au forfait actif ou les participants d'une conversation à son sujet, et
`pro_only_count_by_game()`, qui dit aux autres combien de lots les attendent sans en
montrer un seul.

**Le statut professionnel est branché** (migration 16). Il s'écrit à la déclaration du
SIRET, dans Paramètres : l'action relit la forme, `declareProStatus`
(`src/lib/data/pro-status-mutations.ts`) interroge le répertoire des entreprises
(`src/lib/company-registry.ts`), puis écrit `account_type`, `siret`, `legal_name`,
`pro_verified_at` et `company_name` avec la clé `service_role` — aucune de ces colonnes
n'est dans les droits du rôle connecté, sans quoi n'importe qui se passerait pro depuis la
console. Un SIRET ne sert qu'un compte (`profiles_one_account_per_siret`) ; on repasse en
particulier par `leave_pro_status()`, soi-même, jamais avec un forfait en cours. Le statut
porte le badge et la fiche ; seul le forfait ouvre les lots réservés (`is_active_pro`,
inchangée), et il suppose le statut (`profiles_plan_needs_pro`). `INSEE_SIRENE_API_KEY`,
facultative, ouvre la vérification des entreprises non diffusées ; la réponse de Sirene est
reconstituée d'après sa documentation et reste à confirmer avec une vraie clé.

Restent trois branchements :

1. **Le paiement écrit `pro_until`**, et lui seul. Le webhook du prestataire — un
   gestionnaire de route, qui vérifie la signature et tient un journal d'événements pour
   ne jamais appliquer deux fois le même — met à jour la ligne avec la clé `service_role` :
   le rôle `authenticated` n'a pas le droit d'écrire `pro_until` (révoqué dans la
   migration). La souscription n'est proposée qu'à un compte professionnel, et la base la
   refuse sinon. Même chemin pour `featured_until`, `urgent_until`, `extra_photos` et les
   dates de la remontée (`bump_started_at`, `bump_until`, avec `renewed_at`). Puis il
   invalide le cache des pages publiques (`CACHE_TAGS.profiles`, `CACHE_TAGS.listings`),
   qu'aucune écriture faite hors du site ne touche (§ 7).
2. **Les photos d'une annonce réservée sont privées chez Cloudflare**, et **la page ne
   porte jamais leur URL signée**. Elle porte une adresse du site,
   `/photos/<clé>/<variante>`, que le chargeur `next/image` décline par largeur comme les
   autres (§ 6). Un gestionnaire de route y répond à chaque image : il relit la session,
   vérifie sous la RLS que le lecteur voit une annonce qui affiche ce fichier — un
   `select` de `listing_photos` par `storage_path`, avec le client utilisateur —, répond
   404 sinon (dire « interdit » confirmerait que le fichier existe), puis redirige vers
   l'URL signée de cette variante (`signPrivatePhoto`, `src/lib/photo-signing.ts`). La
   signature est celle de la documentation de Cloudflare : `exp`, puis `sig`, le
   HMAC-SHA256 hexadécimal du chemin et de sa requête avec
   `CLOUDFLARE_IMAGES_SIGNING_KEY` ; `tests/photo-signing.test.mjs` rejoue le code de
   cette documentation, aucun compte n'ayant servi à la vérifier.

   **Durée : 10 minutes au moins, l'expiration arrondie aux 5 minutes suivantes** — dix à
   quinze minutes. Courte, parce qu'elle ne sert qu'à suivre la redirection : c'est la
   route, pas la signature, qui décide qui voit la photo, à chaque chargement. Une page
   restée ouverte tout un après-midi, une image chargée tard par le défilement, une
   galerie qu'on feuillette le lendemain : chacune redemande la route et reçoit une
   signature neuve — ce qu'une URL signée écrite dans la page n'aurait permis qu'avec une
   durée de plusieurs heures. L'arrondi donne la même adresse à tous les lecteurs d'un
   même intervalle, que le navigateur et Cloudflare resservent de leur cache ; la
   redirection se garde dans le navigateur (`Cache-Control: private, max-age`) jusqu'à une
   minute avant l'expiration. Une URL recopiée hors du site meurt en un quart d'heure au
   plus, et un forfait qui expire ferme la porte à l'image suivante.

   **Écarté : signer au rendu de la page.** La page d'un lot réservé est rendue pour
   chaque lecteur, jamais mise en cache pour tous, mais une URL signée n'y vaut que pour
   une variante — la vignette aurait téléchargé la photo en grand, ou la galerie agrandi
   une vignette — et pour une durée fixée au rendu : une image paresseuse chargée après
   l'expiration restait vide. Aucune variante « toujours publique » : elle contournerait
   la signature. Et une photo privée ne passe jamais par l'optimiseur de Next, dont le
   cache est commun à tous les lecteurs.

   Au branchement, le mapper donne cette adresse aux photos d'une annonce
   `audience = 'pros'` (`toListingPhoto` et `toConversationListing` reçoivent l'audience),
   et `routes.ts` la déclare. Oubliée, une photo privée tomberait sur son adresse
   publique, que Cloudflare refuse sans signature : l'oubli casse l'image, il ne la
   montre pas. La modification d'une annonce reconnaît alors une photo conservée à sa
   clé, jamais à son adresse — l'adresse change avec l'audience.
3. **La session ne se lit que là où elle décide.** `src/app/annonces/[slug]/page.tsx` ne lit
   la session que si l'annonce est absente du public ; `/pro/lots` de même. Toutes les pages
   sont déjà rendues à la requête — le nonce de la CSP, § 7 —, mais une lecture de session de
   plus est une requête d'authentification de plus : elle reste là où la réponse en dépend.

En phase 1, `DEMO_USER_ID=u-13 npm run dev` montre le site tel qu'une boutique le voit.

## 9. Suppression de compte

`auth.admin.deleteUser(id)` supprime le compte, et les cascades font le reste : profil,
réglages, annonces, demandes, conversations, messages, ventes, liste d'attente,
notifications, blocages, signalements déposés. Trois exceptions, écrites dans le schéma :

* **Les avis laissés restent sur le profil noté.** La page Paramètres le promet (« ils
  leur appartiennent, pas à vous ») : `reviews.reviewer_id`, `deal_id` et `listing_id`
  passent à null au lieu d'emporter l'avis, et la note de la personne notée ne bouge pas.
  L'application les affiche déjà : « Compte supprimé », sans lien de profil, « sur un lot
  retiré depuis ».
* **Une annonce avec une vente clôturée ne se supprime pas** depuis le tableau de bord
  (`deals.listing_id … on delete restrict`), mais elle part avec le compte de son vendeur :
  ses ventes sont supprimées avant que la restriction ne soit vérifiée.
* **Les fichiers photo restent chez Cloudflare**, le temps du ménage : `photo_uploads`
  garde leurs lignes, propriétaire nul, la cascade date leur décrochage, et la tâche du
  § 6 les retire le lendemain.

L'action (`deleteAccountAction`) lit avant la suppression ce que le compte montrait au
public — ses fiches, ses demandes, son profil — et ne rafraîchit que ces pages-là.

## 10. Données de démonstration

```
npm run supabase:seed                # charge la démonstration, ou complète ce qui manque
npm run supabase:seed -- --delete    # retire les comptes de démonstration, et tout ce qui en dépend
```

Le script (`scripts/supabase-seed.mjs`) charge dans le projet Supabase de `.env` les 15
comptes, leurs 41 annonces avec séries et produits, 18 demandes, 11 conversations et
15 messages, 7 ventes clôturées, 9 avis, 4 inscriptions en liste d'attente et
11 notifications. Les lignes sont celles de la phase 1 (`TABLES`, `src/lib/data/source.ts`),
déjà au format de la base : le script traduit les identifiants — `u-01`, `l-07` deviennent
des UUID v5, toujours les mêmes — et choisit l'ordre que les déclencheurs acceptent
(`scripts/supabase-seed/plan.mjs`, tenu par `tests/supabase-seed.test.mjs`).

**Les comptes.** Un compte d'authentification par profil, confirmé d'office, à l'adresse
`<pseudo>@bulktcg.example` — un domaine réservé : aucun courriel ne part. Ils partagent un
mot de passe tiré au premier passage et écrit dans `.env` (`DEMO_ACCOUNTS_PASSWORD`),
jamais affiché. `lecomptoirdukado@bulktcg.example` est le particulier de la démonstration,
`repaire_du_joueur@bulktcg.example` une boutique au forfait actif.

**Sans photos jusqu'à la phase 3.** Les photos de démonstration sont des adresses Unsplash,
pas des fichiers chez Cloudflare : les annonces chargées s'affichent « Sans photo ». Au
branchement de Cloudflare Images, le script téléversera
**une image par photo d'annonce**, 129 et non 26 — une même adresse sert plusieurs
annonces, 25 des 26, dont 22 chez plusieurs vendeurs —, l'inscrira au registre
**au nom du vendeur de cette annonce**, puis écrira `listing_photos` avec l'identifiant
rendu : un fichier n'affiche qu'une photo (`listing_photos_one_photo_per_file`) et
n'appartient qu'au vendeur de l'annonce qui le reçoit (`listing_photos_check_upload`).

**Avec les déclencheurs, pas autour.** La clé de service passe outre la RLS, pas les
déclencheurs. Le profil naît de l'inscription (`handle_new_user`) et ses réglages du
profil ; la clé complète le reste — présentation, forfait pro, fiche boutique. Une annonce
naît « Disponible », sans réservation ni prix d'avant, quoi qu'on envoie
(`derive_listing_display`, migration 11) : celle qui ne l'est pas en démonstration naît
donc ainsi — au prix d'avant quand elle a baissé, et sans vues —, puis des mises à jour la
finissent comme le site l'aurait vue évoluer. Le prix baisse, et la base garde l'ancien —
les quatre baisses de la démonstration ; elle est réservée, pour la personne désignée s'il
y en a une — six réservations, dont deux désignées ; ou elle est vendue, et `count_sale`
compte la vente. Ses vues reviennent en dernier, avec sa date de mise à jour : chaque mise
à jour a daté la fiche de l'instant, sauf celle qui fait bouger les vues — une vue comptée
n'est pas une modification. Une annonce, ses séries et ses produits sont finis avant sa
vente clôturée, qui les fige (`freeze_listing_after_deal`,
`freeze_listing_parts_after_deal`). Un avis ne porte que sa vente et ses
notes : `stamp_review` pose la personne notée, `refresh_rating` sa note, `notify_review` sa
notification — datée ensuite de l'avis et marquée lue, pour que chaque cloche compte ce
qu'elle comptait en démonstration. Les messages partent dans l'ordre, et
`touch_conversation` date chaque conversation de son dernier message. Trois écarts en
découlent, voulus :

* **Les notes et les historiques de ventes sont ceux des données chargées**, pas ceux
  qu'affichait la démonstration : `lecomptoirdukado` y était noté 4,9 sur 156 avis, avec
  162 ventes ; la base le note 5,0 sur ses 2 avis et compte sa vente. Les écrire à la main
  ferait mentir le profil sur la liste d'avis affichée en dessous.
* **L'avis d'un compte supprimé** ne s'insère pas tel quel : un avis exige sa vente. Le
  script rejoue ce qui le produit — un compte, son lot, la vente, l'avis, puis la
  suppression du compte — et les cascades laissent l'avis à la personne notée, sans
  auteur, vente ni annonce.
* **Les cinq conversations antérieures aux messages de la démonstration** (`c-h03`…,
  citées par les ventes) naissent masquées des deux côtés : vides, elles n'encombrent
  aucune messagerie — en phase 1, elles n'y figuraient pas.

**Relancer** n'ajoute que ce qui manque : chaque étape lit d'abord ce qui est là, à ses
identifiants, et un second passage laisse chaque ligne identique. Une annonce finie — ses
vues le disent — n'est plus touchée, même si on l'a changée depuis sur le site. Les dates
restent celles du premier chargement et vieillissent ensuite ; pour une démonstration à
jour, retirer puis recharger. Le retrait supprime les comptes de démonstration, et les
cascades emportent profils, réglages, annonces, demandes, conversations, ventes, avis et
notifications. Il laisse les liens des annonces et des demandes parties dans
`retired_slugs` (migration 11) : un lien partagé ne désignera jamais une autre annonce.
Le rechargement les reprend quand même — chacun pour la même annonce, au même
identifiant : `check_permalink` ne tient que le rôle connecté, et la clé de service choisit
ses liens ; les liens de démonstration, qui ne finissent pas par l'identifiant, ne
passeraient pas autrement.

**Rejoué hors réseau** (`tests/supabase-seed-replay.test.mjs`) : tout le chargement passe
sur les migrations, dans PGlite, sous le rôle de la clé de service et avec leurs
déclencheurs — chaque annonce doit en ressortir telle qu'en démonstration, statut,
réservation, prix d'avant, vues et dates compris ; un second passage ne rien écrire ; le
retrait ne rien laisser, et le rechargement passer par-dessus les liens retirés. Une
migration qui change ce que la base fait d'une ligne s'y voit avant qu'on recharge le
projet — c'est ainsi que la migration 11 aurait fait perdre, sans un mot, les réservations
et les baisses de prix de la démonstration.

## 11. Tester la base

```
npm install --no-save @electric-sql/pglite
node supabase/tests/run.mjs            # les migrations, une à une
node supabase/tests/run.mjs supabase   # le fichier unique, supabase/setup.sql
```

Les dix-sept migrations sont rejouées sur un PostgreSQL réel (PGlite), après une émulation
minimale de Supabase (`supabase/tests/prelude.sql`), puis 164 scénarios sous les rôles de
l'API, rangés par domaine dans `supabase/tests/scenarios/` et joués dans l'ordre de leurs
fichiers — chacun reprend la base là où le précédent l'a laissée. Le code de sortie compte
les écarts : une règle retirée d'une migration fait échouer son scénario.

Chaque scénario dit ce qu'il attend. Un refus déclare son motif (`-- @error`, un extrait du
message) : lever ne suffit pas, sans quoi une faute de frappe dans le SQL passerait pour la
règle qui refuse. Un parcours déclare ses lignes (`-- @expect`, le JSON exact du dernier
résultat) ou vérifie lui-même par `raise exception` : un parcours qui n'affirme rien
passerait toujours. Les deux ont été falsifiés — faute de frappe, valeur attendue fausse,
motif ou affirmation retirés, règle de `waitlist_count` supprimée, délais du ménage
raccourcis, déclencheurs du registre ou `on update cascade` retirés, appartenance d'un
fichier ou unicité d'une photo par fichier retirées, bornes, rotation, part des reprises
et bail du ménage changés, contrôle du niveau d'isolement retiré : chacun devient un
écart. Ce
qui ne se voit que sous la concurrence — verrous, `skip locked`, relecture —, PGlite ne
le rejoue pas : `tests/schema-security.test.mjs` en tient le texte, falsifié de même.

## Liste de contrôle

- [ ] la base est créée — `supabase/setup.sql` dans l'éditeur SQL, ou `db push` (dix-sept migrations, dans l'ordre) —, toutes les communes chargées (`npm run supabase:communes`, 35 363 lignes), toutes les séries (`npm run supabase:editions`, 214 lignes), et `tests/schema-sync.test.mjs`, `tests/schema-security.test.mjs` et `supabase/tests/run.mjs` aussi
- [ ] variables vérifiées au démarrage (`src/lib/env.ts`), `DEMO_USER_ID` absente de la production
- [x] clients public, utilisateur et administrateur ; cookies `httpOnly` ; session lue par `getClaims()` ; `proxy.ts` ; connexion, inscription, liens reçus par e-mail, déconnexion (§ 3) — Google reste désactivé, sans route OAuth
- [ ] tableau de bord : Site URL, Redirect URLs, mot de passe de 12 caractères, les deux modèles d'e-mail, un SMTP à soi (§ 3)
- [ ] `cacheComponents` éteint tant que la CSP repose sur un nonce (§ 7) ; lectures publiques en cache par pages, une étiquette par domaine (une par annonce, jeu et commune quand le volume le demandera) ; profil de la personne connectée et droits de pro lus sans cache
- [ ] chaque lecture branchée, `unwrap()` qui lève sur panne ; RPC de recherche, de facettes, de comptes et de croisement écrites
- [x] chaque écriture passe par `performWrite` et rend `saved` ; `toMutationFailure` ; idempotence des dépôts ; migration 11 (`create_listing`, `update_listing`, `open_conversation`)
- [ ] la migration 11 collée dans l'éditeur SQL du projet existant
- [ ] les migrations 12 puis 13 (« Cartes à l'unité ») collées dans le projet existant, en deux exécutions
- [ ] les migrations 14, 15 puis 16 (cycle de vie des annonces, statut professionnel) collées dans le projet existant, en trois exécutions, avant de recharger la démonstration — puis la 17 (réserver respecte les blocages), à part elle aussi. Tant qu'une manque, les lectures lèvent en nommant ses colonnes (`assertColumns`)
- [ ] `CRON_SECRET` posé sur Vercel, et la tâche quotidienne (`/taches/quotidiennes`) vue dans « Cron Jobs » — sans elle, ni avertissement à sept jours de l'échéance, ni retrait des photos archivées
- [ ] **bloquant avant d'ouvrir les inscriptions au public** : `checkRateLimit` (audit M7) devant la connexion, l'inscription et le mot de passe oublié. Supabase Auth limite par adresse IP, et toutes ces demandes partent du serveur : ses plafonds comptent le site entier, et un seul abus épuise le quota de tout le monde
- [x] écritures sans appelant branchées : messages lus, réglages d'alerte
- [ ] la vue d'une fiche (`record_listing_view`, clé de service), dédoublonnée par visiteur
- [ ] photos : adresses de dépôt à 10 minutes, registre, visibilité selon l'audience (clé remplacée si Cloudflare en rend une autre), cinq variantes nommées sans métadonnées et `public` supprimée, route `/photos/<clé>/<variante>` des lots réservés, chargeur `next/image` branché, CSP, ménage quotidien (Vercel Cron, `CRON_SECRET`, `claim_photo_purge`, `forget_purged_photos` et `release_photo_purge`, code « image introuvable » vérifié sur un vrai compte), réconciliation mensuelle
- [ ] webhook de paiement idempotent : `pro_until` (sur un compte professionnel seulement), `featured_until`, `urgent_until`, la remontée (`bump_started_at`, `bump_until`, `renewed_at`), `extra_photos` et les photos retenues, puis l'invalidation du cache des pages publiques (§ 7)
- [ ] revalidation par étiquettes ; changer le statut se voit tout de suite sur la fiche, la page du jeu et celle de la commune
- [ ] `npm run verify` et `npm run smoke` verts
