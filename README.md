# BulkTCG

Petites annonces de cartes à collectionner, **de la main à la main**. Le créneau est étroit
et assumé : **les lots, le vrac et le scellé** — le *bulk*, comme disent les joueurs —
jamais la carte à l'unité. Cardmarket gère l'unité, Vinted gère l'envoi postal ; ici on
vend le classeur entier, le carton de six kilos, le deck monté, le display, à quelqu'un
qui habite à moins d'une heure. Sept jeux : Pokémon, Magic, One Piece, Lorcana, Riftbound,
Yu-Gi-Oh et Naruto — et « Autre » pour tous ceux qui n'ont pas leur intercalaire : Digimon,
Flesh and Blood, Star Wars Unlimited…

Le produit tient dans deux promesses. Côté vendeur : **une annonce, un lien permanent, un
statut modifiable en un clic** — Facebook reste le canal d'audience, BulkTCG est la couche
annonce en dessous, celle qui reste à jour sans qu'on la republie. Côté boutiques : **un
forfait pro** qui ouvre les lots que des particuliers ne montrent qu'aux professionnels
(voir « Offre professionnelle »).

Le site s'appelait Carton Plein jusqu'en septembre 2026 ; le dépôt porte encore ce nom.

## État : phase 2 branchée, sans les photos

Le site tourne sur **Supabase** dès que les trois variables Supabase de `.env` sont posées :
la session (`getClaims()`, cookies `httpOnly`), les lectures — chargées sous la RLS par
`src/lib/data/source.ts`, la logique de filtre, de tri, de facettes et de croisement restant
celle, testée, de la démonstration — et toutes les écritures, par `performWrite`. Sans ces
variables, il retombe sur ses **données factices**, compte de démonstration connecté : les
tests, le smoke et `DEMO_USER_ID` tournent ainsi, et chaque écran dit alors que rien n'est
enregistré plutôt que d'afficher une confirmation fausse. Les **photos** attendent la
phase 3, chez Cloudflare Images — décidé, R2 écarté : avec la base, le dépôt les annonce
pour plus tard, et la production refuse de démarrer sans elles.
Le guide de bascule est dans [`supabase/README.md`](supabase/README.md), avec les dix-sept
migrations SQL qui créent toute la base (tables, contraintes, index, déclencheurs, RLS,
registre des photos), appliquées dans l'ordre par `supabase db push` — ou réunies dans
`supabase/setup.sql`, à coller tel quel dans l'éditeur SQL d'un projet neuf ; une base déjà
créée ne reçoit que la nouvelle migration. Le modèle de données
— MCD, MLD et MPD selon Merise, déduits des fonctionnalités du code, avec la traçabilité de
chacune — est dans [`docs/donnees/`](docs/donnees/README.md).

```
npm install
npm run dev                        # http://localhost:3000, vu par un particulier
DEMO_USER_ID=u-13 npm run dev      # le même site, vu par une boutique au forfait actif
npm run verify                     # types + tests + build
npm run supabase:seed              # la démonstration chargée dans le projet Supabase de .env
```

## La frontière qui rend la phase 2 indolore

```
src/types/                    la forme métier, écrite une fois — identique en phase 1 et en phase 2
src/types/game.ts             GAME_IDS : la liste des jeux, écrite une seule fois (test)
src/lib/routes.ts             les adresses du site, écrites une seule fois (test)
src/lib/data/rows.ts          la forme des lignes SQL, snake_case — synchronisée avec les migrations (test)
src/lib/data/mappers.ts       snake_case ⇄ camelCase, dans les deux sens : le point d'entrée de mappers/
src/lib/data/source.ts        d'où viennent les lignes : les tables factices, puis les clients Supabase (test)
src/lib/data/*.ts             lectures : la seule frontière avec la source de données
src/lib/data/*-mutations.ts   écritures : identité, propriété, construction des lignes
src/lib/data/write-seam.ts    deferWrite — la liste exhaustive de ce qu'il reste à brancher
src/app/actions/              actions serveur minces : revalident (Zod), délèguent, rafraîchissent
src/lib/mock/                 les lignes de la phase 1
supabase/migrations/          le schéma de la phase 2, en dix-sept migrations ordonnées
supabase/setup.sql            les mêmes, bout à bout : toute la base en un fichier (généré, test)
supabase/tests/               ces migrations rejouées sur un vrai PostgreSQL, sous les rôles de l'API
docs/donnees/                 le modèle de données : MCD, MLD, MPD et traçabilité
```

**Les données factices sont déjà au format de la base.** `lib/mock/` produit des
`ListingRow` en `snake_case`, `lib/data/` les filtre et les trie comme le fera le `WHERE`
SQL, puis `lib/data/mappers.ts` convertit vers le domaine au tout dernier moment. Le
chemin inverse — du formulaire validé vers les lignes à insérer — vit dans le même
fichier et il est testé de la même façon : la conversion est exercée à chaque rendu et
par des tests dédiés, au lieu d'être une promesse qu'on découvrirait fausse le jour de la
bascule.

* Les fonctions de `lib/data/` sont **`async` dès maintenant**, et marquées
  `server-only` : un composant client qui les importerait ferait échouer le build.
* En phase 2, **seul le corps** de ces fonctions change. `mappers.ts` ne bouge pas.
* Chaque écriture rend un `MutationResult` : `saved` en phase 2, `not-persisted` en
  phase 1 — l'interface sait déjà afficher les deux, et dit en phase 1 que rien n'est
  enregistré plutôt qu'une confirmation fausse.
* Une valeur d'énumération inconnue en base **lève**, elle n'est pas silencieusement
  remplacée : une dérive de schéma doit se voir tout de suite.
* **Aucun composant n'importe quoi que ce soit depuis `lib/mock/`.**
* `lib/data/session.ts` est le substitut d'authentification ; `requireCurrentUserId`
  redirige déjà vers `/connexion?suivant=…`.

## Identité visuelle

**Chaque lot, une carte gradée.** La direction retenue en septembre 2026 — « Gradé »,
choisie parmi trois pistes étudiées et maquettées — présente chaque annonce comme une carte
dans son boîtier : une étiquette nette qui dit exactement ce qu'elle contient et n'invente
rien. Fond gris froid d'acrylique, cadres d'encre francs, et l'emphase par l'inversion et
la graisse, pas par une troisième couleur : les seules couleurs vives du site sont celles
des sept jeux, et elles veulent toujours dire « ce jeu-là ».

* **La vignette** se lit dans l'ordre d'une carte. En tête, la *ligne de type* — un carré à
  la couleur du jeu, « POKÉMON — VRAC » — et à droite le *coût* : le prix en pavé d'encre
  inversé, là où une carte porte son coût et une étiquette de gradation sa note ; les prix
  d'une rangée tombent à la même hauteur. Puis le titre, sur deux lignes réservées ; la
  *fenêtre* de la photo, en retrait, avec sa *ligne de crédit* — le filigrane, le badge PRO
  et la note du vendeur, comme la ligne « Illus. » d'une carte ; les faits — volume, état
  avec sa jauge de cinq crans, langue ; trois codes de série au plus ; et le pied : où, à
  quelle distance, depuis quand. Sur téléphone elle devient horizontale, le prix posé dans le
  coin de la miniature. Le DOM suit l'ordre d'un lecteur d'écran (titre, prix, type, faits,
  lieu, vendeur) ; la grille CSS le range dans l'ordre d'une carte.
* **Les états se lisent en tampons** — « Vendu », « Réservé », posés de biais sur la photo
  comme sur une table de brocante — plutôt qu'en petites pastilles. Une annonce vendue passe
  en gris et son prix perd son aplat.
* **Le holographique** est réservé à la mise en avant payée, et réduit à deux gestes : le
  sceau « À la une » et une bande sur le bord de la vignette, comme l'hologramme de sécurité
  d'un boîtier. Jamais un aplat : la mise en avant perdrait sa rareté. Ses cinq arrêts,
  francs — une feuille métallisée, pas un pastel — sont mesurés contre l'encre.
* **Les demandes de recherche** ont leur propre dessin : un cadre en pointillés —
  l'emplacement vide du lot qu'on cherche —, un bandeau de couleur pleine, et le budget en
  pavé *contour* là où un lot porte son prix en pavé plein.
* **Les intercalaires** — les jeux comme les séparateurs d'une boîte de rangement, un onglet
  bordé de sa couleur, posé sur un filet d'encre — filtrent la liste et ouvrent l'accueil.
  C'est le dessin de **tout filtre de liste**, étapes du compte comprises : les onglets du
  compte, eux, sont des pastilles — filtrer ne ressemble pas à naviguer. **L'intercalaire
  d'un jeu choisi prend l'aplat de sa couleur**, avec l'encre mesurée pour elle — jaune pour
  Pokémon —, et **rien ne bouge** : l'onglet actif se levait de 4 px, élargissait ses bords
  et passait en gras, et poussait ses voisins à chaque choix. Seules les couleurs changent,
  et `npm run smoke` compare la position de chaque onglet avant et après.
* **Le noir veut dire « à faire ».** L'aplat d'encre est réservé aux gestes — un bouton,
  une étape du suivi qui attend un avis. Un choix courant sans couleur de jeu (« Tous les
  jeux », filtre coché, segment de statut, page courante) **se cerne d'encre** sur fond de
  carte, et un filtre coché porte « ✓ ». Le même noir disait « filtre actif » sur une
  pastille et « à noter » dans le suivi ; `npm run smoke` vérifie désormais qu'aucun choix
  courant n'est un aplat d'encre, et que les étapes à faire en restent un.
* **Un seul pas pour les titres de page.** Listes, compte, messagerie, notifications, dépôt :
  le même `display-h2`. Seuls l'accueil a une manchette (`display-hero`, en unités de
  conteneur — `/pro` l'empruntait sans conteneur et titrait à 109 px, un mot par ligne),
  `/pro` et les pages d'erreur le pas `display-h1`, et une fiche le titre écrit par son
  vendeur. « Messages » titrait à 26 px quand le reste du site titrait à 46 ; le
  smoke mesure le `h1` de huit pages.
* **Le logo** — une brique de cartes en perspective, le *bulk* tel que les joueurs
  l'empilent : une carte posée sur le dessus, et sur les deux faces visibles la tranche aux
  couleurs des jeux. Le logotype « BULKTCG » tient en un mot, *BULK* en graisse pleine et
  *TCG* en graisse légère, de la même couleur. La géométrie vit dans `lib/brand-mark.ts`,
  sans couleur : le composant la remplit de variables CSS, le favicon, l'icône Apple et les
  images de partage de valeurs littérales — deux rendus qui ne peuvent pas diverger.
* **La tranche** — les sept couleurs de jeu côte à côte, comme la tranche d'une brique de
  cartes vue de côté — signe le site : sous l'en-tête, en tête du pied de page, sur les
  faces du logo, dans l'image de partage. Elle se construit depuis les jeux nommés de
  `GAME_IDS` (`NAMED_GAME_IDS`) : un jeu ajouté y prend sa place sans toucher au CSS.
  « Autre » n'y entre pas — ce n'est pas un jeu, et son graphite éteindrait la signature.
* **L'accueil** s'ouvre sur un héros de la hauteur de l'écran, navigation comprise : la
  manchette sur toute la largeur — dimensionnée en unités de conteneur, elle occupe sa ligne
  d'un bord à l'autre —, la recherche et la phrase d'accroche dessous, et les intercalaires
  au bas de l'écran, qui ouvrent sur les derniers dépôts. Ceux-ci sont dans leur vrai ordre
  et sans les annonces à la une : le classeur qui occupait cette place suivait le tri par
  défaut, qui remonte les annonces payées, et répétait la section suivante.
* **Typographie** — quatre voix, une par rôle. Les titres : *Space Grotesk*, l'équivalent
  libre le plus proche de la sans-serif d'Anthropic (Styrene B, aujourd'hui Anthropic Sans),
  qui est propriétaire et ne se diffuse pas en police web — les copies « gratuites » qui
  circulent ne sont pas autorisées. Les libellés, les prix, le logotype : *Science Gothic* en
  capitales larges, le lettrage des étiquettes de gradation. Le texte : *Mona Sans*. Les
  codes, volumes et références : *Atkinson Hyperlegible Mono*, dont le zéro barré et les 1, I
  et l distincts servent « OP-01 » comme « BK-F08N9X ». Les quatre sont auto-hébergées.
* **Aucun texte sous 13 px**, et les libellés en capitales sont plus grands et plus
  espacés que par réflexe. `tests/typography.test.mjs` le vérifie.
* **Un texte prend la largeur de son parent.** Aucune largeur maximale sur un `p`, un `h1`
  ou un `li` : quand une mesure doit être limitée, c'est la mise en page qui la limite — une
  colonne de grille, un gabarit de page. C'était l'erreur la plus fréquente (la manchette de
  l'accueil tenait dans 20 caractères) ; `tests/text-width.test.mjs` la refuse.
* **Coins nets** : 2 à 10 px de rayon, plus aucune pilule.
* **Typographie française** : espace insécable devant « : », fine insécable devant « ? »,
  « ! » et « ; », insécables à l'intérieur des guillemets. Sans elles, un « » » ou un « ? »
  finissait seul en tête de ligne. `scripts/french-spacing.mjs` les pose en ne lisant que
  les textes (chaînes et JSX, par l'arbre syntaxique TypeScript — jamais le code), et
  `tests/french-typography.test.mjs` échoue si l'une manque.

## Conventions

Interface en français, **code intégralement en anglais** — variables, types, fichiers,
colonnes. Les valeurs métier sont en anglais (`"available"`, `"reserved"`, `"sold"`) et
leur traduction vit dans `lib/labels.ts`, seul endroit du projet où elles deviennent
françaises.

Les montants circulent **en centimes entiers** (`priceCents`) ; l'euro n'apparaît qu'à
l'affichage, dans `lib/format.ts`.

Les paramètres d'URL, eux, sont en français (`?jeu=magic&etat=NM`) : ils sont visibles et
se partagent. La traduction vers `ListingQuery` se fait dans `lib/listing-query.ts`.

Les adresses aussi se lisent : `/annonces/<lien>`, `/recherches/<lien>`, `/profil/<pseudo>`,
et chaque jeu par son nom en mots séparés — `/one-piece/avignon`, `/yu-gi-oh`,
`/autres-jeux` pour « Autre ». Elles étaient `/a/`, `/r/`, `/p/`, `/onepiece` et `/other` :
trois lettres qu'aucun lecteur ne déchiffre dans un lien collé sur Facebook, et un mot
anglais sur un site français. Toutes sont écrites une fois, dans `src/lib/routes.ts`, et les
anciennes redirigent en permanence — un lien déjà partagé ne casse pas. Un `?jeu=` d'avant
le changement (`?jeu=onepiece`) garde son sens.

## Règle de données appliquée partout

**Une information absente s'affiche `—`, jamais `0`, jamais une estimation.**

* Un vendeur sans avis a `ratingAvg: null` et l'interface écrit « Pas encore d'avis » —
  pas cinq étoiles vides qui ressembleraient à un 0/5.
* Un lot non compté a `cardCount: null` et la fiche précise « Non compté par le vendeur ».
* `activeListingCount` n'est **pas** stocké sur le profil : il est compté sur les annonces
  réelles. Un compteur écrit à la main finit toujours par contredire la liste affichée
  juste en dessous.
* Les états dégradés (aucun résultat, ville sans annonce, conversation vide) sont des
  écrans à part entière, avec une action.

## Mode sombre

Trois réglages — Système, par défaut, Clair et Sombre — dans le pied de page, le menu mobile,
et un interrupteur dans l'en-tête. Un choix explicite vit dans `localStorage` ; en
« Système » rien n'est écrit, et la media query `prefers-color-scheme` suit l'appareil, y
compris quand il bascule pendant la visite — et même sans JavaScript.

* **Chaque couleur s'écrit une fois, ses deux valeurs côte à côte** :
  `--paper: var(--when-light, #e9ecef) var(--when-dark, #0b0e12);`. `--when-light` et
  `--when-dark` sont deux interrupteurs « à espace », la forme exacte en laquelle Lightning
  CSS compile `light-dark()` — qui exigerait Safari 17.5 et refuserait un dégradé. Aucune
  liste de valeurs n'est dupliquée.
* **Aucun flash** : un script de `<head>` pose `data-theme` avant la première peinture pour
  un choix explicite, et `npm run smoke` le mesure contre l'entrée `first-paint` du
  navigateur, pas à `domcontentloaded`.
* **Trois familles de couleurs.** Les couleurs de thème basculent. Les couleurs
  d'impression ne bougent jamais — couleurs de jeu et leurs encres, holographique,
  filigrane posé sur une photo, dos de carte, logo : ce qui est imprimé ne change pas avec
  la lumière de la pièce. Et les encres posées sur un aplat sont un rôle : `--on-ink` sur
  l'encre, `--on-chalk` sur la craie. En rejouant les anciennes paires en sombre, dix
  tombaient sous le seuil, dont le bouton principal à 1,00:1 — la craie y était posée sur une
  encre devenue claire. `tests/theme-roles.test.mjs` refuse désormais tout aplat d'encre qui
  porte un texte à la craie, dans les composants comme dans les feuilles de style.
* **L'impression reste claire**, même en sombre imposé : une fiche en sombre sortirait en
  craie sur papier blanc.

## Accessibilité

`npm run test` inclut un **audit de contraste WCAG mesuré sur les valeurs réelles de
`styles/tokens.css`, dans les deux thèmes**, et il est bloquant. Un seul lecteur de tokens
(`tests/tokens.mjs`) résout alias et interrupteurs pour un thème donné. L'audit classe les
paires en trois niveaux :

| Niveau | Seuil | Exemples |
|---|---|---|
| Texte | 4,5:1 | tous les textes, sur le papier comme sur l'ardoise, le prix en pavé, chaque arrêt du dégradé holographique sous le sceau, la ligne de crédit sur une photo blanche, les tampons sur une photo noire comme blanche |
| Contours porteurs d'information | 3:1 | bordure de champ, anneau de focus (encre sur papier, craie sur ardoise), contour d'erreur, crans allumés de la jauge d'état |
| Séparateurs décoratifs | plancher 1,2:1, documenté | cadre de vignette en sombre, filet de l'en-tête, crans éteints de la jauge, contour de bouton sur l'ardoise |

Les exemptions du troisième niveau sont **justifiées une par une dans le fichier de test**,
jamais obtenues en supprimant l'assertion.

L'audit a été falsifié : éclaircir `--muted` le fait échouer sur trois paires, et un
`--on-ink` identique dans les deux thèmes fait tomber le bouton principal à 1,04:1 en
sombre. À une
refonte précédente, le blanc a remplacé le papier comme encre des pastilles bleue et rouge :
la craie ne tenait que 4,46:1 sur le bleu Magic. Il a aussi refusé le premier violet essayé pour
Yu-Gi-Oh (#5b21b6, 1,84:1 sur l'ardoise) — voir « Couleurs et photos ». `tests/typography.test.mjs` refuse en
plus tout pas de texte sous 13 px et **toute variable CSS citée par un composant mais
absente des tokens** — une couleur renommée ne disparaît plus en silence.

## Sécurité

Le front a été audité en septembre 2026 ([`docs/securite/audit-front.md`](docs/securite/audit-front.md)) :
aucun constat critique, et chaque constat actif est corrigé avec le test qui l'aurait attrapé.

* **En-têtes** : CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, COOP, HSTS dès que l'adresse publique est en HTTPS — celle que
  résout `lib/site.ts`, domaine de production de Vercel compris : seule
  `NEXT_PUBLIC_SITE_URL` comptait, et un déploiement qui s'en passait partait sans HSTS —,
  plus de `X-Powered-By` (`next.config.ts`, `tests/security-headers.test.mjs`). Noté **A+ par
  l'Observatory de Mozilla** — 130 points par son propre analyseur, remesuré le 1er octobre,
  une fois servi en HTTPS avec HSTS ; l'ancienne CSP plafonnait à B+ (80).
* **Aucun script ne s'exécute sans le nonce de sa réponse.** La CSP gardait `'unsafe-inline'`
  pour les scripts, et laissait donc passer tout script injecté dans la page. `src/proxy.ts`
  la pose maintenant sur chaque réponse avec un nonce neuf (`src/lib/csp.ts`) : Next le pose
  sur ses propres scripts — son amorce et le flux RSC en ligne —, le gabarit racine sur le
  script de thème, et `'strict-dynamic'` admet les morceaux que Next charge ensuite. Les
  styles gardent `'unsafe-inline'` (des attributs `style`, qu'aucun nonce ne couvre), ce que
  l'Observatory ne pénalise pas. Le proxy n'écarte que les préchargements du routeur, qui
  portent à la fois `RSC` et `Next-Router-Prefetch`, valant exactement 1 — la définition de
  Next lui-même : une requête qui ne portait que le second, ou `RSC: 0`, recevait la page
  entière en HTML, sans CSP, et avec le nonce qu'elle glissait elle-même dans `x-nonce`.
  **Le prix est payé, et mesuré.** Next ne pose un nonce que sur une page rendue à la
  demande : une page prérendue garde les scripts de son build, que la CSP refuserait. Les
  979 pages prérendues jusque-là (accueil, villes, fiches, profils, demandes, pages fixes —
  celles des jeux, qui lisent leurs filtres dans l'adresse, l'étaient déjà) sont donc rendues
  à chaque requête : en local, sur les données de démonstration, 6 à 14 ms avant le premier
  octet au lieu de 1 à 2, six à onze fois moins de pages servies par seconde selon la page
  (l'accueil : environ 450 contre 70), et `Cache-Control: private, no-store` au lieu d'une
  heure de cache partagé — plus aucune page HTML au CDN. Le passage par le proxy ajoute
  jusqu'à trois millisecondes à une page déjà dynamique, dans le bruit de la mesure ;
  Lighthouse ne bouge pas au-delà du bruit de mesure. Ce qui ne porte aucun script reste
  statique : icônes, images de partage, plan de site, robots.txt. Le build, lui, ne tente
  plus de prérendre ce qu'il ne pourrait pas garder : les annonces, les profils et les
  demandes ont perdu leur `generateStaticParams`, qui ne prérendait plus rien — 935 pages
  tentées au lieu de 1 003, et dix mille de moins à dix mille annonces. Seules les pages de
  jeu et de ville le gardent, pour répondre 404 hors de leur liste.
  En phase 2, chaque rendu interrogera la base : ce sont les lectures qu'on mettra en cache,
  plus les pages (`supabase/README.md`, § 7).
  Les autres pistes ont été écartées sur pièces : l'intégrité des sous-ressources de Next
  (SRI) ne couvre que les scripts externes, pas le flux RSC en ligne ; des empreintes
  changeraient à chaque page et à chaque régénération ; un nonce fixe par build, ou posé
  après coup par un relais devant le cache, bénirait aussi le script injecté.
  **Décision du 1er octobre 2026 : l'A+ est gardé, à ce prix.** Tant que la CSP repose sur
  un nonce, le prérendu partiel est exclu — ni PPR, ni `cacheComponents` : leur coquille
  prérendue n'aurait pas le nonce de la réponse, et la CSP refuserait ses scripts.
  `tests/security-headers.test.mjs` refuse `cacheComponents`, toute page `force-static` et
  tout `generateStaticParams` qui ne sert pas un 404. Revenir sur cette décision, c'est
  rendre `'unsafe-inline'` aux scripts (B+) en échange des pages statiques et du cache CDN.
* **Un composant client ne reçoit que ce qu'il affiche.** La page « Déposer une recherche »
  sérialisait deux cents annonces complètes, pour qui chaque lot est réservé compris ;
  elle n'envoie plus que ce que le croisement lit (`MatchCandidate`).
* **Les droits se lisent côté serveur**, et la base les tient aussi : l'option « 8 photos »,
  l'annonce figée après la vente, le lot réservé aux pros qu'on ne propose pas à un
  particulier. 164 scénarios sont rejoués sur un PostgreSQL réel sous les rôles de l'API
  (`supabase/tests/`, voir [`docs/donnees/`](docs/donnees/README.md)).
* **La session de démonstration n'existe pas en production** : ni sur un déploiement de
  production, ni dès que la vraie authentification est configurée — `DEMO_USER_ID` restée
  là fait échouer le build (`src/lib/env.ts`). Le serveur vérifie toute sa configuration au
  démarrage (`src/instrumentation.ts`).
* **Une écriture ne rend plus périmé tout le site.** Les actions rafraîchissent des chemins
  concrets — la fiche, la page de son jeu et de sa commune —, et `refresh()` ce qui ne
  regarde que la personne : n'importe quel compte pouvait invalider les quelque mille pages
  en boucle.
* **Une écriture perdue en route ne fait pas perdre la saisie.** Coupure, délai, serveur
  redéployé : l'échec s'affiche à l'endroit du geste (`useMutation`), au lieu de remplacer
  la page par l'écran d'erreur.
* **La connexion ramène là où l'on allait, et nulle part ailleurs.** Une page réservée
  envoie sur `/connexion?suivant=…` ; ce chemin vient de l'URL et se trafique. Filtré par
  `safeReturnPath` à la lecture comme dans le schéma de l'action, il redevient l'accueil du
  compte dès qu'il n'est pas un chemin du site — `//site-piege.example`, `/\site-piege…`,
  une URL absolue : sans ce filtre, la connexion serait une redirection ouverte, le premier
  maillon d'un hameçonnage (`tests/routes.test.mjs`).

Restent ouverts pour la phase 2, et listés dans l'audit : les cookies de session face à une
régie publicitaire, et la limitation de débit — le statut `rate-limited` existe déjà,
l'interface sait le dire.

## Vérification

```
npm run typecheck    # TypeScript strict, imports morts et accès indexés vérifiés compris
npm run lint         # ESLint typé : configuration de Next, aucune API dépréciée ni
                     # déconseillée par Playwright (networkidle compris), aucun import
                     # de type qui chargerait son module, aucun avertissement toléré
npm run test         # format, grammaire, communes, schémas Zod, mappers dans les deux
                     # sens, écritures et leurs contrôles, schéma SQL synchronisé et sa
                     # sécurité (RLS, colonnes), audience des annonces, croisement
                     # lot/recherche, photos, facettes, jeux et couleurs, pureté du
                     # rendu client et son socle de navigateurs (compilé contre ES2022
                     # et le DOM), règles du lint et options du compilateur, dates
                     # balisées, typographie, largeur des textes et des pages,
                     # taille des composants, rôles d'encre des thèmes, composants
                     # React, audit de contraste en clair et en sombre
npm run build        # pages rendues à la demande (le nonce de la CSP), images statiques
npm run smoke        # parcours interactifs, desktop et mobile (serveur requis)
npm run screenshot   # captures desktop et mobile de chaque écran
node supabase/tests/run.mjs   # la base rejouée sur PostgreSQL (PGlite requis)
```

`npm run verify` enchaîne les quatre premiers. Les effectifs ne sont plus écrits ici : ils
changeaient à chaque parcours ajouté, et ce bloc annonçait 346 tests quand la suite en
comptait 477 — le lanceur les donne à chaque exécution.

Les deux derniers ont besoin d'un navigateur et d'un serveur lancé :

```
npx playwright install chromium
npm run build && npx next start -p 3117
npm run smoke
```

Les tests de composants rendent le JSX réel avec `react-dom/server` : `tests/alias-hook.mjs`
résout l'alias `@/` et transforme les `.tsx` avec esbuild, ce que le retrait de types natif
de Node ne fait pas.

`smoke.mjs` — un point d'entrée qui joue, dans l'ordre, les modules de `scripts/smoke/` —
vérifie ce qu'une capture ne montre pas : le filtre écrit bien dans l'URL, le
retour arrière défait le dernier filtre, la pagination conserve les filtres, la liste
déroulante maison se pilote au clavier, le formulaire vide déplace le focus sur le champ
fautif, un champ numérique vide ne devient pas zéro, l'annonce vendue reste servie en 200,
une page ville sans annonce est en `noindex`, **aucune valeur du bandeau de vignette n'est
coupée à l'écran** (mesure de débordement, invisible dans le DOM comme dans une capture),
toutes les photos se chargent réellement et portent un texte alternatif utile, **aucun
champ ne sort de sa carte de formulaire**, **le filigrane ne recouvre aucune donnée de la
vignette**, la case à cocher maison répond au clic et au clavier, **la publicité est identifiée,
tient sa taille nominale et ne décale rien**, le serveur ne tourne pas sur un build périmé,
et **aucune requête ne sort du domaine** en dehors des photos de démonstration.

Côté compte : une recherche se ferme en un clic sans quitter la page, la suppression
demande confirmation et **place le focus sur « Annuler »**, annuler laisse la ligne intacte,
le formulaire de modification est réellement pré-rempli avec l'annonce, **un champ non
mesuré y revient vide et jamais à zéro**, le lien permanent ne change pas à
l'enregistrement, une annonce qui n'est pas la sienne répond 404, l'ancienne adresse
`/mes-annonces` redirige, un seul onglet porte `aria-current="page"`, et **aucun emplacement
publicitaire n'apparaît sur le compte**.

Côté liste filtrée : le panneau réduit la grille sans quitter le jeu, **« Tout effacer » ne
retire pas le jeu** — il porte le titre de la page — la pagination le conserve aussi,
l'ancienne adresse `/pokemon/lots` redirige, **seule l'URL du jeu est indexable** quand ses
combinaisons de filtres passent en `noindex`, le plan de site déclare la bonne, chercher
depuis une page de jeu n'en sort pas, le panneau **suit le défilement sans passer sous
l'en-tête**, **aucun encart ne se peint par-dessus lui** — mesuré en ordre de peinture, pas
en géométrie, puisque les boîtes se chevauchent volontairement — et sur une fenêtre courte
son dernier champ reste atteignable.

Côté navigation : le dépliant « Annonces » liste les sept jeux et « Autre », et se referme à Échap comme au
clic dehors. Sur une page de jeu ou de ville, **un seul panneau d'onglet est présent dans
l'arbre d'accessibilité**, basculer ne quitte pas la page, le retour arrière défait la
bascule, **et aussi le filtre ou le changement de jeu posé après elle** — il ramenait
l'adresse sans la page —, les flèches, Début et Fin pilotent les onglets, un lien
`#recherches` partagé ouvre directement le bon, **le lien d'évitement ne change pas
d'onglet** — après lui, le retour arrière défait encore un filtre, sur `/annonces` comme
sur `/recherches`, et ni un filtre ni un intercalaire n'emportent `#contenu`, quand
l'onglet Recherches, lui, les suit —, **la page d'arrivée ne s'affiche jamais, pas même le
temps d'une mutation du DOM, sur l'onglet de la page quittée**, et **le compteur de chaque
onglet est comparé au nombre de vignettes réellement affichées dans son panneau**. La barre
de recherche d'une page de jeu reste dans ce jeu.
L'accueil montre une section de demandes qui **ne contient aucune photo** — si elle en
contenait une, c'est que la grille des lots aurait été réutilisée par erreur.

Côté séries : le filtre écrit dans l'URL et réduit la liste, il **annonce le nombre de lots
qu'il écarte** faute de déclaration, les séries proposées au dépôt suivent le jeu choisi et
**sont remplacées et non empilées** quand on en change, **plusieurs séries cochées arrivent
ensemble au récapitulatif** — `Object.fromEntries` n'aurait gardé que la dernière, et c'est
ce parcours qui attrape le bug — la modification restitue les cases déjà cochées, une
pastille de la fiche mène à la recherche correspondante, et **aucune pastille ne déborde de
sa vignette** en 360 px de large.

Côté audit de septembre 2026, chaque défaut corrigé a son parcours : **la première annonce
apparaît dans le premier écran d'un téléphone** (elle arrivait à 1 866 px), **le titre, le
prix et le contact d'une fiche aussi** (le titre arrivait à 2 133 px), **aucune page ne
déborde en largeur à 360 px**, les filtres mobiles s'ouvrent dans une feuille et
s'appliquent en direct, **« Contacter le vendeur » ouvre un message sur ce lot** et non la
boîte de réception, le vendeur voit ses outils sur sa propre fiche, « J'ai ce lot » propose
un de ses lots, **« Revenir au formulaire » retrouve toute la saisie**, l'aperçu de la
vignette suit la frappe et n'affiche jamais « 0 € », un fichier qui n'est pas une photo est
écarté avec sa raison, **« Tout effacer » vide aussi les champs de prix**, une pastille de
filtre se retire d'un clic, **un code postal cherche autour de sa commune**, une ville
inconnue propose des pistes sans vider la liste, **aucun « d'Valence » ni « les 1
critères »**, la page d'une ville compte et montre les lots voisins, et l'onglet courant du
compte se voit sur l'ardoise.

Côté offre pro : **une annonce réservée aux pros répond 404 à un particulier**, **aucune page
publique n'en laisse fuir le titre ni le lien** — accueil, liste, pages de jeu et de ville,
plan de site, espace pro —, l'espace pro ne montre à un particulier que des chiffres, jamais
une vignette, la page du forfait affiche son prix et un bouton désactivé qui le dit,
l'accueil y mène, une boutique porte son badge sur ses vignettes et un particulier non, et
**le choix « Professionnels uniquement » arrive jusqu'au récapitulatif du dépôt**.

Côté refonte « Gradé » : **le héros de l'accueil fait l'écran entier, navigation comprise,
et sa manchette la largeur de sa colonne** — mesurée sur l'étendue du texte, pas sur la
boîte, qu'un titre bridé à 20 caractères remplit quand même —, **« Déposé récemment » suit
l'ordre de dépôt et ne répète pas « À la une »**, **aucune vignette ne coupe son prix, sa
ligne de type ni son titre**, **l'aperçu de la vignette précède le bouton de publication sur
téléphone** (il arrivait à 4 312 px, après lui), un code postal tapé au dépôt devient le nom
de sa commune au lieu d'être refusé, la colonne épinglée d'une fiche tient jusqu'au bout
de la description sans défiler en elle-même, **les titres d'une rangée de vignettes
s'alignent**, **toutes les pages partagent le bord gauche de l'en-tête** — treize gabarits
centraient une colonne étroite qui commençait à 300 px quand le logo commence à 113 —,
**aucun titre de section n'est plus grand que le titre de sa page**, et sur téléphone le
champ d'un nouveau message est dans le premier écran.

Côté dépôt et demandes, fin septembre 2026 : **l'aperçu de la vignette est là dès
l'arrivée**, en emplacements vides (« Jeu ? », « — ») plutôt qu'en valeurs supposées — il
attendait jeu, format, état et langue —, **trois photos passent, la quatrième propose
l'option « 8 photos »**, la décocher marque les photos en trop et la publication les
refuse, **le dépôt et la page d'une recherche occupent toute la largeur du gabarit** —
bridées à 880, 1 000 et 1 200 px, elles laissaient jusqu'à la moitié d'un écran de 1 600 px
vide —, l'aperçu d'une demande suit la saisie et compte ce qui y répond déjà, **aucune
colonne épinglée ne porte sa propre barre de défilement**, et « Autre » a son intercalaire
et sa page, sans filtre ni liste de séries.

Côté gabarit : **aucune page ne s'arrête avant le bord droit du gabarit**. Dix pages —
dépôts, recherche, sécurité, mentions légales, espace pro, connexion, inscription,
signalement, 404 et erreur — étaient bridées entre 760 et 1 200 px ; chacune a maintenant
une seconde colonne qui sert (les signaux d'alerte épinglés à côté des règles, ce qui suit
un signalement, de quoi repartir d'une 404 — « Boîtier vide », qui ne joue plus sur
l'ancien nom), et le parcours mesure le bord droit du contenu réel, pas des boîtes. Le
gabarit lui-même suit la fenêtre sans palier : la règle `.container` vivait dans
`@layer components`, où l'utilitaire `container` de Tailwind l'écrasait — 1 216 px de
contenu de 1 280 à 1 535 px de fenêtre, soit 160 px de marge de chaque côté sur un
portable, puis un saut de 256 px d'un pixel à l'autre. Elle est sortie de la couche, et
`--container-max` (1 536 px) sert enfin.

Côté thème : sans choix la page suit l'appareil, **sans JavaScript aussi**, **un thème
imposé est posé avant la première peinture**, le choix survit au rechargement et
« Système » rend la main — l'appareil qui bascule ensuite est suivi sans rechargement et sans
désaccord d'hydratation —, un choix fait dans un onglet s'applique dans l'autre, et **une
page imprimée reste claire**.

Côté en-tête et listes : **l'en-tête tient de 360 à 1 920 px et l'invite de sa recherche
n'est jamais coupée** — la cloche l'avait fait déborder à 1 024 px, le bouton « Déposer »
sortait de l'écran ; sous 1 280 px, « Recherches » et « Pros » passent dans le menu et le
bouton devient « Déposer ». **« Sans photo » n'est jamais coupé** : il dépend de la place de
l'emplacement (requête de conteneur), plus de la largeur de l'écran. Et **un fil qu'on ne
peut plus que relire ne compte pas comme une réponse attendue**.

Côté navigateur : **aucune page n'écrit d'erreur ni d'avertissement dans la console** —
l'en-tête Permissions-Policy citait « bluetooth », que Chrome ne connaît pas, et chaque page
l'écrivait sans qu'aucun parcours ne le voie ; une violation de CSP ou un désaccord
d'hydratation y arriveraient de la même façon. **Rien ne se précharge avant l'intention**
sur les rangées de liens qu'on ouvre rarement : les intercalaires de l'accueil téléchargeaient
neuf pages à chaque visite, et le pied de page une vingtaine dès qu'il arrivait à l'écran.
Chaque parcours prouve aussi l'inverse — le survol précharge —, sans quoi il passerait avec
des liens morts.

Côté CSP : **chaque page reçoit une seule CSP, sans `'unsafe-inline'` ni eval pour les
scripts, avec un nonce neuf à chaque réponse**, et **tout script de la page porte ce
nonce** — une page figée au build garderait des scripts sans lui, et ne démarrerait plus ;
**toute réponse HTML porte la CSP, quels que soient les en-têtes de la requête, et jamais un
nonce fourni par celle-ci** — demandée avec le seul en-tête de préchargement du routeur, une
page sortait sans CSP, ses scripts marqués du nonce que la requête avait choisi ;
aucune page ne déclenche de violation, pas même après une navigation côté client ; **un
script glissé dans le HTML sans le nonce ne s'exécute pas** — avec l'ancienne CSP, il
s'exécutait ; et les icônes, images de partage et plan de site restent servis depuis le
cache.

Quatre des contrôles plus anciens existent aussi parce qu'un bug est passé : une `<legend>` flottante que le
conteneur flex ne dégageait pas envoyait les champs hors de la carte, le filigrane
recouvrait le bandeau de données, et **un pseudo un peu long débordait de sa carte sur
mobile** — « lecomptoirdukado » demandait 339 px là où la carte en offrait 272, sur le
profil public comme sur le compte. Tous sont invisibles dans le DOM — les éléments
existent, ils sont seulement mal placés — et ne se voient qu'en mesurant la géométrie.

## Couleurs et photos

**Sept couleurs vives identifient les jeux** — ambre Pokémon, bleu Magic, cramoisi One Piece,
prune magenta Lorcana, sarcelle Riftbound, violet électrique Yu-Gi-Oh, vert Naruto. Elles
servent partout : carré de la ligne de type sur chaque vignette, intercalaire actif, bande
des fiches « Par jeu », dos de carte d'une annonce sans photo, et ensemble dans la tranche
qui signe le site.

**La prune de Lorcana (#a104a9) a été choisie par le calcul**, arrivée en septembre 2026 : sur
toutes les teintes qui tiennent l'encre à 4,5:1 et l'audit de contraste dans les deux thèmes,
c'est la famille la plus éloignée des six couleurs en place et du graphite d'« Autre »,
daltonisme compris — au moins 0,045 au-dessus de chaque seuil. C'est l'encre améthyste du
jeu ; elle se distingue du violet clair de Yu-Gi-Oh par la clarté, porte le blanc (6,76:1) et
reste visible sur l'ardoise (2,61:1). Ses chapitres entrent au référentiel sous leur nom
anglais officiel, codés CH1 à CH9 : les noms français attendent d'être vérifiés.

**« Autre » n'a pas de couleur vive.** Il regroupe Digimon, Star Wars Unlimited et
tous les jeux sans intercalaire : une couleur franche y dirait un jeu qui n'existe pas. Son
graphite (#62666c, encre blanche à 5,77:1) est pourtant mesuré comme les autres — distance
perceptuelle aux sept couleurs, daltonisme compris, et audit de contraste dans les deux
thèmes —, et `tests/games.test.mjs` refuse qu'il devienne vif (chroma OKLab sous 0,03) ou
qu'il entre dans la tranche et le logo. Ses annonces de démonstration sont sans photo :
aucune image ne représente honnêtement un lot dont le jeu change d'une annonce à l'autre.

Ce README promettait « cinq teintes séparées d'au moins 60° ». C'était faux (bleu 221°,
violet 262° : 41°), et surtout ce n'était pas la bonne mesure : **l'ancien violet avait la
même clarté que le bleu, et pour un deutéranope — environ 6 % des hommes — les deux se
confondaient** (distance OKLab 0,004). Les couleurs sont désormais choisies par distance
perceptuelle, et `tests/games.test.mjs` mesure chaque paire en vision normale et sous trois
simulations de daltonisme (Machado 2009) : ≥ 0,15 en vision normale, ≥ 0,06 en deutéranopie
et protanopie, ≥ 0,08 en tritanopie. Rouge et vert (One Piece, Naruto) restent la paire la
plus proche sous daltonisme — la limite de toute palette qui garde un rouge et un vert —
mais aucune ne se confond, et le nom du jeu est toujours écrit en toutes lettres.

Le violet a demandé deux essais : assombri (#5b21b6) il se séparait du bleu mais tombait à
1,84:1 sur l'ardoise, et l'audit de contraste l'a refusé. Le violet retenu (#a970ff) est
plus clair que le bleu, porte l'encre sombre (5,67:1) et reste lisible sur l'ardoise
(5,08:1). Le sarcelle de Riftbound (#0ac8b9) est celui de l'interface « Hextech » de
League of Legends, l'univers du jeu.

Chaque couleur a **un token de texte compagnon** (`--pokemon-ink`, `--magic-ink`, …) :
blanc sur le bleu et le rouge, encre sur les quatre autres. Les douze paires sont mesurées
par l'audit de contraste, qui échoue si l'une passe sous 4,5:1.

**Les photos sont de vraies photographies Unsplash, regardées une à une.** Ce README
l'affirmait déjà ; la revue de septembre 2026, planche contact à l'appui, a trouvé
l'inverse : des cartes de baseball, des timbres et deux jeux de plateau sur les annonces
Magic ; du Yu-Gi-Oh (dos KONAMI bien visible), une carte Dragon Ball et une carte Pokémon
sur les annonces One Piece et Naruto, dans un pool « cartes d'anime » censé n'en montrer
aucune. Les descriptions automatiques d'Unsplash ne valent rien — « red ceramic mug » pour
une pile de cartes Pokémon. Les intruses sont parties, deux vraies photos Magic sont
arrivées, et `tests/listings-data.test.mjs` refuse désormais qu'une photo serve deux jeux.

Unsplash n'a **aucune** photographie honnête de One Piece, de Naruto ni de Riftbound (zéro
résultat pour ce dernier). Leurs annonces de démonstration s'affichent donc **sans photo** :
un boîtier hachuré et deux dos de carte pleins à la couleur du jeu — franche, pas un pastel,
qui faisait lire le cramoisi de One Piece comme un rose bébé —, marqués « Sans photo ».
Une photo qui montre un autre jeu que celui de l'annonce est pire que pas de photo.

`images.unsplash.com` est le **seul** domaine externe autorisé, déclaré dans
`next.config.ts` et vérifié par `npm run smoke` : les polices restent auto-hébergées et il
n'y a aucun CDN de script ni de style.

## Séries et produits

Une annonce déclare **de quelles séries sortent ses cartes** — EV08, Modern Horizons 3,
OP-09 — et **quels produits partent avec** : display, coffret dresseur d'élite, UPC, tapis.
Les deux sont des listes : un lot mixte couvre couramment trois séries et contient un
display, un coffret et des protège-cartes.

**Ni l'un ni l'autre n'est un champ libre.** Un champ libre produirait « EV8 », « ev-08 »,
« Étincelles » et « surging sparks » pour la même série, et aucun filtre ne pourrait plus
rien en faire.

**Les séries viennent des API de chaque jeu**, pas d'une liste écrite à la main :
`node scripts/editions-update.mjs` interroge TCGdex (Pokémon, noms français officiels),
Scryfall (Magic), YGOPRODeck (Yu-Gi-Oh), Lorcast (Lorcana), OPTCG API (One Piece) et
RiftHunt (Riftbound), garde les boosters — ni promo, ni jeton, ni deck de démarrage, ni
Commander, ni série numérique, ni série pas encore sortie — et réécrit
`src/lib/editions/editions.json` (214 séries le 1er octobre 2026, contre 98) ; Naruto, sans
API fiable, garde sa liste. Les appels ne partent que de ce script, jamais du navigateur ni
pendant le rendu d'une page : délai, `User-Agent` qui nomme l'application, 100 ms entre deux
appels, arrêt sur 429, réponses vérifiées par Zod, et une API en panne laisse la liste
précédente de son jeu. Le référentiel reste sur le serveur (`lib/editions.ts`) : le
formulaire de dépôt demande les séries du jeu choisi à `/series?jeu=…`, en cache public une
heure ; une modification reçoit celles de son jeu avec la page, cochées, même sans
JavaScript. `tests/editions-referential.test.mjs` rejoue le fichier depuis les réponses
enregistrées (`tests/fixtures/editions/`), sans réseau, et `npm run supabase:editions` le
charge en base, pour la clé étrangère des annonces.

Ce que les API ne disent pas s'écrit à la main (`scripts/editions-update/curated.mjs`) :
l'ordre des blocs, les blocs entiers et les époques, les années de One Piece — son API n'en
donne aucune —, et les corrections. **Un identifiant ne change jamais** : les 98 séries de
la migration 2 gardent le leur, leur nom et leur bloc, et une série que l'API ne donne plus
reste, marquée retirée — lue sur les annonces qui la citent, jamais reproposée.

Trois décisions sur ce référentiel, chacune contre l'exhaustivité et pour l'usage réel :

* **La langue suit le marché, pas une règle uniforme.** Pokémon a des noms français
  officiels que les vendeurs emploient, et TCGdex les donne ; Magic, One Piece et Yu-Gi-Oh
  se revendent sous leur nom anglais — aucune base ouverte ne recense de nom français
  officiel de Magic après 2023 —, et les séries Magic arrivent de Scryfall en anglais (celles
  de la migration 2 gardent leur nom français). Écrire « Empereurs du Nouveau Monde » sur une annonce OP-09 ne
  servirait personne. **Riftbound porte les deux** — « Origins / Origines », « Spiritforged /
  Armes Spirituelles » — parce que sa version française est arrivée sept mois après
  l'anglaise (31 octobre 2025, 29 mai 2026) et que le marché d'occasion mélange les deux.
  Ses séries (OGN, OGS, SFD, UNL, VEN) ont été recoupées sur plusieurs sources ; Radiance,
  annoncée pour le 23 octobre 2026, n'y est pas encore — aucun lot ne peut en contenir.
* **La granularité aussi.** Les séries récentes sont des extensions précises, les anciennes
  des blocs entiers, et Yu-Gi-Oh se décrit par époque. Un vendeur écrit « du vrac Neo et
  EX », jamais « Neo Genesis, Neo Discovery, Neo Revelation ». Le bloc entier est d'ailleurs
  proposé en tête de sa propre liste, sans quoi le champ resterait vide sur tout le vrac.
* **L'identifiant porte le jeu** (`pokemon-neo`, `magic-neo`) : « NEO » désigne Neo Genesis
  chez Pokémon et la Dynastie Néon chez Magic. C'est l'identifiant qui circule en base et
  dans l'URL, jamais le code seul.

Les produits sont eux aussi rapportés à leur jeu : « UPC » et « Coffret Dresseur d'Élite »
sont du vocabulaire Pokémon, « Structure Deck » du vocabulaire Yu-Gi-Oh. Le formulaire ne
propose que ce qui existe pour le jeu choisi, et **le schéma refuse le reste** — sans quoi
un formulaire trafiqué déposerait une extension Magic sur une annonce Pokémon et le filtre
par série deviendrait faux pour tout le monde.

**« Cartes à l'unité »** fait partie des produits, pour tous les jeux : les quelques cartes
choisies qu'un vendeur glisse dans son lot — les plus belles d'un classeur, par exemple.
C'est un contenu du lot, pas un format d'annonce : le site vend des lots, jamais la carte
seule, et l'indication du formulaire le dit.

**« Autre » n'a pas de référentiel de séries** : ses annonces couvrent des jeux différents,
et une liste serait celle d'un seul d'entre eux. Le formulaire ne propose donc rien à
cocher et demande de nommer le jeu et ses séries dans le titre et la description, que la
recherche lit ; le filtre « Série » disparaît de sa page plutôt que de n'offrir que « Toutes
les séries ». Sur la fiche, l'absence s'écrit « Nommées dans la description » et non « Non
précisé par le vendeur » : c'est le formulaire qui ne demandait rien.

### Le champ vide est une réponse

Un carton de six kilos couvre vingt séries. Le vendeur ne les cochera pas, et il a raison :
au-delà de douze séries **le formulaire refuse** et lui dit de laisser vide, parce qu'une
liste de vingt codes n'informe plus personne. L'annonce affiche alors « — Non précisé par le
vendeur », exactement comme un lot non compté.

Même chose pour les produits : une case non cochée ne dit pas si le vendeur a répondu
« non » ou s'il n'a pas répondu. On affiche l'absence, on ne la traduit pas en « rien
d'autre que les cartes ».

### Le filtre est strict, et il dit ce qu'il cache

Filtrer sur « Modern Horizons 3 » écarte les lots qui ne déclarent aucune série : on ne peut
pas affirmer qu'un carton non trié en contient. Mais **la colonne de filtres annonce combien
de lots elle écarte pour cette raison** — sinon l'acheteur croirait que rien d'autre
n'existe, alors que le carton à côté contient sûrement ce qu'il cherche.

Le menu ne propose que **les séries réellement présentes dans les annonces en ligne**, avec
leur nombre de lots. Une liste de quatre-vingts séries dont soixante-quinze ne ramènent rien
n'est pas un filtre, c'est un piège. Et les facettes sont comptées sur la recherche en cours
**moins le critère qu'elles pilotent** : sinon, choisir une série ferait disparaître toutes
les autres du menu et on ne pourrait plus en changer.

Les séries et les produits entrent enfin dans la recherche textuelle : taper « EV08 » ou
« tapis de jeu » trouve le lot même si son titre ne les écrit pas.

## Demandes de recherche

Les acheteurs peuvent déposer ce qu'ils cherchent : jeu, format, budget plafond, volume
minimum, et **jusqu'où ils se déplacent**. Même mécanique que côté vendeur — un lien
permanent, et un statut qu'on ferme en un clic quand on a trouvé, au lieu de repasser
fermer cinq posts dans cinq groupes.

**Ce n'est pas un deuxième type d'annonce.** L'objet est délibérément plus pauvre — ni
photo, ni état, ni prix ferme — et il ne se mélange jamais à la grille des lots : sa propre
route (`/recherches`), son propre gabarit, un bandeau de couleur pleine à la place de la
photo. Un acheteur qui parcourt les lots doit voir au premier coup d'œil que ceci n'en est
pas un.

Les pages `/recherches/[slug]` sont en **`noindex`** et absentes du plan de site : personne ne tape
« quelqu'un cherche du vrac Pokémon ». Seul le hub `/recherches` y figure.

### Filtrer les demandes comme les lots

`/recherches` et l'onglet « Recherches » d'une page de jeu ont le même panneau « Affiner »
que les ventes, avec ses propres critères : format accepté, budget minimum, particulier ou
boutique, et le tri. Seules les cartes et les filtres changent ; le gabarit est le même.
Les paramètres d'URL sont distincts de ceux des lots (`?budget=`, `?acheteur=`) : sur
`/annonces`, filtrer les demandes ne touche pas aux ventes, et le fragment `#recherches`
survit à chaque filtre. Comme pour les séries, le panneau annonce combien de demandes il
écarte faute de budget déclaré.

### Chercher qui viendrait jusqu'à moi

Le champ « Vous vendez depuis » de `/recherches` ne filtre pas sur la commune de
l'acheteur, et pas non plus sur un rayon autour du vendeur : il ne garde que les demandes
**dont le rayon couvre la ville saisie**. La question d'un vendeur n'est pas « qui habite
près de moi » mais « qui viendrait jusqu'à moi », et les deux ne se recouvrent pas — un
acheteur à 60 km prêt à en faire 100 est atteignable, un voisin à 15 km qui ne bouge pas de
10 km ne l'est pas. C'est le rayon de l'acheteur qui décide, jamais celui du vendeur.

La distance suit la même règle que sur les lots : elle n'apparaît sur une vignette de
demande **que si une ville a été saisie**. Sans origine, il n'y a pas de distance et on n'en
invente pas.

### Le croisement, qui justifie tout le reste

Sans lui, une demande de recherche n'est qu'un panneau d'affichage que personne ne relit.
`matchesWantedCriteria` croise un lot et une demande sur le jeu, le format, le budget et la
distance acceptée. Les deux côtés sont décrits par leur **forme minimale** et non par le
type du domaine : c'est ce qui permet de croiser un objet publié aussi bien qu'un
formulaire encore à l'écran. Il tourne aux quatre moments de plus forte intention :

* **à la validation du dépôt d'annonce** — « 3 personnes cherchent ce que vous décrivez » ;
* **pendant la saisie d'une recherche, puis à sa validation**, symétriquement — « 4 lots
  correspondent déjà à ce que vous cherchez ». Le compte suit chaque critère dans la colonne
  de l'aperçu : un budget relevé, un rayon élargi, et l'acheteur voit ce que ça change. Sans
  ça, il déposerait sa demande et attendrait alors que son lot est en ligne depuis trois
  semaines à vingt minutes de chez lui ;
* **sur le tableau de bord**, dans les deux sens : par annonce, et par recherche ;
* et **sur la page d'une demande** : les lots déjà en ligne qui y répondent.

Une correspondance est **certaine** ou **à vérifier**. À vérifier quand un critère n'est
pas contrôlable : l'acheteur demande 300 cartes minimum, le vendeur n'a pas compté. On ne
la déclare pas certaine, mais on ne la cache pas non plus — un carton de six kilos dépasse
évidemment 300 cartes. C'est à l'humain de trancher, pas à un filtre qui ferait semblant de
savoir.

« Autre » ne croise jamais qu'**à vérifier** : un lot Digimon et une demande Star Wars
Unlimited y portent le même jeu, et seul le titre dit lequel. On ne peut ni l'affirmer ni
l'exclure — la règle est la même que pour un lot non compté.

Le format demandé n'est jamais élargi : un « classeur » ne matche pas un « lot mixte ». Une
correspondance approximative répétée détruit la confiance dans la notification, et le
vendeur cesse de la lire.

### Les deux côtés du marché, sur la même page

Chaque page de jeu et chaque page de ville porte **deux onglets** : ce qui s'y vend, et ce
qu'on y cherche, avec le compte des deux côtés. À Avignon, un vendeur Pokémon lit
« Ventes 1 » et « Recherches 3 » — l'asymétrie est l'information, et elle se lit sans
quitter la page.

**Les deux panneaux sont rendus par le serveur et vivent dans le HTML** : la bascule ne va
rien chercher, elle montre. Le panneau inactif porte `hidden`, ce qui le retire aussi de
l'arbre d'accessibilité — le masquer en CSS l'aurait laissé lisible par un lecteur d'écran,
qui aurait annoncé deux listes concurrentes.

L'état vit dans le **fragment** (`#ventes`, `#recherches`) et non dans un paramètre de
requête. Le fragment se copie, se partage et le retour arrière le défait, comme un filtre
d'URL — mais contrairement à `?vue=`, il ne demande rien au serveur, puisque les deux
panneaux sont déjà dans la page, et il n'invente pas une seconde adresse pour le même
contenu, que les moteurs devraient apprendre à ignorer sur chaque page de ville.
C'est le motif d'onglets de l'APG : flèches, Home et End circulent, un seul onglet est
atteignable à la tabulation.

La bascule écrit le fragment par `history.pushState`, que Next intègre à son routeur : il
recopie son état dans l'entrée d'historique. Écrite par `location.assign`, l'entrée n'en
avait aucun, le routeur ignorait le retour vers elle, et un filtre ou un changement de jeu
posé ensuite ne se défaisait plus — l'adresse revenait, la page non. Next branche cette
intégration dans un effet : une bascule cliquée juste après l'hydratation la devance, et
la vue réécrit son entrée au rendu suivant — le retour depuis Pokémon échouait une fois sur
douze, un parcours rejoue désormais ce moment. Un lien d'ancre, comme
le lien d'évitement, crée lui aussi son entrée sans état, sur toutes les pages :
`FragmentHistorySync`, monté une fois dans le gabarit, la réécrit par
`history.replaceState` dès son `hashchange`, et Next y recopie l'arbre de la page
affichée.

Seuls les deux fragments de la bascule la pilotent : `#contenu`, que pose le lien
d'évitement, renvoyait aux ventes la personne au clavier qui venait de choisir les
recherches. Et seuls eux voyagent : un filtre ou un intercalaire emporte l'onglet ouvert
vers l'adresse suivante, jamais `#contenu`, qui s'installait dans des adresses qu'on
partage.

Pendant une navigation, Next n'écrit la nouvelle adresse qu'en affichant la page : jusque-là,
l'adresse est celle qu'on quitte, et son fragment ne dit rien de la page qui arrive. La
bascule le voit — le chemin de sa page, lu dans le routeur, n'est pas encore celui de
l'adresse — et prend alors la vue que la navigation a emportée, notée au clic par
l'intercalaire, sinon les ventes. Lire l'ancien fragment ouvrait la page d'Avignon sur les
recherches le temps d'une image, après un lien ordinaire quitté depuis les recherches.

Ce que la bascule ne fait pas : mélanger les deux grilles. Une demande garde son gabarit —
pas de photo, un bandeau de couleur pleine — et sa propre route `/recherches/[slug]`. Deux listes
dans un même panneau seraient exactement ce que le produit refuse.

### Une seule page de liste, filtrée

`/pokemon` **est** la page Pokémon, et `/annonces` celle de tous les jeux : le même écran
(`ListingsScreen`), le jeu en plus. Il n'y en a pas deux.

`/pokemon/lots` a existé, avec son titre, son texte et ses onglets. Le jour où `/annonces` a
reçu le panneau « Affiner », les deux pages sont devenues identiques — deux URL pour le même
contenu, ce que Google appelle du contenu dupliqué et ce qu'un développeur appelle deux
endroits à corriger. Elle a donc été supprimée, et **tout ce qui la justifiait a déménagé** :

* son `<title>`, sa meta description et son `<h1>` — composés à partir du jeu de l'adresse,
  avec la balise canonique sur `/pokemon` ;
* son texte de référencement (`GameOverview`) : nombre de lots, fourchette de prix, formats
  représentés, et combien de personnes cherchent ce jeu en face ;
* ses liens vers les pages de ville (`CityLinks`), les communes du jeu qui ont des lots —
  sans eux, les pages jeu × ville ne seraient plus atteignables que par le plan de site, ce
  qui reviendrait à les publier sans les relier à rien ;
* ses onglets Ventes / Recherches.

L'ancienne adresse répond par une **redirection permanente**. Un site qui promet des liens
qui ne bougent pas ne casse pas les siens.

**La page d'un jeu a ensuite vécu sous `/annonces?jeu=pokemon`, puis est passée à `/pokemon`**
(septembre 2026, avant l'ouverture). Un paramètre marchait, mais `/pokemon` se lit et se
partage, prolonge les pages de ville — `/pokemon/avignon` répondait quand `/pokemon` tombait
en 404 —, et laisse `robots.txt` écarter d'une seule règle les combinaisons de filtres. Les
filtres restent des paramètres (`/pokemon?etat=NM`), l'ancienne adresse redirige en gardant
les siens (`/annonces?jeu=magic&type=bulk` → `/magic?type=bulk`), et les intercalaires sont
devenus des liens : changer de jeu change de page — l'adresse, le titre, la balise canonique
—, et un lien se suit sans JavaScript. Ils gardent les critères communs (prix, état, ville)
et laissent ceux du jeu quitté (séries, produits) ; ils gardent aussi l'onglet ouvert
(`#recherches`).

**Un seul critère mérite d'être indexé : le jeu.** Il a un titre, un texte et un public.
Tri, série, prix, page produisent des milliers de combinaisons qui diraient toutes la même
chose : elles restent servies, en `noindex, follow`. Le plan de site ne déclare que les huit
URL de jeu, « Autre » compris.

Le jeu sélectionné est un critère **imposé au panneau** : « Tout effacer » remet les filtres
à zéro sans quitter Pokémon, et il ne compte pas dans les filtres actifs — on ne l'a pas
choisi dans le panneau, on est arrivé par là.

**Le panneau suit le défilement**, et la colonne d'action d'une fiche d'annonce aussi — même
classe `.sticky-column`, écrite une fois. Le geste qu'on refait le plus est de remonter
changer un critère, ou de revenir au prix après avoir lu la description.

Une règle apprise en la posant, et elle a coûté deux bugs : **un élément épinglé garde sa
place dans le flux**, si bien que ses voisins situés en dessous remontent et se dessinent
par-dessus lui. C'est ainsi que le pavé publicitaire s'est retrouvé au milieu des filtres.
La corriger en enfermant toute la colonne dans un conteneur défilant a produit le bug
suivant — une barre de défilement permanente sur toute la hauteur. La bonne réponse tient en
une ligne : le panneau est dans la couche positionnée, les encarts glissent derrière lui.

Le filet de sécurité qui restait — une hauteur maximale et un défilement interne pour les
fenêtres courtes — a produit le troisième : une annonce réservée, sur un écran de 860 px,
portait une barre de défilement en permanence, et le panneau « Affiner » dès 1 000 px.
`StickyColumn` n'a plus de défilement interne. Plus haute que la fenêtre, la colonne suit
la page **dans les deux sens** : elle colle par le bas en descendant, et revient sous
l'en-tête dès qu'on remonte, sans remonter toute la liste. Le mécanisme tient dans le `top`
d'un élément sticky, ajusté à chaque défilement entre deux bornes ; sans JavaScript, la
colonne colle par le haut, et un élément qui reçoit le focus hors de l'écran y est ramené.

### Pourquoi le mot « lot » a quitté les titres

Une page qui porte les deux côtés ne peut pas s'appeler « Lots Pokémon » : la moitié de ce
qu'elle montre, personne ne le vend. Le titre est devenu « Cartes Pokémon d'occasion », la
navigation dit « Pokémon », et les onglets « Ventes » et « Recherches » — deux noms
symétriques, ni « lot » ni « vendeur », parce que l'un des deux côtés n'est ni l'un ni
l'autre.

Le mot reste partout où il est juste : dans le corps du texte, dans les formats de lot, dans
la promesse du site. C'est le titre et la navigation qui mentaient, pas le vocabulaire.

### Fermer en un clic

`WantedStatusSwitcher` est le pendant acheteur du sélecteur de statut d'annonce, et il est
la promesse entière de la fonctionnalité : on ferme dès qu'on a trouvé, au lieu de repasser
fermer cinq posts dans cinq groupes. **« Trouvé » et « Abandonnée » sont deux fins
distinctes** — la première dit que le produit a servi, la seconde que l'acheteur est parti
ailleurs. Les confondre ferait disparaître la seule mesure honnête de l'utilité du
croisement.

Fermer n'est pas supprimer : une demande close reste dans le compte de son auteur, son lien
continue de répondre pour ceux qui l'avaient gardé, et la rouvrir coûte un clic. Elle
disparaît en revanche de la liste publique et ne reçoit plus aucun croisement.

## Mise en avant, « Urgent », « Remonter » et « 8 photos »

Quatre options payantes au dépôt, présentées sous l'aperçu de la vignette — on voit ce
qu'elles y posent au moment de cocher — et à côté du bouton de publication. Les trois
premières ont une date de fin écrite par le service de
paiement seul (`featured_until`, `urgent_until`, `bump_until`, retirées des droits du rôle
connecté) :
**À la une** — la carte holographique du lot — et **Urgent**, 1 € pour 7 jours, un drapeau
sur la vignette et la fiche pour qui doit vider son grenier avant un déménagement. Une
option qui expire ne se retire pas à la main, et un lot vendu n'est plus urgent même si
l'option court encore.

**Remonter**, 1,50 € : chaque jour pendant 7 jours, l'annonce repasse en tête du tri par
défaut, sous les annonces à la une — l'équivalent du post qu'on republie sur Facebook, sans
perdre son lien. Les prix suivent ce que chaque option déplace : « Urgent » ne fait rien
passer devant, la remontée replace une fois par jour, la mise à la une tient la tête sept
jours d'affilée. **La vignette garde sa vraie date de dépôt**, et dit « Remontée » à côté :
un classement acheté qui ne se signale pas est une pratique trompeuse (directive
2005/29/CE, annexe I, point 11 bis), et une annonce de vingt jours rangée parmi celles de
la veille, sans un mot, laisserait croire qu'elle vient d'arriver. « Déposé récemment », sur
l'accueil, reste dans l'ordre réel des dépôts, et le tri par prix ne se laisse pas acheter.
Le rang se déduit de deux dates (`getRankedAt`, `lib/listing-lifecycle.ts`) : aucune tâche
ne réécrit rien. Payer une remontée relance aussi l'échéance de l'annonce (voir
« Expiration et archivage »). La mise à la une en 30 jours attend : sans places limitées,
toutes les annonces à la une passent devant, et en vendre davantage vendrait du vent.

**8 photos**, 3 € : trois photos sont gratuites, l'option ouvre les cinq suivantes, une fois
pour toutes (`extra_photos`, écrite elle aussi par le service de paiement seul). Le
sélecteur la propose au moment où elle sert — quand les trois photos gratuites sont posées
— et, si on la décoche, marque les photos en trop « Hors forfait » au lieu de les retirer :
c'est au vendeur de choisir lesquelles garder. Le schéma refuse la quatrième photo sans
l'option dès le premier envoi, même quand un autre champ est faux — ses contrôles d'objet
ne tournaient qu'une fois tout le reste valide —, et la base aussi, en dernier recours : un
déclencheur sur `listing_photos` exige l'option au-delà de la troisième. Le paiement
précède donc l'écriture des photos 4 à 8. Une annonce qui l'a payée la retrouve acquise à la
modification.

**Le droit se lit sur l'annonce, jamais dans le formulaire.** La case cochée — ou le champ
caché d'une annonce qui a déjà l'option — n'est qu'une demande d'achat : sans l'option
payée, les trois premières photos paraissent et les suivantes attendent la confirmation du
paiement, ce que le récapitulatif dit au vendeur (« 8, dont 5 en attente du paiement de
l'option »). Un formulaire trafiqué s'offrait l'option ; `lib/photo-allowance.ts` la tranche
désormais, et `tests/photo-allowance.test.mjs` le vérifie sur une annonce qui ne l'a pas.

## Expiration et archivage

**Une annonce quitte les listes quatre-vingt-dix jours après le dernier geste de son
vendeur** — la déposer, la modifier, en changer le statut, la prolonger. C'est l'annonce
morte que le produit promet de ne pas laisser traîner : vendue ailleurs, jamais passée en
« Vendu », et qui ment à chaque acheteur qui écrit. **La prolonger est gratuit et tient en
un clic** — on ne fait pas payer ce qui garde le site fiable.

* **Rien n'est supprimé à l'expiration.** L'annonce sort des listes, des recherches, du plan
  de site, de l'index et des croisements, ne reçoit plus de conversation ni d'inscription en
  liste d'attente ; sa page répond encore — son lien a pu être partagé —, avec le badge
  « Expirée », sans bouton de contact, et dit qu'elle n'est plus en ligne. Son vendeur la
  retrouve dans « Mes annonces », section « Expirées », et la remet en ligne d'un clic.
* **Le décompte est dans « Mes annonces », pas sur le profil public** : un acheteur n'a pas
  à savoir qu'un lot va expirer. Une date discrète d'abord (« En ligne jusqu'au
  31 décembre »), le décompte et le bouton « Prolonger » à quatorze jours de l'échéance, puis
  à sept une notification dans la cloche et une ligne dans la vue d'ensemble. En jours,
  jamais un minuteur qui tourne.
* **Trente jours après sa sortie du marché — vente ou expiration —, l'annonce est archivée :
  ses photos sont supprimées de BulkTCG**, le texte, le prix et les avis restent, et son lien
  répond toujours. Ce sont des photos prises chez les gens, et on ne les garde pas plus
  longtemps que nécessaire (RGPD, limitation de la conservation) — c'est la raison qu'on
  donne, et pas l'écologie : quelques centaines de kilo-octets par annonce ne pèsent rien,
  et une allégation environnementale générique est justement ce que la directive
  2024/825 encadre. Le jour est le même que celui où une annonce vendue sort de l'index.
  « De BulkTCG » et non « partout » : Facebook et WhatsApp gardent leur copie de l'image de
  partage d'un lien qu'on y a collé.
* **Le vendeur le lit avant que ça arrive** : au dépôt, dans la section Photos — c'est au
  moment où l'on recueille une photo qu'on dit combien de temps on la garde —, au passage
  en « Vendu », puis sur la ligne de chaque annonce, avec la date (« Ses photos seront
  supprimées le 2 novembre »). Une annonce archivée n'affiche pas « Sans photo », qui
  laisserait croire qu'elle n'en a jamais eu, mais « Photos retirées ».
* **Aucun bouton « Archiver maintenant »** sur une vente conclue : on a figé l'annonce
  vendue, photos comprises, pour qu'un vendeur ne puisse pas effacer ce qu'un acheteur cite
  dans son avis. L'archivage, trente jours après, est le seul geste qui les retire.
* **Un signalement encore ouvert garde les photos** de l'annonce qu'il vise, jusqu'à la
  décision de la modération : elles sont la pièce du dossier. La page, elle, ne les montre
  plus — rien n'apprend au vendeur qu'il est signalé.

Rien n'expire par une tâche : une annonce est expirée dès que sa date est passée, et chaque
lecture le voit (`lib/listing-lifecycle.ts` côté site, `listing_on_market` côté base, aux
mêmes durées — `tests/schema-sync.test.mjs`). La tâche quotidienne, appelée par Vercel Cron
avec son secret (`/taches/quotidiennes`), ne fait que ce qui demande une écriture : prévenir
le vendeur une semaine avant, une fois par mise en ligne, et retirer les photos des
annonces archivées (`supabase/README.md`, § 5). Dans la démonstration, l-40 expire dans
quatre jours, l-41 a expiré, l-07 est vendue et archivée, et l-06 est remontée.

## Offre professionnelle

Deux choses distinctes, que le site a longtemps confondues : **le statut professionnel**,
gratuit, et **le forfait pro**, payant.

* **Le statut** dit qui vend. Une boutique, un dépôt-vente ou un revendeur le déclare dans
  Paramètres, avec le SIRET de son établissement — jamais à l'inscription : la plupart des
  comptes sont des particuliers, et une inscription courte est une inscription faite ; la
  page d'inscription dit seulement où aller. Le SIRET est vérifié aussitôt : sa forme dans
  le navigateur (clé de Luhn, `lib/siret.ts`), puis l'établissement auprès du répertoire des
  entreprises (`lib/company-registry.ts`) — l'API Recherche d'entreprises de l'État, sans
  clé, puis l'API Sirene de l'Insee si sa clé est configurée, pour une entreprise qui a
  refusé la diffusion de ses données et que la première ne montre pas. Un établissement en
  activité fait passer le compte en « pro », avec sa raison sociale et la date de la
  vérification ; fermé ou introuvable, il est refusé, et une panne ne conclut rien. Le
  statut porte le **badge PRO, l'enseigne et la fiche boutique**, partout où le compte
  apparaît, **forfait ou non** : un acheteur doit savoir qu'il traite avec un professionnel
  (Code de la consommation, L111-7), et afficher une boutique en particulier parce que son
  forfait est échu ressemblerait à la pratique que l'article L121-4 interdit. Un SIRET ne
  sert qu'un compte ; un SIRET prouve qu'un établissement existe, pas qui le dirige, et
  c'est la déclaration cochée à côté qui engage le compte. On repasse en particulier
  soi-même, depuis Paramètres, jamais avec un forfait en cours.
* **Le forfait** (29 € HT par mois, sans engagement — montant provisoire, une seule
  constante dans `lib/site.ts`) suppose le statut, et n'ouvre qu'une chose : **les lots
  réservés aux pros**. En face, un particulier choisit au dépôt **qui voit son annonce :
  tout le monde, ou les seuls pros**. C'est la différence du site : un carton de succession
  ou une collection entière se vend mieux à une boutique qui estime sur place et paie
  comptant qu'à trente inconnus.

**Chaque annonce dit la qualité de son vendeur** (Code de la consommation, D111-8). Au
dépôt, un particulier coche qu'il vend à titre personnel, sous la peine qu'il encourt s'il
est en réalité professionnel — jusqu'à cinq ans et 750 000 € quand la pratique a lieu en
ligne (L132-2), le texte relié sur Légifrance ; le serveur refuse le dépôt sans elle. Une
boutique ne déclare rien de plus : son statut le dit déjà. Sur la fiche, « Conditions de la
vente » écrit « Vente entre particuliers » — ni droit de rétractation ni garantie légale de
conformité, la garantie des vices cachés reliée au Code civil — ou « Vendu par un
professionnel », et rappelle que le prix affiché est le prix total. Les mentions légales
disent qui publie et ce qui décide de l'ordre des annonces, options payantes comprises.

**Les pages Cardmarket et CardNexus d'une boutique sont déclarées, et ne seront pas
vérifiées** : c'est un lien, pas une garantie, et sa fiche le dit à côté (« déclaré par la
boutique »). Décidé le 2 octobre 2026 : vérifier ces comptes n'apporte pas assez pour ce
que cela coûterait. Deux idées avaient été écartées avant cela : envoyer un code par la
messagerie de Cardmarket — ses conditions la réservent aux transactions faites chez eux, et
Cardmarket a mis en garde contre l'hameçonnage par message privé : le compte de BulkTCG
s'exposerait —, et recopier ses statistiques — son API ne prend plus de nouvelles demandes,
ses conditions interdisent d'en reproduire le contenu, et un chiffre recopié vieillit et
finit par mentir. Le lien mène à la page à jour.

**Une annonce réservée aux pros n'existe que pour son vendeur et les pros au forfait
actif.** Ni la recherche publique, ni les pages de jeu et de ville, ni le plan de site, ni
les images de partage ne la voient ; son lien répond 404 à tout autre visiteur — dire
« réservée » confirmerait qu'elle existe, et son titre aurait fui dans les métadonnées.

* **Côté données**, toutes les lectures publiques de `lib/data/listings.ts` partent d'un
  seul ensemble, `PUBLIC_ROWS` : aucune page ne peut laisser fuir un lot réservé par oubli
  d'un filtre. Une fiche passe par `getListingForViewer(slug, viewerId)`, le tableau de bord
  d'un vendeur par `getListingsOwnedBy`, l'espace pro par `getProOnlyListings`, qui rend une
  liste vide à qui n'y a pas droit — même si la page oubliait de garder la porte.
* **Côté base**, c'est la RLS qui tranche : la politique de lecture des annonces n'admet une
  annonce réservée que pour son vendeur ou `is_active_pro(auth.uid())`, et les photos,
  séries et produits suivent leur annonce au lieu d'être publics. **Personne ne se passe pro
  depuis son navigateur** : `account_type`, `siret`, `legal_name`, `pro_verified_at` et
  `pro_until` sont retirés des droits d'écriture du rôle connecté — le serveur écrit le
  statut après la vérification du SIRET, le service de paiement le forfait.
  `tests/schema-security.test.mjs` tient ces règles, et `supabase/tests/` les rejoue.
* **Pour les lots réservés, c'est la date du forfait qui décide**, pas le statut : un
  forfait expiré ne voit plus rien de plus qu'un particulier, mais garde son badge et sa
  fiche. Le compte de démonstration `u-15` est dans ce cas, pour que le chemin soit exercé.
* **Ce qu'un particulier voit de l'espace pro** : combien de lots y attendent, et de quels
  jeux. Jamais un titre, jamais un prix. Une ligne sous les résultats publics le dit
  (« 3 autres lots sont réservés aux professionnels »), et mène à `/pro/lots`.

**Une annonce peut passer « pros » après coup**, même déjà discutée avec des particuliers.
Ceux qui avaient écrit **gardent l'accès à la fiche et à leur fil** — leur conversation ne
renvoie pas vers une annonce disparue —, voient le badge « Réservée aux pros » et une ligne
qui dit pourquoi ils ne peuvent plus répondre ; le vendeur, lui, peut encore leur écrire.
Personne d'autre ne voit l'annonce. La règle « qui peut encore écrire » tient en une
fonction, `getReplyBlock` (`lib/conversation-display.ts`), lue par la couche données, la
fiche et la messagerie — elle était recodée à quatre endroits — et la base la tient aussi :
la lecture d'une annonce admet les participants de ses conversations, l'écriture d'un
message refuse un particulier sur une annonce passée « pros ».

**La fiche boutique** — adresse, horaires, site, SIRET avec sa date de vérification, raison
sociale, pages Cardmarket et CardNexus — s'affiche sous le badge PRO du profil tant que le
compte est professionnel. La boutique renseigne l'adresse, les horaires, le site et ses
pages depuis « Profil public » ; le SIRET et la raison sociale viennent de la vérification,
dans Paramètres. **Dans la démonstration ils restent vides et s'affichent « — »** : un
numéro inventé mais vraisemblable, ou le lien vers le compte Cardmarket de quelqu'un
d'autre, serait pire qu'une absence, et les sites sont en `.example`, un domaine réservé.
La base refuse une fiche boutique sur un compte de particulier.

Les pages : `/pro` présente le forfait aux deux côtés — la boutique qui paie, le
particulier qui réserve —, `/pro/lots` est l'espace des boutiques (en `noindex`), et une
section de l'accueil, « Vendre à un pro, en un clic », y mène. Le badge **PRO** et
l'enseigne s'affichent à côté du pseudo partout où un vendeur ou un acheteur apparaît.

Phase 1 : **aucun paiement**. Le bouton « Souscrire au forfait » est désactivé et l'écran
dit pourquoi. La déclaration du statut, elle, fonctionne déjà : en démonstration le SIRET
est vraiment vérifié auprès du répertoire, et l'écran dit que rien n'est enregistré. Pour
voir le site comme une boutique : `DEMO_USER_ID=u-13 npm run dev`.

**Les photos d'une annonce réservée aux pros sont privées**, pas seulement ses lignes. Elles
vivent chez Cloudflare Images comme les autres, mais marquées privées : une adresse ne suffit
pas à les voir, il faut une URL signée. La page n'en porte jamais : elle porte une adresse du
site, `/photos/<clé>/<variante>`, qui revérifie le lecteur à chaque image et le renvoie vers
une URL signée de dix à quinze minutes — une page restée ouverte continue de charger ses
photos, une URL recopiée ailleurs meurt vite (`supabase/README.md`, § 8). Changer l'audience
d'une annonce change la visibilité de ses photos — privées avant que l'annonce passe aux
pros, publiques seulement après qu'elle en est sortie.
C'est aussi pourquoi le registre des téléversements existe (`photo_uploads`) : Cloudflare
tire lui-même l'identifiant d'une image privée, si bien qu'aucun préfixe de chemin ne peut
dire à qui elle appartient — c'est la base qui le dit, et elle le vérifie à chaque photo
accrochée, même par la clé de service du webhook de paiement, que la RLS ne retient pas :
sans quoi un vendeur glisserait le fichier d'un autre parmi ses photos 4 à 8, et l'option
payée le rendrait public. Un fichier n'affiche qu'une photo, d'une seule annonce.

## Le compte

`/mon-compte` regroupe tout ce qu'une personne fait de son côté du site. Six onglets, un
seul gabarit : l'identité et la navigation vivent dans `layout.tsx` et ne se rechargent pas
d'un onglet à l'autre.

| Onglet | Ce qu'il porte |
|---|---|
| Vue d'ensemble | ce qui demande une réponse, le suivi par étapes, puis l'activité chiffrée |
| Mes annonces | les lots par étape — disponible, réservé, vendu, expirée —, avec statut, échéance, prolongation, modification, suppression |
| Mes recherches | les demandes par étape — en recherche, trouvé, abandonnée —, avec les mêmes gestes |
| Ventes et achats | ce qui s'est conclu, dans les deux sens, chaque vente avec son récapitulatif |
| Profil public | ce que les autres voient — pseudo, ville, présentation, fiche boutique pour un pro |
| Paramètres | connexion, alertes, et la suppression du compte |

**Le suivi**, en vue d'ensemble, est le tableau des commandes d'un site de vente appliqué à
des lots : une ligne par objet — mes annonces, mes achats, mes recherches —, une case par
étape, chacune comptée et menant à sa liste filtrée (`?etape=reserve`, `?vue=a-noter`).
« Acheteur à noter » et « Vendeur à noter » passent en encre pleine dès qu'ils comptent
quelque chose : c'est le seul geste qui reste à faire après une vente. Zéro s'y affiche —
ici c'est une information, pas une absence. `npm run smoke` vérifie qu'une étape compte
autant de lignes que la liste vers laquelle elle mène.

**La vue d'ensemble ne liste que ce qui appelle une action.** Une ligne à zéro n'est pas
affichée : un tableau de bord qui énumère ce qu'il n'y a pas à faire cesse d'être lu. Quand
tout est à zéro, un état plein le dit en une phrase. Les lignes sont les deux sens du
croisement, les messages sans réponse et les ventes qui attendent votre avis — c'est ce
qu'un tableau de bord apporte qu'une liste d'annonces n'apporte pas.

**Les chiffres ne sont jamais stockés.** Les vues, les croisements et le montant encaissé
sont recalculés sur les annonces réelles à chaque visite. Le compteur de ventes du profil
public, lui, est bien une donnée de compte, et l'écart entre les deux est écrit en clair
plutôt que masqué.

### Modifier

Les deux formulaires de dépôt servent aussi à la modification : mêmes composants, mêmes
schémas Zod, un jeu de valeurs par défaut en plus. `lib/form-defaults.ts` est le chemin
inverse de `lib/format.ts` — du domaine vers ce qu'un champ attend — et il tient la règle de
données dans ce sens-là aussi : **une valeur absente redonne une chaîne vide, jamais
« 0 »**. Sans ça, un aller-retour d'édition transformerait « je n'ai pas compté » en « il y
a zéro carte », et l'enregistrement figerait le mensonge en base.

Le lien permanent ne change pas, même quand le titre change : c'est la promesse du produit,
et le récapitulatif de modification affiche l'URL réelle et non une prévisualisation.

Une annonce qui n'appartient pas au compte répond **404 et non 403** : dire « interdit »
confirmerait qu'elle existe.

### Supprimer

Confirmation en deux temps, dépliée dans le flux et pas dans une boîte modale — la ligne
concernée reste visible au-dessus, on voit ce qu'on s'apprête à supprimer. Le bouton rouge
n'existe qu'au second temps, **le focus part sur « Annuler »** pour qu'une touche Entrée
d'un doigt trop rapide ne déclenche rien, et la confirmation nomme l'objet plutôt que
d'écrire « Supprimer ? » seul.

Chaque confirmation dit ce qu'on perd et propose l'alternative moins définitive : passer
l'annonce en « Vendu », la recherche en « Trouvé ». La page reste alors servie, les avis
reçus dessus survivent, et le lien continue de répondre.

Phase 1 : **rien n'est supprimé, et l'écran le dit**. Une confirmation de suppression
mensongère serait pire que pas de bouton du tout.

### Ce qui a bougé

`/mes-annonces` est devenu `/mon-compte/annonces`. L'ancienne adresse répond par une
redirection permanente déclarée dans `next.config.ts` : un site qui promet des liens qui ne
bougent pas ne casse pas les siens.

## Ouvert à l'échange

Beaucoup de lots se troquent plutôt qu'ils ne se vendent — un classeur One Piece contre du
vrac Magic. **L'échange n'est pas une troisième catégorie** à côté des ventes et des
recherches : un troisième onglet aurait coupé en trois une offre déjà mince, et obligé le
vendeur à choisir entre vendre et échanger alors qu'il accepte souvent les deux. C'est
**une option de l'annonce** : une case au dépôt, « Ouvert à l'échange », et un champ
facultatif « Contre quoi ? » qui n'apparaît qu'une fois la case cochée.

Le prix reste obligatoire et affiché : il donne la valeur de référence de l'échange. La
vignette porte « ⇄ Échange » dans son pied, entre le lieu et l'âge — une condition de la
vente, pas un fait du lot —, et la fiche dit contre quoi. Le panneau « Affiner » filtre sur
`?echange=1`, avec sa pastille retirable. En base, une note sans échange ouvert est
refusée (`listings_trade_note_needs_trade`), et le mapper ne l'envoie pas. Quand l'accord
se conclut, le vendeur clôture la vente comme un « Échange ».

## Réserver, vendre, noter

Le statut reste un clic — c'est la promesse du produit —, mais deux étapes demandent
désormais **pour qui** : parmi ceux qui ont écrit à propos du lot, jamais un pseudo tapé ni
un identifiant fourni par le navigateur (`reserve_listing()`, `close_deal()` déduisent tout
de la conversation). « Quelqu'un d'autre, hors BulkTCG » reste possible et ne désigne
personne.

### Réservé : la personne choisie continue, les autres attendent

Un lot réservé **ne reçoit plus de nouvelle conversation**, et dans les fils existants
**seuls le vendeur et la personne pour qui il est réservé écrivent encore**. Les autres
relisent leur fil ; à la place du champ de réponse, « Ce lot est réservé pour un autre
acheteur » et **« Me prévenir s'il redevient disponible »**. Le vendeur n'est pas relancé
par ceux qui arrivent trop tard — c'était le but.

S'il repasse en « Disponible », **tous les inscrits sont prévenus en même temps** : pas de
file où le premier aurait vingt-quatre heures d'avance, le lot n'est jamais gelé. La liste
se vide dès que le lot quitte « Réservé ». **Le vendeur ne voit que le nombre d'inscrits**
(« 2 personnes attendent si la réservation tombe »), jamais leurs noms : il n'a personne à
relancer, et personne ne le relance. En base, la politique d'écriture des messages refuse
les autres, l'ouverture d'une conversation exige un lot disponible, et `waitlist_count()`
ne rend un nombre qu'au vendeur.

### Vendu : le vendeur clôture, puis chacun note l'autre

La validation à deux — l'un déclare, l'autre confirme — a été essayée puis retirée : un
panneau de plus dans chaque conversation, pour un accord que le vendeur est seul à pouvoir
constater. **C'est son lot : il clôture la vente** en désignant l'acheteur, et précise s'il
s'agit d'une vente ou d'un échange. Le lot passe en « Vendu », l'acheteur est prévenu, et
**les deux parties peuvent se noter**, une fois chacune.

Une vente clôturée **ne se défait pas** : l'annonce ne repasse pas « Disponible », ne se
supprime plus (`on delete restrict`, déclencheur `keep_closed_deal_sold`) **et ne se modifie
plus** — titre, description, prix, photos, séries, audience (`freeze_listing_after_deal`) —,
sinon un vendeur mal noté n'aurait qu'à supprimer son annonce pour effacer l'avis, ou à
réécrire « 900 cartes » en « environ 300 » pour lui donner tort. La page de modification le
dit et renvoie au récapitulatif de la vente ; le tableau de bord ne propose plus
« Modifier ». Un lot passé en « Vendu »
d'un clic peut recevoir son acheteur après coup (« Désigner l'acheteur »).

**Un avis porte sur trois critères, de 1 à 5 : ponctualité, délai de réponse, fiabilité.**
Une note unique ne disait pas ce qui s'était mal passé — un rendez-vous manqué et un lot
moins rempli qu'annoncé ne sont pas le même reproche. La fiabilité suit le rôle : pour un
vendeur, un lot conforme à l'annonce ; pour un acheteur, le prix convenu tenu sans
renégocier sur place. La note d'un avis et celle d'un profil sont la moyenne des trois,
calculée par `refresh_rating()` ; le profil public affiche **le détail critère par critère
et la façon dont il est calculé**. `tests/account-data.test.mjs` vérifie que la note stockée
d'un profil reste atteignable avec les avis affichés sous elle — il a trouvé un profil noté
5,0 sur deux avis, au-dessus d'un avis à 4,0.

Chaque vente a son **récapitulatif** (`/mon-compte/transactions/[id]`), lu par ses deux
parties seulement — 404 pour les autres : le lot, qui l'a vendu à qui, les étapes datées de
la mise en ligne aux deux avis — une étape à venir s'écrit « À venir », sans date inventée —,
et c'est là qu'on note l'autre. Dans la conversation, une seule ligne rappelle la vente et
mène à l'avis.

### Notifications

La cloche de l'en-tête compte les non lues ; `/notifications` les liste, chacune menant à
ce dont elle parle. Cinq sortes, et chacune a sa source en base : un lot attendu **de
nouveau disponible** (déclencheur sur le statut), une **vente clôturée** pour l'acheteur
(`close_deal()`), un **avis reçu** (déclencheur sur les avis), un **lot pour votre
recherche** — posé au dépôt avec la clé de service, à partir du même croisement que celui
qu'on montre au vendeur ; un lot réservé aux pros ne se signale qu'aux pros —, et une
**annonce bientôt expirée**, une semaine avant l'échéance, par la tâche quotidienne. Elle
ne donne pas de date : la prolongation la rendrait fausse. Aucune
notification ne s'écrit depuis le navigateur, et seul `read_at` se modifie.

## Messagerie

Deux volets en grand écran — les conversations à gauche, le fil à droite —, un seul sur
téléphone. Le titre « Messages » garde la même taille, liste seule ou fil ouvert (`npm run
smoke` la mesure : il sautait de 46 à 22 px).

**Supprimer** une conversation ne la retire que de sa propre boîte : l'autre partie garde
son fil, et un message plus récent la fait revenir. **Bloquer** empêche d'écrire dans les
deux sens, dans le fil existant comme dans un nouveau — la base le tient
(`is_blocked_between`). **Signaler** une annonce, un compte, une demande ou une
conversation passe par `/signaler` : un motif dans une liste fermée, un détail facultatif,
et la cible résolue côté serveur — on ne signale ni ce qu'on ne peut pas lire (une annonce
réservée aux pros pour un particulier), ni soi-même. Un signalement n'est lisible que par
la modération.

## Emplacements publicitaires

Le brief excluait la publicité display ; ces emplacements ont été ajoutés après coup pour
juger du rendu. Quatre placements : leaderboard 728×90 au milieu de l'accueil et sous la
fiche d'annonce, pavé 300×250 en fin de liste à côté de l'encart maison, bannière 468×60
après la deuxième rangée de la grille. Le pavé et l'encart vivaient sous le panneau de
filtres, dans sa colonne : en défilant, le panneau épinglé passait par-dessus eux — on
voyait les filtres recouvrir l'offre « À la une ». `npm run smoke` mesure désormais, à
plusieurs hauteurs de défilement, qu'aucun encart ne croise le panneau. Un encart maison, aux couleurs du site, fait la promotion de la mise
en avant payante.

Le pavé de la fiche d'annonce vivait dans la colonne épinglée, sous le bouton de contact.
Il y ajoutait 272 px : la colonne montait à 900 px pour une fiche de 1 500, ne collait
plus que sur 600 px et repassait sous l'en-tête au milieu de la description. Il est
descendu sous la fiche, en leaderboard, et `npm run smoke` vérifie que la colonne tient
jusqu'à la fin de la description sans défiler à l'intérieur d'elle-même.

Quatre règles s'appliquent, et chacune est vérifiée :

* **Rien qui imite une annonce.** Un emplacement est un `<aside>`, jamais un `<article>` :
  un encart natif déguisé en vignette tromperait l'acheteur.
* **La mention « Publicité » est toujours visible**, jamais au survol.
* **La boîte est réservée par son ratio**, pas par une hauteur fixe — le repli mobile d'un
  leaderboard est plus haut que le format desktop, une `min-height` unique aurait
  surdimensionné la case en grand écran. Le décalage cumulé mesuré est nul.
* **Chaque emplacement fait sa taille nominale.** La colonne de filtres est passée de 280 à
  300 px pour cette raison : un pavé écrasé à 280×233 ne peut recevoir aucune création au
  format IAB.

La bannière de la grille est **placée sur la troisième rangée**, pas après la sixième
vignette : ce calcul, fait pour trois colonnes, laissait la deuxième rangée amputée de deux
annonces quand la grille en a quatre. `npm run smoke` compte les vignettes posées au-dessus
d'elle à quatre largeurs : toujours deux rangées pleines.

Aucune publicité sur `/deposer`, `/messages`, `/connexion` ni `/securite` : le tunnel de
dépôt, la messagerie privée et le contenu de confiance en sont exclus.

**Le coût mesuré, et la décision :** un leaderboard en tête de liste repoussait la première
vignette de 130 px, et surtout il coupait la page entre la recherche et ses résultats — au
moment précis où l'on cherche. Il a été retiré en septembre 2026. Sur un site d'annonces,
ce sont les annonces qui font revenir. Rien n'est inventé ici : les gabarits affichent
leur format, aucune marque n'est simulée.

## Photos : format et métadonnées

Avant tout envoi, chaque photo est **recadrée au format du visuel** (4:3, celui de la galerie
et de la fenêtre de la vignette), **réduite à 1 600 px de large** au plus et **ré-encodée en
WebP** dans le navigateur — en JPEG si le navigateur ne sait pas encoder le WebP. Le fichier
pèse une fraction de l'original, l'aperçu montre exactement ce que verront les acheteurs, et
le ré-encodage **retire les métadonnées de l'appareil, position GPS comprise** : sans lui,
la photo d'un lot pris dans le salon aurait dit où habite le vendeur. Une photo que le
navigateur ne sait pas lire (un HEIC ailleurs que sous Safari) est écartée avec sa raison,
jamais envoyée telle quelle. Le calcul du format vit dans `lib/photo-format.ts`, testé sans
navigateur ; `npm run smoke` vérifie ce qui part réellement.

En phase 2, les photos vivent chez Cloudflare Images, qui ne sert jamais le fichier reçu :
seulement des variantes qu'il ré-encode lui-même, réglées pour ne garder aucune métadonnée.
Un original envoyé en contournant le formulaire n'est donc jamais servi tel quel. Ces
variantes sont cinq, nommées, de 160 à 1 600 px de large, et aucune n'est flexible : une
variante flexible laisserait chacun choisir ses réglages, conservation des métadonnées
comprise. Les fichiers qu'aucune photo n'affiche plus partent au ménage quotidien — sept
jours après un dépôt jamais publié, le temps qu'un paiement de l'option « 8 photos »
aboutisse, un jour après une photo retirée —, par lots, un seul passage à la fois et deux
retraits par seconde pour laisser aux dépôts des vendeurs le reste de ce que l'API de
Cloudflare accepte, chaque appel dans son délai ; et il dit quand il prend du retard. Les
durées vivent dans `src/lib/photo-hosting.ts`, et `supabase/README.md` (§ 6) en donne les
raisons.

## Filigrane des photos

Chaque photo affichée porte, sur sa ligne de crédit au bas de l'image, le pseudo du
vendeur — et sur la photo en grand, la référence de l'annonce en plus
(`CP-7F3A · @lecomptoirdukado`). Une photo dont le
filigrane ne correspond pas au vendeur affiché est une photo reprise ailleurs, et cela se
voit sans rien avoir à vérifier. La page `/securite` l'explique aux acheteurs.

**Ce que ça ne fait pas :** protéger le fichier. Un recadrage suffit à couper le coin, et
rien n'empêche de récupérer l'original. Le filigrane est un signal de lecture, pas une
protection technique.

**Décidé en octobre 2026 : la ligne de crédit reste le filigrane.** L'incruster dans
l'image elle-même — la version qui survivrait au clic droit — ne sera reconsidéré que si
la reprise de photos devient un problème constaté. Les variantes de Cloudflare Images
n'incrustent rien, et les deux voies qui restaient ont été écartées : un Worker devant la
livraison changerait le gabarit des adresses de photos, la signature des photos privées et
la CSP ; l'incrustation dans le navigateur, avant l'envoi, ne porterait que le pseudo — la
référence d'une annonce qui n'existe pas encore est inconnue — et un envoi fait
directement à l'API la contournerait (`supabase/README.md`, § 6).

La ligne de crédit est en `aria-hidden` : sur la vignette, une phrase réservée aux
lecteurs d'écran dit le vendeur, son statut pro et sa note en toutes lettres ; sur la fiche,
vendeur et référence sont lus plus haut. Sans photo, la ligne garde le pseudo, mais pas la
classe du filigrane : il marque une photo contre la reprise, posé sur un emplacement vide il
ne protégerait rien — et `npm run smoke` le vérifie.

## Chercher autour de soi

Le champ « Où » ne filtre pas sur la commune : une ville reconnue devient un **point
d'origine**, et la liste montre ce qui se vend dans un rayon de 50 km par défaut, ajustable
de 10 à 100 km. Chercher « Avignon » et n'obtenir que les annonces intra-muros viderait de
son sens la promesse « à moins d'une heure de chez vous ».

La distance apparaît sur chaque vignette **uniquement** quand une origine existe. Sans
ville saisie, il n'y a pas de distance et on n'en invente pas : le tri « les plus proches »
et le filtre de rayon disparaissent, remplacés par la phrase qui explique comment les
obtenir. Un `?tri=distance` partagé sans ville retombe sur le tri par défaut plutôt que de
rendre un ordre arbitraire.

### Toutes les communes de France

Le référentiel couvre **les 34 879 communes** de métropole, de Corse et des départements
d'outre-mer — celles que la base accepte —, tirées du Découpage administratif
(geo.api.gouv.fr, Licence Ouverte Etalab 2.0) et rangées dans le dépôt
(`src/lib/communes/communes.json`, 2,5 Mo) : aucun appel à un service extérieur pendant la
frappe, et la CSP reste stricte. `node scripts/communes-update.mjs` le met à jour une fois
par an, quand les fusions de communes prennent effet.

* **Côté serveur seulement.** `lib/cities.ts` est `server-only` : le champ commune demande
  ses suggestions à `/communes/suggestions`, qui rend six communes et celle que la saisie
  désigne sans ambiguïté. Sans JavaScript, le champ part tel quel et l'action retrouve la
  commune — un nom unique, un code postal d'une seule commune ou « Nom (code) » suffisent.
  Le schéma partagé ne vérifie que la forme ; l'existence se vérifie dans l'action
  (`schemas/commune.ts`), et le référentiel n'entre jamais dans le navigateur.
* **Un couple, pas un nom.** Une annonce, une demande ou un profil enregistre un nom et un
  code postal, que la clé étrangère de la base vérifie : trois communes s'appellent Valence,
  douze Sainte-Colombe, mais aucun couple n'en désigne deux. À la saisie, un homonyme
  demande de choisir, et le message nomme les communes possibles avec leur département.
* **Les homonymes dans « Où ».** Un nom porté par plusieurs communes cherche autour de celle
  qui a la page au nom nu — Valence (Drôme), Saint-Denis (Seine-Saint-Denis) —, sinon de la
  plus peuplée, et la page propose les autres, chacune en « Nom (code) ». Un code postal
  partagé — 51300 en sert quarante-six — cherche autour de sa commune la plus peuplée.
* **Un lien de page ne change jamais.** Chaque commune garde son slug d'une mise à jour à
  l'autre, même renommée : son nom s'il est unique en France, sinon son nom et son
  département (`valence-82`), sinon son code INSEE. Les 112 communes d'origine gardent le
  leur, et leurs coordonnées et code postal de la migration 2 ; les autres sont situées à
  leur mairie — le centre géométrique d'Arles tombe en Camargue.
* **Une commune qui disparaît reste.** Fusionnée, elle est marquée retirée : les annonces
  qui la citent s'affichent encore, mais on ne la propose plus, on ne l'accepte plus à la
  saisie, et son slug n'est jamais redonné.

### La carte du secteur

Le lieu d'une fiche — « Avignon (84000) » — ouvre la carte de son secteur : la commune au
centre, **une zone de 5 km autour d'elle aux couleurs du jeu, jamais l'adresse** (elle se
convient dans la conversation), les anneaux de 10, 25 et 50 km, et huit communes voisines,
dont la liste suit la carte. Un lien mène à OpenStreetMap pour le détail.

**Les voisines sont choisies, pas seulement les plus proches.** Le dernier anneau compte des
centaines de communes autour d'une banlieue, et les plus proches d'un village sont des
hameaux dont personne ne connaît le nom : la carte retient d'abord celles qui ont des
annonces, puis les plus peuplées, et les pose de la plus proche à la plus lointaine. Autour
d'Avignon, ce sont Nîmes, Arles, Orange ou Carpentras, et non trois lieux-dits du Vaucluse.

**Aucune bibliothèque de cartes ni aucune tuile** : un dessin calculé par le serveur
(`lib/sector-map.ts`, projection locale en kilomètres) et posé dans un popover natif — le
navigateur l'ouvre, le ferme à Échap ou d'un clic dehors —, sans une ligne de JavaScript ni
une requête vers un tiers. Les noms sont du HTML posé sur le dessin, pour garder l'échelle
typographique du site ; leur placement évite les autres noms et les points des communes,
et `tests/sector-map.test.mjs` le vérifie, chacune au centre à son tour, sur les 112 communes
d'origine, onze banlieues denses — la petite couronne, la métropole lilloise — et soixante
communes tirées au sort, toujours les mêmes — c'est ainsi qu'Aubervilliers et Paris, trop
denses pour tout nommer, ont imposé la règle : le nom du centre d'abord. Sur téléphone, seuls les points des voisines restent, et
`npm run smoke` mesure qu'aucun nom ne sort du cadre ni n'en chevauche un autre.

## SEO programmatique

`/[game]/[city]` couvre 8 jeux × 34 879 communes, « Autre » compris : environ
279 000 adresses, toutes rendues à la demande — aucune n'est prérendue, le build n'en
tenterait pas une —, et une adresse hors du référentiel répond 404. Chaque page a son
`<title>`, sa meta description, son `<h1>` et un texte composé à partir des données réelles
(nombre de lots, fourchette de prix, formats représentés, communes voisines). Les 112
adresses d'avant le référentiel complet n'ont pas bougé ; un homonyme prend son département
dans l'adresse (`/magic/valence-82`) et dans son titre (« à Valence (Tarn-et-Garonne) »).

**Seule une page qui a des lots dans la commune même est indexée et entre dans le
`sitemap.xml`** ; les autres sont servies normalement, en `noindex, follow` — les publier
serait du contenu-passerelle. Elles redeviennent indexables d'elles-mêmes dès qu'un lot y est
déposé, la page étant rendue à chaque visite (le nonce de la CSP, voir « Sécurité »). Une
commune retirée par une mise à jour du référentiel garde sa page, lisible pour les annonces
qui la citent encore, mais hors de l'index et du plan de site : on n'amène personne vers une
commune qui n'existe plus sous ce nom.

Les lots d'une page, ses liens et le plan de site retrouvent chaque commune par le couple
(commune, code postal) de l'annonce, jamais par son nom : trois communes s'appellent
Valence. Une page de jeu relie au plus 24 communes peuplées, la plus fournie d'abord ; une
page de ville, six voisines — celles qui ont des lots, puis les plus peuplées à moins de
30 km. Aucune ne déroule mille liens.

Le référentiel des communes est décrit plus haut, « Toutes les communes de France ».

### robots.txt : les moteurs oui, l'entraînement non

`src/app/robots.ts` distingue trois familles, et `tests/robots.test.mjs` les lit comme un
robot les lit (RFC 9309 : le groupe à son nom, puis la règle la plus longue).

* **Les robots d'entraînement des IA** — GPTBot, ClaudeBot, CCBot, Meta-ExternalAgent,
  Bytespider… — n'ont droit qu'à la page d'accueil (`Allow: /$`, `Disallow: /`). Ils lisent
  le site sans renvoyer personne.
* **Les moteurs de recherche, ceux des assistants compris** (Googlebot, OAI-SearchBot,
  Claude-SearchBot, PerplexityBot…) lisent tout ce qui est public : être cité par une
  réponse d'IA commence par être lisible. Seules les combinaisons de filtres des listes
  leur sont fermées — des milliers d'URL en noindex, rendues à chaque visite —, la
  pagination restant ouverte.
* **Les robots d'aperçu** (Facebook, WhatsApp, Twitter, LinkedIn, Slack, Discord,
  Telegram) ont leur propre groupe : une recherche filtrée collée dans un groupe Facebook
  garde son aperçu.

Jamais de règle sur `/*?` : l'optimiseur d'images, les icônes et les images de partage
portent un paramètre, et l'aperçu d'une annonce en dépend. Et robots.txt est une demande,
pas une barrière : contre un robot qui abuse, ce sont la limitation de débit et le
pare-feu de l'hébergeur qui protègent.

## Partage et référencement

Un lien collé dans un groupe Facebook ou une conversation WhatsApp est la vitrine réelle du
produit ; les moteurs de recherche et de réponse lisent la même page autrement. L'audit de
septembre 2026 trouvait Lighthouse SEO à 100 sur les neuf gabarits — et, derrière, des
aperçus pauvres, des dates fausses et aucune donnée structurée.

* **L'adresse publique** (`lib/site.ts`) : `NEXT_PUBLIC_SITE_URL`, sinon le domaine de
  production Vercel. Un déploiement — Vercel, ou une CI — qui n'a ni l'une ni l'autre
  **échoue au build** : il écrivait `http://localhost:3000` dans chaque image de partage,
  chaque canonique et tout le plan de site. En local, `npm run build`, `verify` et le smoke
  tournent sans rien régler.
* **Chaque page qu'on partage a son image** — annonce, demande de recherche, profil, jeu,
  ville —, rendue en JPEG : une centaine de kilo-octets au lieu de 1,1 Mo en PNG, que
  WhatsApp et Messenger ignoraient. Elle dit ce que la page contient, comme la vignette : le
  tampon « Vendu », « Réservé » ou « Trouvé », le filigrane du vendeur, le badge PRO,
  « Sans budget annoncé », « Aucun lot pour l'instant » — jamais un chiffre inventé.
* **Son adresse porte une version** (`generateImageMetadata`), calculée sur ce que l'image
  dessine et sur rien d'autre : Facebook et WhatsApp gardent une image tant que son adresse
  ne change pas, et montraient l'ancien prix après une baisse, ou un lot disponible après
  sa vente. Une ancienne version répond 404.
* **Satori, le moteur de ces images, ne lit ni le WebP ni l'espace fine insécable** :
  chaque photo repasse par sharp en JPEG, avec un délai et un repli sans photo, et
  `forSatori` remplace l'espace fine — « 1 500 cartes » s'écrivait « 1500 ».
* **Les métadonnées** (`lib/metadata.ts`) : Next remplace l'Open Graph du gabarit par celui
  de la page, et `og:site_name` disparaissait des fiches — une base commune s'étale
  partout. La description d'une fiche commence par les faits et se coupe entre deux mots ;
  un lot vendu s'annonce « Vendu — » en tête. Chaque page a une canonique et un `og:url`.
* **L'index** : une annonce vendue reste indexée trente jours (`unavailable_after`) — le
  temps que les moteurs voient qu'elle l'est —, puis en sort, du plan de site aussi ; sa
  page reste servie. La page N d'une liste a sa propre canonique, hors index. Un profil sans
  rien de public — ni annonce, ni avis, ni boutique — reste hors index.
* **Les données structurées** (`lib/structured-data.ts`) : le lot et son offre sur une fiche
  (disponibilité, état, retrait sur place, commune, vendeur), le fil d'Ariane, le site et
  son éditeur sur l'accueil, la boutique d'un pro au forfait actif. Aucune note agrégée —
  celle d'un vendeur n'est pas celle du lot —, aucune coordonnée, et un titre de vendeur ne
  peut pas fermer la balise qui les porte.
* **Le plan de site** : des dates réelles — l'heure du build, la même pour chaque adresse,
  ne disait rien —, les photos de chaque annonce, les seules annonces indexables, et les
  seuls profils qui ont une annonce en ligne : il publiait le pseudo de chaque compte.
* **Le favicon** existe en 32 et en 192 px : Google n'affiche dans ses résultats qu'une
  icône dont le côté est un multiple de 48 px.

`tests/seo.test.mjs`, `tests/og.test.mjs`, `tests/structured-data.test.mjs` et
`scripts/smoke/seo.mjs` tiennent ces règles ; chacune a été falsifiée — la retirer fait
échouer son test.

## Les comptes

Connexion, inscription, « Mot de passe oublié » et « Nouveau mot de passe » passent par
Supabase Auth, côté serveur (`lib/data/auth-mutations.ts`), avec le même schéma Zod dans le
navigateur et dans l'action serveur. L'action est posée sur l'attribut `action` : **sans
JavaScript, le formulaire part en POST, jamais en GET** — qui mettrait le mot de passe dans
l'adresse et les journaux. Les champs portent leurs garde-fous : autocomplétion juste
(`username` et `current-password` à la connexion, `new-password` ailleurs, `nickname` pour
le pseudo, qui n'est pas l'identifiant), ni majuscule ni correction automatiques, longueurs
bornées comme dans le schéma, un bouton pour afficher le mot de passe au lieu d'un champ de
confirmation, et jamais `autocomplete="off"`. **Un mot de passe de 12 caractères au
moins**, sans règle de composition (NIST SP 800-63B), qui ne reprend ni l'adresse ni le
pseudo ; il n'est jamais renvoyé à la page, et ne se change que depuis un lien reçu par
e-mail. Inscription et « Mot de passe oublié » **répondent la même chose que l'adresse ait
un compte ou non**, et mènent à une page « Vérifiez vos e-mails » qui le dit sans le
trahir. Le lien reçu passe par `/connexion/confirmation`, et le retour ne mène qu'à un
chemin du site. `tests/auth.test.mjs` tient ces règles, et `npm run smoke` les parcours.
Google reste désactivé, et le dit. Le logo Google est tracé en SVG dans la page : le servir
depuis un CDN serait un mouchard posé sur un écran de connexion, et `lib/brand-colors.ts`
est la seconde exception documentée à la règle des couleurs en dur. L'inscription dit **ce
qui deviendra public** avant de le devenir : le pseudo finit dans le filigrane des photos.

La démonstration se charge dans le projet Supabase de `.env` (`npm run supabase:seed`) :
quinze comptes `<pseudo>@bulktcg.example`, confirmés d'office, avec un mot de passe commun
écrit dans `.env` (`DEMO_ACCOUNTS_PASSWORD`), et leurs annonces, demandes, conversations et
ventes, sans photos. `-- --delete` les retire (voir `supabase/README.md`, § 10).

## Ce qui n'existe pas encore, et pourquoi

* **Aucune photo envoyée (phase 3).** Avec la base, la section Photos du dépôt annonce
  qu'elles arrivent, le serveur et `create_listing` les refusent, et les annonces
  s'affichent « Sans photo ». En démonstration, les annonces gardent leurs photographies
  Unsplash (voir plus bas), pas des lots réellement mis en vente ; sous chaque image, le bloc
  abstrait reste visible pendant le chargement et sert de rendu complet quand une annonce
  n'a pas de photo.
* **Pas encore d'ouverture au public.** Trois choses manquent avant d'ouvrir les
  inscriptions : un SMTP à soi — le service intégré de Supabase n'envoie que deux e-mails
  par heure, aux seuls membres de l'équipe du projet, et une inscription refusée faute
  d'envoi ne crée pas le compte —, une limitation de débit (`checkRateLimit`, audit M7 :
  Supabase Auth compte l'adresse du serveur, pas celle du visiteur), et les photos, sans
  lesquelles la production refuse de démarrer.
* **Aucun paiement.** Le forfait pro s'affiche avec son prix, le bouton de souscription est
  désactivé et l'écran dit pourquoi ; la mise à la une annonce son prix sans le facturer.
* **Aucune notification par e-mail ni en push.** La cloche et `/notifications` lisent la
  base, et rien d'autre ne prévient.
* **Pas encore de compteur de vues** (`record_listing_view` attend sa route, dédoublonnée
  par visiteur), ni d'écran pour débloquer quelqu'un.
* **Les mentions légales sont volontairement vides**, avec la liste de ce que la LCEN
  impose. Une mention légale vraisemblable mais fausse est plus dangereuse qu'une mention
  manquante.
