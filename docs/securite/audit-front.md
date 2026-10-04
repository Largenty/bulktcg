# Audit de sécurité du front — BulkTCG

30 septembre 2026 · branche `refonte-design`, arbre de travail non commité.

Suite du rapport : [`audit-front-suite.md`](audit-front-suite.md) — constats faibles et
informatifs, ce qui est déjà bien protégé, ce qui n'a pas pu être vérifié, et les points à
transmettre à la modélisation (Supabase).

## Synthèse

Aucun constat critique. Pas de XSS trouvée, pas d'IDOR, pas de redirection ouverte, pas
d'affectation de masse, et aucune annonce réservée aux pros ne fuit par une route publique
(vérifié en direct : fiche, image de partage, signalement, recherche, plan de site). La
couche données contrôle identité et propriété à chaque écriture, et les migrations doublent
ces contrôles. Les risques sont ailleurs : dans ce que la phase 2 va brancher, et dans
quelques contrôles qui manquent à la frontière.

Les cinq risques les plus importants :

1. **E1 — En phase 2, la session sera lisible par tout script de la page.** `@supabase/ssr`
   pose ses cookies avec `httpOnly: false` par défaut, aucune CSP n'existe, et le code prévoit
   d'insérer le script d'une régie publicitaire dans la page. Une XSS ou une régie compromise
   vaudra vol de session.
2. **E2 — Les photos publiées garderaient leurs métadonnées EXIF, position GPS comprise.** Le
   fichier part tel quel dans un bucket public, et l'URL de l'original est dans le HTML de la
   fiche : l'adresse du vendeur, que l'inscription promet de ne jamais publier.
3. **M2 — Pour qui un lot est réservé fuit vers tout compte connecté.** La page « Déposer une
   recherche » sérialise 200 annonces complètes dans un composant client, `reservedForId`
   compris, avec la correspondance identifiant → pseudo. Actif aujourd'hui.
4. **M4 — Une annonce vendue et notée reste modifiable.** Titre, description, prix : le
   vendeur réécrit la pièce à laquelle l'avis « lot conforme à l'annonce » se rapporte.
   Actif aujourd'hui, et permis par la base.
5. **M5 — N'importe quel compte pourra invalider tout le cache du site.** « Tout marquer comme
   lu » appelle `revalidatePath("/", "layout")` : chaque appel rend périmées les quelque 800
   pages statiques.

À traiter ensuite : M1 (aucun en-tête de sécurité, à faire avec E1), M3 (option « 8 photos »
accordée par le formulaire), M6 (messagerie qui tombera quand une annonce devient invisible),
M7 (aucune limitation de débit), M8 (session de démonstration ouverte par défaut).

## Suivi des corrections — 30 septembre 2026

Tous les constats **actifs** de gravité moyenne sont corrigés, chacun avec le test qui
l'aurait attrapé, falsifié (retirer la correction fait échouer le test).

| Id | Correction | Où | Tenu par |
|---|---|---|---|
| M1 | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS en HTTPS ; `X-Powered-By` retiré. Puis la CSP sans `'unsafe-inline'` pour les scripts : un nonce neuf par réponse, posé par le proxy — chaque page est rendue à la demande | `next.config.ts`, `src/proxy.ts`, `src/lib/csp.ts`, `src/app/layout.tsx` | `tests/security-headers.test.mjs`, smoke `csp.policy` |
| M2 | Le navigateur ne reçoit plus que ce que le croisement lit (`MatchCandidate`) | `src/lib/match-candidate.ts`, les deux pages de dépôt de recherche | `tests/match-candidate.test.mjs`, smoke |
| M3 | L'option se lit sur l'annonce ; la case cochée n'est qu'une demande, et les photos 4 à 8 attendent le paiement | `src/lib/photo-allowance.ts`, `listing-mutations.ts`, récapitulatif | `tests/photo-allowance.test.mjs`, `tests/mutations.test.mjs` |
| M4 | Une annonce à vente clôturée est figée : couche données, page de modification, lien « Modifier » retiré, déclencheurs `freeze_listing_after_deal` et `freeze_listing_parts_after_deal` | `listing-mutations.ts`, `modifier/page.tsx`, migration 7 | mutations, `schema-security`, 4 scénarios PostgreSQL, smoke |
| M6 (actif) | Un lot réservé aux pros ne se propose plus à un particulier, ni dans la couche données ni en base | `message-mutations.ts`, politique d'ouverture des conversations (migration 10) | `tests/pro-audience-writes.test.mjs`, `schema-security`, 1 scénario PostgreSQL |
| E2 (en partie) | Les photos sont ré-encodées en WebP dans le navigateur, ce qui retire les EXIF, GPS compris | `src/lib/photo-convert.ts` | `tests/photo-format.test.mjs`, smoke |

Deuxième vague, le même jour — les constats latents qui pouvaient l'être avant la bascule :

| Id | Correction | Où | Tenu par |
|---|---|---|---|
| M5 | Plus aucune action n'invalide tout le site ni un motif de route : des chemins concrets — la fiche, la page de son jeu et de sa commune, l'ancienne quand le lot se déplace, le profil de la personne notée — et `refresh()` pour ce qui ne regarde que la personne (liste d'attente, notifications lues). La suppression de compte lit d'abord ce que le compte publiait | `src/app/actions/*`, `revalidate.ts` | `tests/actions.test.mjs` |
| M6 (latent) | Les participants d'une conversation gardent la lecture de son annonce, même devenue réservée aux pros ou quand le forfait de l'acheteur expire : la politique de lecture des annonces les admet, et le fil ne tombe plus | politique « annonces lisibles selon leur audience » (migration 10), `getListingForViewer` | `tests/listings-data.test.mjs` |
| M8 | La session de démonstration n'existe plus en production ni une fois Supabase configuré ; `DEMO_USER_ID` restée là fait échouer le build, et le serveur vérifie sa configuration au démarrage | `src/lib/env.ts`, `session.ts`, `src/instrumentation.ts` | `tests/env.test.mjs` |
| E2 | Les photos passent chez Cloudflare Images — décidé, R2 écarté : il servait les octets tels quels —, qui ne sert jamais le fichier reçu mais cinq variantes nommées, ré-encodées, réglées sans métadonnées ; aucune variante flexible, qui laisserait demander `metadata=keep`. Les photos d'un lot réservé aux pros sont privées : la page porte une route du site qui revérifie le lecteur à chaque image et le redirige vers une URL signée de dix à quinze minutes. Le registre `photo_uploads` dit à qui appartient chaque fichier, et le ménage quotidien retire ce qu'aucune photo n'affiche plus — sept jours après un dépôt jamais accroché, un jour après un retrait | `supabase/README.md` § 6 et 8, `src/lib/photo-hosting.ts`, `src/lib/photo-signing.ts`, migrations 4 et 10 | `tests/photo-hosting.test.mjs`, `tests/photo-signing.test.mjs`, `tests/schema-security.test.mjs`, `tests/schema-sync.test.mjs`, 23 scénarios PostgreSQL (`03-photos`, `11-photo-purge`) |
| — | Une action rejetée (coupure, serveur redéployé) ne remplace plus la page par l'écran d'erreur : `useMutation` en fait un compte rendu `failed`, et la saisie reste ; `MutationResult` sait dire `failed` et `rate-limited` | `src/components/ui/useMutation.ts`, `mutation-result.ts`, `PersistenceNote` | `tests/mutations-client.test.mjs` |
| F9 | `resolvePhotoUrl` ne laisse passer qu'une adresse Unsplash (la démonstration) ; en base, une URL ne peut plus tenir lieu de clé de fichier, même écrite par la clé de service — l'image de partage ne télécharge jamais une adresse choisie par un tiers | `src/lib/data/mappers/shared.ts`, `photo_uploads.key` | `tests/photo-files.test.mjs`, 1 scénario PostgreSQL |
| — | Les identifiants reçus du navigateur passent tous par un seul schéma ; un fichier glissé dans le champ caché d'une modification créait une nouvelle annonce | `src/lib/schemas/record-id.ts`, `submitListing`, `submitWanted` | `tests/actions.test.mjs` |
| F1 | `suivant` est désormais consommé : la connexion et l'inscription le lisent, le portent dans un champ caché, et `safeReturnPath` le filtre à la lecture comme dans le schéma de l'action — un chemin du site ou l'accueil du compte, jamais `//hôte`, `/\hôte` ni une URL absolue. Une connexion réussie y redirige | `src/lib/routes.ts`, `schemas/fields.ts`, `actions/auth.ts`, pages `/connexion` et `/inscription` | `tests/routes.test.mjs` |

L'instantané de prix et de titre dans `deals`, proposé pour M4, n'est plus nécessaire :
l'annonce ne bouge plus après la vente, le récapitulatif lit donc le prix vendu.

**Restent ouverts**, tous latents : E1 (cookies de session et régie publicitaire — la
réponse est écrite, `httpOnly` imposé à `@supabase/ssr`, `supabase/README.md` § 3), M7 (le
limiteur lui-même ; le statut `rate-limited` et son affichage existent), et les constats
faibles F2 à F11, hormis F9.

Les scénarios PostgreSQL vivent désormais dans le dépôt (`supabase/tests/`) :
`npm install --no-save @electric-sql/pglite`, puis `node supabase/tests/run.mjs` — 127 scénarios,
0 écart.

## Périmètre et méthode

* **Lu** : `src/app/actions/*`, `src/lib/data/*` (lectures, mutations, mappers, session,
  couture), `src/lib/schemas/*`, les pages et les 71 modules `"use client"`, `next.config.ts`,
  `src/app/layout.tsx`, les onze migrations de `supabase/migrations/`, `supabase/README.md`.
* **Essayé** contre le serveur de dev (`http://localhost:3000`, `next dev`, compte de
  démonstration u-01) : en-têtes, redirections, optimiseur d'images, charges RSC de 14 pages,
  réflexion de paramètres, annonce réservée aux pros. Un seul `POST` d'action serveur, sur
  une action sans effet en phase 1 (`markNotificationsReadAction`), pour vérifier le contrôle
  d'origine.
* **Appelé directement** : les schémas Zod et la couche données, dans des scripts placés dans
  `/tmp` et lancés par `node --import ./tests/alias-hook.mjs`, avec `DEMO_USER_ID` variable.
* **Dépendances** : `npm audit` (réseau disponible). `@supabase/ssr` 0.12.7 récupéré par
  `npm pack` dans `/tmp` pour lire ses valeurs par défaut — rien n'a été installé dans le dépôt.
* **Versions** : next 16.3.3, react et react-dom 19.2.8, zod 4.4.3.
* **Fichiers mouvants** : deux autres agents modifiaient `src/`, `tests/`, `supabase/` et
  `docs/donnees/` pendant la lecture (11 h 15 – 11 h 50). Les numéros de ligne valent pour ce
  moment ; chaque renvoi nomme aussi la fonction ou le composant.

**Gravité** — *critique* : exploitable aujourd'hui, compromission large ; *élevée* : atteinte
grave à la session ou à la vie privée, probable à la bascule si rien ne change ; *moyenne* :
faille réelle mais bornée (donnée d'un tiers, intégrité, disponibilité, contournement
applicatif rattrapé par la base) ; *faible* : défense en profondeur, robustesse ; *info*.
**État** — *actif* : observable aujourd'hui ; *latent* : se matérialise en phase 2 si le plan
actuel est suivi tel quel.

## Tableau des constats

| Id | Gravité | État | Constat |
|---|---|---|---|
| E1 | élevée | latent | Cookies de session lisibles en JavaScript, sans CSP, avec un script de régie prévu |
| E2 | élevée | latent | Photos publiées avec leurs EXIF (GPS) |
| M1 | moyenne | actif | Aucun en-tête de sécurité ; `X-Powered-By` exposé |
| M2 | moyenne | actif | `reservedForId` et données d'annonces sérialisés vers le client |
| M3 | moyenne | actif | Option payante « 8 photos » accordée par le formulaire |
| M4 | moyenne | actif | Annonce vendue, notée, toujours modifiable |
| M5 | moyenne | latent | Invalidation globale du cache par n'importe quel compte |
| M6 | moyenne | latent / actif | Messagerie en erreur si l'annonce devient invisible ; lot réservé proposé à un particulier |
| M7 | moyenne | latent | Aucune limitation de débit ; notifications de croisement sans plafond |
| M8 | moyenne | latent | Session de démonstration ouverte par défaut |
| F1 | faible | latent | `suivant` non consommé aujourd'hui, à valider demain |
| F2 | faible | latent | Mot de passe, e-mail, suppression du compte sans réauthentification |
| F3 | faible | latent | Pseudos : changement libre, recyclage, aucun nom réservé |
| F4 | faible | latent | Bornes numériques, doublons, identifiants : erreurs SQL au lieu de refus |
| F5 | faible | actif | Référence `storage:` d'un autre compte acceptée par la couche données |
| F6 | faible | actif | Autorisation des conversations laissée aux appelants |
| F7 | faible | latent | Blocage ignoré par la couche données et par `reserve_listing()` |
| F8 | faible | actif | Site de boutique : affichage trompeur possible (IDN, bidi) |
| F9 | faible | latent | `resolvePhotoUrl` et l'image de partage acceptent toute URL absolue |
| F10 | faible | actif | Le plan de site publie le profil de chaque compte |
| F11 | faible | actif | Une action à `FormData` lève sur un autre argument |
| I1–I5 | info | — | Voir la suite |

---

## E1 — En phase 2, la session sera lisible par tout script de la page

**Élevée · latent** (décision d'architecture à prendre avant la bascule).

**Où**
* `supabase/README.md:85-97` (§ 3 Session) : `createServerClient` + `cookies()`, aucune
  option de cookie prévue.
* `@supabase/ssr` 0.12.7, `dist/module/utils/constants.js` : `DEFAULT_COOKIE_OPTIONS =
  { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 jours }`.
* `src/lib/ads.ts:9-11` : « En production, le conteneur reçoit le script de la régie ».
* `next.config.ts` : aucun `headers()`, et aucun `src/proxy.ts` — donc aucune CSP (M1).

**Scénario.** La session — jeton d'accès et jeton de rafraîchissement — vit dans un cookie
`sb-…-auth-token` que `document.cookie` lit. Le script d'une régie, l'une de ses dépendances,
ou une XSS future s'exécute dans l'origine de BulkTCG, lit le cookie et l'envoie ailleurs :
l'attaquant rejoue la session depuis sa machine (messages, annonces, suppression du compte).
Sans CSP, rien ne borne la destination. Avec F2 (mot de passe changé sans l'actuel), le vol
devient une prise de contrôle définitive.

**Preuve.** `npm pack @supabase/ssr` puis lecture de `constants.js` ci-dessus ;
`curl -sS -D - -o /dev/null http://localhost:3000/` : aucun `Content-Security-Policy` ;
`src/lib/ads.ts:10`.

**Correction.**
1. Le navigateur n'a pas besoin du client Supabase : toutes les écritures passent par des
   actions serveur, et le dépôt de photo sur URL signée (`src/lib/photo-upload.ts`) n'utilise
   pas la session. Créer le client dans un seul module `server-only` avec
   `cookieOptions: { httpOnly: true, secure: true, sameSite: "lax" }` — le paquet fusionne
   ces options après ses valeurs par défaut (`src/cookies.ts:301-309` du paquet
   `@supabase/ssr`). N'importer `createBrowserClient` nulle part avec persistance de session.
2. Publicité : une `<iframe sandbox>` servie depuis une autre origine, jamais un script
   exécuté dans la page de BulkTCG.
3. La CSP de M1, avec `connect-src` restreint : même sans nonce, elle borne l'exfiltration par
   `fetch`.

**Test qui l'aurait attrapé.** Unitaire : le module qui fabrique le client serveur exporte ses
options de cookie, le test exige `httpOnly === true` et `secure === true`. Source (même
principe que `tests/render-purity.test.mjs`) : aucun fichier de `src/` n'importe
`createBrowserClient`, aucun composant ne contient `<script` hors `layout.tsx`. Smoke
(phase 2) : après connexion, `document.cookie` ne contient aucun `sb-`.

## E2 — Les photos publiées garderaient leurs métadonnées EXIF, position GPS comprise

**Élevée · latent.**

**Où**
* `src/lib/photo-upload.ts:10-18` : le fichier part tel quel du navigateur vers l'URL signée.
* `supabase/migrations/20260929121000_storage.sql:15-19` : bucket `listing-photos` public, qui
  ne contrôle que le type MIME déclaré et la taille.
* `supabase/README.md:184-185` (§ 6 Photos) : l'Edge Function prévue ne pose que le filigrane.
* Le HTML d'une fiche contient l'URL de l'original :
  `src="/_next/image?url=https%3A%2F%2Fimages.unsplash.com%2F…"` (relevé sur
  `/a/classeur-magic-modern-horizons-3-180-cartes-romans-sur-isere-27`). L'optimiseur
  réencode, mais l'original reste téléchargeable à son adresse publique.

**Scénario.** Un vendeur photographie son carton sur la table de sa cuisine avec un téléphone
qui enregistre la position — le réglage par défaut de beaucoup d'appareils. N'importe quel
visiteur télécharge l'original et lit ses coordonnées : l'adresse du vendeur, alors que
`/inscription` promet « Votre ville, jamais votre adresse ». Sur un site de remise en main
propre de displays scellés et de collections entières, c'est un repérage.

**Preuve.** Lecture. Aucune occurrence de « exif » ni de « gps » dans `src/`, `supabase/`,
`README.md` ou `docs/`.

**Correction.** Aucun fichier téléversé n'est public tel quel. Dépôt dans un bucket privé
d'entrée ; l'Edge Function déjà prévue pour le filigrane décode, applique l'orientation,
retire toutes les métadonnées (EXIF, XMP, IPTC), réencode (JPEG ou WebP, HEIC converti), puis
écrit dans le bucket public. `listing_photos.storage_path` ne vise que le fichier traité. Rien
ne change côté navigateur.

**Test qui l'aurait attrapé.** Une image de quelques kilo-octets portant un bloc GPS, en
fixture, passe par la fonction de traitement ; le test exige que la sortie n'ait plus de
segment APP1 « Exif » ni de balise GPS.

## M1 — Aucun en-tête de sécurité

**Moyenne · actif.**

**Où.** `next.config.ts:10-38` : ni `headers()`, ni `poweredByHeader: false` ; aucun
`src/proxy.ts`.

**Preuve.**
```
$ curl -sS -D - -o /dev/null http://localhost:3000/
HTTP/1.1 200 OK
Vary: rsc, next-router-state-tree, …
Link: </_next/static/media/…woff2>; rel=preload; …
Cache-Control: no-cache, must-revalidate
X-Powered-By: Next.js
Content-Type: text/html; charset=utf-8
```
Ni `Content-Security-Policy`, ni `X-Frame-Options`, ni `X-Content-Type-Options`, ni
`Referrer-Policy`, ni `Permissions-Policy`, ni `Strict-Transport-Security`. Mesuré sur le
serveur de dev ; la configuration ne déclare rien non plus pour la production (Vercel ajoute
HSTS sur ses domaines, pas le reste).

**Scénario.** Le site s'affiche dans l'iframe d'un autre site. En phase 2 les cookies
`SameSite=Lax` ne partent pas dans une iframe intersite, ce qui limite le détournement de clic
sur les gestes connectés ; il reste le leurre (faux site qui encadre le vrai). Sans CSP, une
injection éventuelle charge un script externe, pose une `<base>`, détourne un formulaire, et
exfiltre sans limite (E1).

**Correction.** Dans `next.config.ts` :
```ts
const isDev = process.env.NODE_ENV === "development";
const isHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https:");
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");
```
puis `headers()` sur `/:path*` : cette CSP, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`,
`Cross-Origin-Opener-Policy: same-origin`,
`Strict-Transport-Security: max-age=63072000; includeSubDomains` ; et `poweredByHeader: false`.

Pourquoi `'unsafe-inline'` pour les scripts : les pages sont statiques et Next insère son flux
RSC en scripts en ligne (`self.__next_f.push`) ; un nonce impose le rendu dynamique de toutes
les pages et n'est pas compatible avec le prérendu partiel prévu (`supabase/README.md`, § 7 ;
`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Cette CSP
n'arrête donc pas un script injecté en ligne ; elle interdit les scripts externes, `<object>`,
`<base>`, les formulaires vers l'extérieur, l'encadrement, et borne `connect-src`. Le script
de thème (`src/lib/theme.ts:17`) n'a besoin d'aucune exception. `img-src` suffit :
`next/image` passe par `/_next/image` (même origine), l'aperçu du dépôt par `blob:`.
`upgrade-insecure-requests` n'est posé qu'en HTTPS, sans quoi le smoke sur
`http://localhost:3117` casserait. Déployer d'abord en `Content-Security-Policy-Report-Only`.

**Suite, 30 septembre 2026 — la CSP sans `'unsafe-inline'`.** Pour viser A+ sur l'Observatory
de Mozilla, les scripts n'admettent plus que le nonce de la réponse :
`script-src 'self' 'nonce-…' 'strict-dynamic'`. `src/proxy.ts` tire un nonce par réponse et
le transmet au rendu (`src/lib/csp.ts`) ; Next le pose sur son amorce et son flux RSC, le
gabarit racine sur le script de thème, et `next.config.ts` ne pose plus de CSP statique — un
second en-tête sans nonce serait appliqué en plus et refuserait tout. Le prix annoncé ici est
payé : le gabarit racine lit la requête, chaque page est rendue à la demande, et le prérendu
partiel de `supabase/README.md` (§ 7) n'est plus une piste. Mesures, pistes écartées et
compte : README, « Sécurité ». Le smoke `csp.policy` vérifie qu'un script glissé dans le HTML
sans le nonce ne s'exécute plus — il s'exécutait avec la CSP ci-dessus.

**Suite, 1er octobre 2026 — relecture de la CSP à nonce**, sondée sur le build de production :
pages, 404 de route et de segment, erreurs 500 d'une page comme du gabarit racine, `HEAD`,
redirections, métadonnées, optimiseur d'images, et chaque en-tête de requête que le proxy ou
Next interprètent. Deux constats, corrigés :

* *Faible.* Le proxy s'écartait de toute requête portant `Next-Router-Prefetch`. Sans `RSC`,
  Next sert pourtant la page entière en HTML : elle partait sans CSP, et ses scripts
  portaient le nonce que la requête glissait dans `x-nonce`
  (`curl -H 'next-router-prefetch: 1' -H 'x-nonce: X' /pokemon`). Un navigateur n'envoie pas
  cet en-tête sur une navigation, et `private, no-store` tient les caches partagés à
  l'écart : rien d'exploitable aujourd'hui, mais un cache qui ignorerait `no-store` aurait
  servi cette page à tous. Le proxy ne s'écarte plus que des deux en-têtes ensemble, valant
  exactement 1 : une relecture indépendante a trouvé la même page servie sans CSP avec
  `RSC: 0`, `RSC: true` ou deux en-têtes `RSC: 1`, que Node joint en « 1, 1 » — Next ne
  tient pour du flux RSC que la valeur « 1 » (`server/lib/is-rsc-request.js`).
* *Faible.* HSTS et `upgrade-insecure-requests` ne suivaient que `NEXT_PUBLIC_SITE_URL`,
  quand `lib/site.ts` se rabat sur le domaine de production de Vercel, servi en HTTPS : un
  tel déploiement partait sans HSTS, dont dépend l'A+. Ils suivent désormais l'adresse
  résolue.

Ni HSTS ni COOP n'étaient tenus par un test : retirer l'un ou l'autre ne faisait rien échouer.
Restent ouverts, sans correctif dans le code : aucun `report-to` — une violation en
production ne se voit nulle part, et le collecteur reste à choisir —, et la page 500
statique (`.next/server/pages/500.html`, copie de `global-error` figée au build) dont les
scripts n'ont pas de nonce ; les erreurs provoquées, d'une page comme du gabarit racine, ont
été rendues à la demande avec le nonce, et `global-error` n'a besoin d'aucun script pour
s'afficher.

**Test qui l'aurait attrapé.** `tests/security-headers.test.mjs` exige de la politique de
`src/lib/csp.ts` le nonce, `'strict-dynamic'`, ni `'unsafe-inline'` ni eval pour les
scripts, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri` et `form-action` ; du
proxy un nonce neuf à chaque réponse, transmis au rendu, qui écrase celui du client, et un
filtre qui couvre tout document ; de `next.config.ts` `nosniff`, COOP, HSTS en HTTPS et
jamais en HTTP, aucune CSP en double et `poweredByHeader === false`. Chaque assertion a été
falsifiée. Le smoke `csp.policy` rejoue ces règles sur le serveur : une seule CSP par page,
un nonce neuf, tout script marqué, aucune violation, une page HTML pour chaque variante
d'en-têtes de requête, et le script injecté refusé.

## M2 — Pour qui un lot est réservé fuit vers tout compte connecté

**Moyenne · actif** (et, en phase 2, au niveau de l'API).

**Où**
* `src/app/deposer/recherche/page.tsx:22` et `:44` : `getListings({ limit: 200 })` passé tel
  quel à `<WantedForm activeListings>`, un composant client.
* `src/app/mon-compte/recherches/[slug]/modifier/page.tsx:29` et `:51` : même chose.
* `src/types/listing.ts:85-87`, `src/lib/data/mappers/listings.ts:66` : `reservedForId`.
* Phase 2 : `supabase/migrations/20260929120900_security.sql:73-75` — la lecture des annonces
  est filtrée par ligne, pas par colonne ; `reserved_for` est lisible par quiconque lit
  l'annonce, rôle anonyme compris.

**Scénario.** u-01 a écrit à u-09 à propos de l-27 (conversation c-04) ; le lot a été réservé
pour quelqu'un d'autre. Sa conversation lui dit seulement « réservé pour un autre acheteur » :
le produit cache l'identité à dessein (`src/app/messages/[conversationId]/page.tsx:41-50`). Il
ouvre « Déposer une recherche » : le flux RSC contient `reservedForId":"u-12"` pour l-27 et,
plus loin, `"id":"u-12","username":"theo_yugi"`. Il sait à qui le vendeur a promis le lot, et
peut le contacter pour surenchérir. Même chose pour l-21 → bastien26. Le composant reçoit
aussi `viewCount`, `featuredUntil`, `urgentUntil`, `hasExtraPhotos` et l'identifiant interne
de chaque vendeur, dont le croisement n'a aucun besoin.

**Preuve.**
```
$ curl -sS http://localhost:3000/deposer/recherche -o p.html
$ grep -o 'reservedForId[^,]*,' p.html | sort | uniq -c
     27 reservedForId\":null,
      1 reservedForId\":\"u-12\",
      1 reservedForId\":\"u-04\",
$ grep -o '\\"id\\":\\"u-12\\",\\"username\\":\\"[a-z_0-9]*' p.html
\"id\":\"u-12\",\"username\":\"theo_yugi
```
Les treize autres pages relevées (accueil, `/annonces`, `/annonces?jeu=magic`, fiche, profil,
`/recherches`, `/pro`, `/pro/lots`, page ville, `/messages`, `/mon-compte`, `/notifications`,
`/deposer`) ne contiennent ni `reservedForId` ni `proUntil` d'un tiers.

**Correction.** Ne jamais passer un `Listing` à un composant client. Le croisement n'a besoin
que de la forme minimale `MatchableListing` (`src/lib/matching.ts`) : un DTO explicite
construit côté serveur (`toMatchCandidate(listing)` : id, slug, titre, jeu, format, nombre de
cartes, prix, coordonnées, statut, pseudo du vendeur), et lui seul part au client. Même règle
pour `seller={seller}` de `/deposer` : un `SellerProfile` complet part sous le type
`SellerSummary` (on y lit `proUntil`) — TypeScript n'empêche pas les champs en trop d'être
sérialisés ; ce sont ici les données du compte lui-même, mais le motif est le même. En base,
retirer `reserved_for` des colonnes lisibles par tous (droit de colonne en `select`, ou vue
publique sans elle) et le réserver au vendeur et à la personne désignée.

**Test qui l'aurait attrapé.** Unitaire : `toMatchCandidate` ne rend aucune clé hors d'une
liste blanche. Source : aucun composant client ne déclare une prop de type `Listing`,
`Listing[]`, `SellerProfile` ou `Conversation`. Smoke : le HTML de `/deposer/recherche` ne
contient ni `reservedForId` ni `viewCount`.

## M3 — L'option payante « 8 photos » est accordée par le formulaire

**Moyenne · actif** côté application ; la base (phase 2) refuse en dernier recours.

**Où**
* `src/components/deposit/ListingOptions.tsx:79` :
  `<input type="hidden" name="extraPhotos" value="on">` pour une annonce « déjà payée ».
* `src/lib/schemas/listing-form.ts:67-71` et `:91-98` : jusqu'à huit photos dès que
  `extraPhotos` vaut « on ».
* `src/lib/data/listing-mutations.ts:83-101` (`updateListing`) : `listing.hasExtraPhotos` est
  lu en base mais jamais comparé ; `createListing` (`:39-79`) n'a pas d'étape de paiement.

**Scénario.** Le vendeur d'une annonce sans l'option ajoute `extraPhotos=on` (case cochée, ou
champ ajouté dans l'inspecteur) et envoie huit photos : schéma et couche données acceptent,
le récapitulatif affiche « 8 photos » (`ListingSummary.tsx:117`). En phase 2, seul le
déclencheur `check_photo_allowance` (`20260929120300_listings.sql:129-142`) l'arrête — par
une erreur SQL et non une réponse lisible — et à condition que le chemin d'écriture retenu
(la fonction `create_listing(payload jsonb)` suggérée par `supabase/README.md:144`, § 5) ne pose
jamais `extra_photos` à partir de la charge.

**Preuve.** Script `/tmp` avec `DEMO_USER_ID=u-09` : `updateListing("l-04", { …, photos: huit
références "local:…", extraPhotos: true })` rend `not-persisted`, alors que l-04 a
`extra_photos = false`.

**Correction.** Le droit se lit côté serveur. `updateListing` : plafond
`listing.hasExtraPhotos ? MAX_PHOTOS : FREE_PHOTOS`, au-delà `invalid`. `createListing` : la
case exprime une intention d'achat ; les photos 4 à 8 ne s'écrivent qu'après confirmation du
paiement (webhook, clé de service). Supprimer le champ caché.

**Test qui l'aurait attrapé.** `tests/mutations.test.mjs` : « huit photos sur une annonce
sans l'option sont refusées, même si le formulaire dit extraPhotos ».

## M4 — Une annonce vendue, avec vente clôturée et avis, reste modifiable

**Moyenne · actif** (et permis par la base).

**Où**
* `src/lib/data/listing-mutations.ts:83-101` : `updateListing` ne consulte pas
  `hasClosedDeal`, alors que `setListingStatus` (`:113`) et `deleteListing` (`:131`) le font.
* `src/app/mon-compte/annonces/[slug]/modifier/page.tsx:24-28` : seul le propriétaire est
  vérifié.
* Base : `20260929120900_security.sql:78-79` et `:89` (titre, description, prix, jeu
  modifiables par le vendeur) ; `20260929120600_deals_reviews.sql:61-73`
  (`keep_closed_deal_sold` ne protège que le statut).
* `src/app/mon-compte/transactions/[id]/page.tsx:52` : « Prix affiché » lit le prix actuel de
  l'annonce, pas celui de la vente.

**Scénario.** l-04 (vendeur u-09) a été vendu à u-04, dont l'avis dit « Lot conforme, tri déjà
fait par couleur ». Un vendeur mal noté — « 300 cartes au lieu des 900 annoncées » — réécrit
ensuite l'annonce en « environ 300 cartes » : l'avis paraît injuste, et la fiche vendue, qui
reste en ligne, le « prouve ». Le critère de fiabilité (« un lot conforme à l'annonce ») perd
sa pièce de référence ; le récapitulatif de la vente affiche un prix réécrit.

**Preuve.** `/mon-compte/annonces/<slug de l-07>/modifier` répond 200 (l-07 : vente d-01
clôturée). Script `/tmp` en u-09 : `updateListing("l-04", …)` rend `not-persisted`.

**Correction.** Figer le contenu après clôture : `updateListing` rend `invalid` si
`hasClosedDeal` (même message que la suppression) ; la page de modification affiche un état
« vente clôturée » ; en base, un déclencheur `before update` refuse toute modification de
contenu d'une annonce liée à une vente ; `close_deal()` écrit dans `deals` un instantané
(prix, titre) que le récapitulatif affiche.

**Test qui l'aurait attrapé.** `tests/mutations.test.mjs` : « une annonce dont la vente est
clôturée ne se modifie plus » ; `tests/schema-security.test.mjs` : présence du déclencheur.

## M5 — N'importe quel compte pourra invalider tout le cache du site

**Moyenne · latent** (les actions n'invalident qu'au statut `saved`, jamais atteint en
phase 1).

**Où**
* `src/app/actions/waitlist.ts:42` : `markNotificationsReadAction` →
  `revalidatePath("/", "layout")`, soit « all cached data »
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`).
* `src/app/actions/waitlist.ts:16`, `:24`, `:35` : rejoindre, quitter une liste d'attente,
  réserver → `revalidatePath("/a/[slug]", "page")`, toutes les fiches.
* `src/lib/data/waitlist-mutations.ts:35-40` : `leaveWaitlist` ne vérifie rien (annonce
  inexistante, pas d'inscription) et réussira donc toujours.
* `src/app/actions/revalidate.ts:30-34` : clôture et avis → tous les profils.
* `src/app/actions/profile.ts:23` : suppression du compte → tout le site (rare, défendable).

**Scénario.** Un compte quelconque, depuis un script qui envoie ses propres cookies et
l'en-tête `Origin` du site, appelle « Tout marquer comme lu » en boucle : à chaque appel, les
quelque 800 pages statiques deviennent périmées et chaque visite, robots compris, redevient
un rendu serveur. Coût d'hébergement et latence, sans aucun droit particulier.

**Correction.** Ce qui ne dépend que de l'utilisateur — cloche, messagerie, compte — sera
dynamique en phase 2 : `refresh()` de `next/cache` suffit (même dossier de la documentation,
`refresh.md`). Pour une page publique, invalider le chemin concret (`routes.listing(slug)`,
`routes.profile(username)`), et seulement si une ligne a changé. `leaveWaitlist` rend `not-found` sans
inscription.

**Test qui l'aurait attrapé.** Source : aucune action ne contient
`revalidatePath("/", "layout")` ni un motif à segment dynamique (`[slug]`, `[username]`) hors
d'une liste blanche commentée. `tests/mutations.test.mjs` : quitter une liste où l'on n'est
pas inscrit rend `not-found`.

## M6 — La messagerie tombera quand une annonce devient invisible

**Moyenne · latent** (le plantage) **et actif** (la proposition d'un lot réservé).

**Où**
* `src/lib/data/message-mutations.ts:68-97` (`proposeListing`) : aucun contrôle d'audience,
  alors que `contactSeller` (`:37`) et `joinWaitlist` en ont un.
* Base : `20260929120900_security.sql:158-168` — l'ouverture d'une conversation ne vérifie
  pas que l'acheteur peut lire l'annonce.
* `src/lib/data/mappers/messaging.ts:35` et `mappers/listings.ts:85-91` :
  `toConversationListing(row.listing)` suppose l'annonce présente ; `rows.ts:163-166` la
  déclare non nulle.

**Scénario.** En phase 2, les conversations se lisent sous la session du lecteur
(`supabase/README.md:122`, § 4) ; la jointure vers `listings` passe par la RLS et rend
`listing: null` pour une annonce réservée aux pros vue par quelqu'un qui n'est pas pro au
forfait actif. Trois chemins y mènent, dont deux sans malveillance : une boutique a écrit à
propos d'un lot réservé, puis son forfait expire ; un vendeur passe une annonce déjà discutée
de « tout le monde » à « pros » ; un vendeur propose son lot réservé à un particulier qui
cherche ce jeu (le formulaire ne le propose pas, `ProposeListingView.tsx:36-39`, l'action
l'accepte). `toConversationListing(null)` lève, et `error.tsx` remplace toute la messagerie.

**Preuve.** Script `/tmp` avec `DEMO_USER_ID=u-02` : `proposeListing({ wantedId: <demande
Magic ouverte de u-04>, listingId: "l-35" })` — l-35 est réservé aux pros, u-04 est un
particulier — rend `not-persisted`. Le plantage est déduit de la lecture : il n'y a pas de
base pour l'exécuter.

**Correction.** `ConversationRowWithRelations.listing` nullable, et `toConversation` rend une
annonce « indisponible » (sans lien) au lieu de lever ; `proposeListing` rend `not-found` si
l'annonce est réservée aux pros et l'acheteur n'est pas pro actif ; la politique d'ouverture
ajoute `(l.audience = 'everyone' or public.is_active_pro(buyer_id))`.

**Test qui l'aurait attrapé.** `tests/mappers.test.mjs` : une conversation sans annonce
lisible se convertit sans lever. `tests/mutations.test.mjs` : proposer un lot réservé aux pros
à un particulier répond introuvable.

## M7 — Aucune limitation de débit ; un dépôt notifie sans plafond

**Moyenne · latent.**

**Où.** Toutes les actions de `src/app/actions/`. `src/lib/data/listing-mutations.ts:60-77` :
`getWantedMatches(…, Number.MAX_SAFE_INTEGER)`, puis une notification par acheteur, écrite
avec la clé de service (`supabase/README.md:153`, § 5).

**Scénario.** Un compte dépose — ou supprime et redépose — des dizaines de lots Pokémon
« vrac, 1 € » : chaque dépôt notifie tous les acheteurs dont la demande correspond, sans
plafond ni dédoublonnage, et la cloche devient un canal de démarchage. Rien ne borne non plus
les messages (`proposeListing` ouvre un fil vers toute personne qui cherche le jeu), les
signalements ou les demandes.

**Correction.** Un limiteur par compte dans la couche données — clé : l'identifiant de
session, pas l'IP — par exemple 20 dépôts par jour, 60 messages par heure, 10 propositions et
20 signalements par jour ; un plafond de notifications de croisement par acheteur et par jour ;
sur Vercel, une règle WAF sur les `POST` d'actions en complément.

**Test qui l'aurait attrapé.** La couche données reçoit un limiteur injectable ; 21 appels à
`createListing` rendent `invalid` au dernier ; un dépôt ne produit pas plus de N
notifications.

## M8 — La session de démonstration est ouverte par défaut

**Moyenne · latent** (actif pour une démonstration déployée).

**Où.** `src/lib/data/session.ts:16-20` : `process.env.DEMO_USER_ID ?? "u-01"` — sans
configuration, tout visiteur est connecté.

**Scénario.** Aujourd'hui, un déploiement public de la phase 1 sert à chacun le compte u-01
(ou une boutique avec `DEMO_USER_ID=u-13`) ; `next build` prérend alors `/messages`,
`/mon-compte` et `/notifications` en statique avec les conversations de ce compte — constaté
dans le build lancé par un autre agent à 11 h 33 : `.next/server/app/messages.html` contient
« bastien26 », « julie_cartes »… — et le CDN les sert à tout le monde. Données factices, donc
sans victime. À la bascule, une seule ligne oubliée — une branche « mode démo » gardée pour
les prévisualisations, une variable restée dans l'environnement Vercel — donnerait un compte
réel à tout visiteur anonyme : contournement complet de l'authentification.

**Correction.** Le mode démonstration s'active explicitement (`DEMO_MODE=1`, posé par les
scripts `dev`, `test`, `smoke` et `screenshot`) ; `session.ts` lève au chargement si
`DEMO_MODE` coexiste avec `NEXT_PUBLIC_SUPABASE_URL` ou `VERCEL_ENV=production`. En phase 2,
les gabarits privés restent dynamiques par construction (`cookies()` dans
`getCurrentUserId`) : ne jamais mettre en cache (`"use cache"`, `unstable_cache`,
`revalidate`) une lecture qui dépend de la session.

**Test qui l'aurait attrapé.** `tests/session.test.mjs` : sans `DEMO_MODE`,
`getCurrentUserId()` rend `null` ; avec `DEMO_MODE` et `NEXT_PUBLIC_SUPABASE_URL`, l'import
lève. En phase 2, le smoke vérifie qu'aucune page privée n'est prérendue
(`.next/server/app/messages.html` absent).
