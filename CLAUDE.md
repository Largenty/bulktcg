@AGENTS.md
@README.md

# Conventions du projet

Interface en français, **code en anglais** sans exception (variables, types, fichiers,
dossiers, branches, commits). Les seules exceptions d'abréviation admises : `id`, `url`,
`href`, `src`, `props`, `ref`.

## Règles non négociables

1. **`lib/data/` est la seule frontière avec la source de données.** Aucun composant
   n'importe depuis `lib/mock/`, et dans `lib/data/` même, seul `source.ts` sait d'où
   viennent les lignes : c'est là que la base se branche, avec `unwrap()` qui fait lever
   une lecture en panne au lieu de la rendre « introuvable ». `tests/conventions.test.mjs`
   le tient. Les fonctions y sont `async` même quand elles n'ont pas
   besoin de l'être. Les mocks produisent des lignes `snake_case` et le filtrage raisonne
   sur ces lignes : `mappers.ts` ne convertit qu'au tout dernier moment, et il est donc
   exercé en permanence plutôt que le jour de la bascule.
2. **Aucune valeur hexadécimale dans un composant.** Tout passe par les tokens de
   `styles/tokens.css`, y compris la couleur du texte posé sur une couleur de jeu
   (`--<jeu>-ink`). Seules exceptions documentées : `lib/og-colors.ts`, parce que Satori
   ne lit pas les variables CSS, et `lib/brand-colors.ts`, parce que les couleurs d'une
   marque tierce ne doivent surtout pas suivre notre palette.
   Un texte posé sur un aplat prend **l'encre de l'aplat**, pas celle de la page :
   `--on-ink` sur `--ink`, `--on-chalk` sur `--chalk`. La craie sur l'encre tenait 16:1 en
   clair et tombait à 1,00:1 en sombre, où l'encre devient claire. Une couleur de thème
   s'écrit avec ses deux branches, `var(--when-light, …) var(--when-dark, …)` ; une
   couleur d'impression (jeu, holographique, filigrane) n'en a qu'une.
   `tests/theme-roles.test.mjs` et l'audit de contraste, joué dans les deux thèmes, le
   tiennent.
3. **Ni taille de texte, ni épaisseur de trait en dur dans un composant.** Une taille
   de texte choisit un pas de l'échelle (`--text-micro` … `--text-h1`, ou `--number-*`
   pour les prix et compteurs), et un filet vaut `--border-width`. La règle disait déjà
   cela et ne tenait pas : 162 tailles littérales sur quinze valeurs distinctes
   cohabitaient avec une échelle de cinq tokens qui ne servait qu'aux balises de
   `base.css`. La forme est `text-[length:var(--text-md)]` — le préfixe `length:` est
   obligatoire, sans lui Tailwind lit `var()` comme une couleur et ne produit aucun
   `font-size`. `tests/typography.test.mjs` échoue si un littéral réapparaît, si un
   composant vise un token inexistant, ou si deux pas d'une même famille finissent à
   la même valeur.
   Les dimensions de gabarit — `max-w-[820px]`, la vignette à `w-[64px]`, le filet de
   couleur à `w-[6px]` — restent littérales : ce sont des décisions locales de mise en
   page, pas des pas partagés, et les tokeniser ne ferait que déplacer le nombre.
4. **Une information absente s'affiche `—`, jamais `0`.** Voir README, section « Règle de
   données ». Corollaire pour le croisement lot/recherche : un critère invérifiable donne
   une correspondance « à vérifier », jamais une correspondance certaine ni un rejet.
5. **Pas d'état dérivé.** Ce qui se calcule à partir des props se calcule au rendu.
   `useEffect` ne sert qu'à la synchronisation avec l'extérieur, avec nettoyage.
6. **Les filtres vivent dans l'URL** (`useListingFilters`), en `push` et non en `replace` :
   le retour arrière doit défaire le dernier filtre.
7. **150 lignes maximum par composant.** Un composant fait une chose. Un fichier de page
   est un composant comme les autres : quand il grossit, une section veut son propre
   composant. `tests/component-size.test.mjs` le tient — la règle était écrite et six pages
   la dépassaient.
8. **Server Components par défaut.** `"use client"` le plus bas possible dans l'arbre.
   Un composant client ne lit ni l'heure ni le hasard pendant le rendu : il est rendu deux
   fois, au build puis à l'hydratation, et le texte divergeait (React #418 sur « Mes
   annonces »). Ce qui dépend de l'heure arrive en prop (`now`) ou se calcule côté serveur.
   `tests/render-purity.test.mjs` le tient.
9. **La liste des jeux vit dans `src/types/game.ts` (`GAME_IDS`), et nulle part ailleurs.**
   Recopiée dans onze fichiers, elle a laissé Riftbound absent sans que rien ne le
   signale. Un jeu ajouté là arrive avec son libellé, sa couleur, son encre, sa version P3,
   ses séries et sa place dans l'enum SQL — `tests/games.test.mjs` refuse toute recopie et
   mesure la distance perceptuelle des couleurs, daltonisme compris.
10. **Une annonce réservée aux pros ne sort jamais du cercle.** Les lectures publiques de
    `lib/data/listings.ts` partent de `PUBLIC_ROWS` ; une fiche passe par
    `getListingForViewer`, le tableau de bord par `getListingsOwnedBy`. En base, la RLS et
    les droits de colonnes tranchent (`tests/schema-sync.test.mjs`), et
    `tests/listings-data.test.mjs` échoue si une lecture publique en rend une.
11. **Les textes portent les espaces insécables du français** — devant « : ? ! ; » et dans
    les guillemets. `node scripts/french-spacing.mjs --write` les pose, sans toucher au code
    ni aux données de démonstration ; `tests/french-typography.test.mjs` échoue si l'une
    manque.
12. **Une photo de démonstration n'entre qu'après avoir été regardée**, et ne sert qu'un
    jeu. Les descriptions d'Unsplash sont fausses ; une photo qui montre un autre jeu est
    pire que pas de photo. `tests/listings-data.test.mjs` refuse une photo partagée entre
    deux jeux.
13. **Un texte prend la largeur de son parent.** Jamais de `max-w-…` sur un `p`, un
    `h1`…`h6`, un `li`, un `span` ou un lien — ni sur un `div` dont le seul rôle est de
    brider un titre ou un paragraphe. Quand une mesure doit être limitée, c'est la mise en
    page qui la limite : une colonne de grille, un gabarit de page. C'était l'erreur la plus
    fréquente — la manchette de l'accueil tenait dans 20 caractères.
    Une page prend toute la largeur du gabarit : aucun fichier de `app/` ne porte de
    `max-w-…`, et aucune mesure en caractères (`max-w-[68ch]`) n'apparaît nulle part — dix
    pages s'arrêtaient entre 760 et 1 200 px et laissaient jusqu'à la moitié d'un grand
    écran vide. `tests/text-width.test.mjs` les refuse, en classe comme en style en ligne
    (`maxWidth`, `maxInlineSize` : la page de secours de `global-error` tenait son texte à
    480 px) — hors images de partage, dessins de taille fixe que Satori compose ;
    `max-w-full` et `max-w-none` restent permis, et `npm run smoke` mesure le bord droit du
    contenu de chaque page.
14. **Les adresses du site vivent dans `src/lib/routes.ts`, et nulle part ailleurs.** Un
    lien, une redirection, une revalidation, le plan du site et robots.txt y prennent leur
    chemin ; les paramètres d'un domaine — filtres, étapes du compte, vues des ventes,
    signalement — se posent dans le module de ce domaine, sur ces chemins. Deux cent
    soixante-dix adresses étaient écrites à la main dans quatre-vingt-dix fichiers.
    `tests/routes.test.mjs` refuse une adresse écrite à la main et vérifie que chacune mène
    à une page de `src/app` ; typedRoutes ne le ferait pas, `/[game]` et `/[game]/[city]`
    acceptant toute adresse d'un ou deux segments. Un chemin de retour (`?suivant=`) passe
    par `safeReturnPath` : il vient de l'URL, et une connexion qui renverrait ailleurs
    serait une redirection ouverte.
15. **Aucune API dépréciée, ni ce que Playwright déconseille.** Ce que React, Next, Zod,
    Node, TypeScript ou Playwright marquent `@deprecated` ne s'écrit plus : `npm run lint`
    est typé (`@typescript-eslint/no-deprecated`) sur `src/`, `tests/`, `scripts/` et le banc
    SQL de `supabase/tests/`, et une dépréciation inévitable se désactive à la ligne, la
    raison à côté. Trois angles morts sont tenus à part : la clé dépréciée d'un objet —
    `{ message }` dans un schéma Zod 4, `images.domains` —, que refuse
    `bulktcg/no-deprecated-keys` ; les props dépréciées de `next/image`, que ses types
    publiés ne marquent pas (`tests/image-priority.test.mjs`) ; et ce que Playwright
    déconseille sans le déprécier — méthodes de `page` à sélecteur, attentes fixes,
    `ElementHandle`, `networkidle` —, que refuse `bulktcg/playwright-locators`. Un
    `networkidle` ne reste que là où un parcours prouve une absence (aucun préchargement,
    aucune violation de CSP, rien dans la console), désactivé à la ligne. `tsconfig.json`
    impose `verbatimModuleSyntax` et `erasableSyntaxOnly` : les tests chargent le TypeScript
    par le retrait de types de Node, qui ne connaît ni `enum` ni import de type sans `type`.
    Et un import de types s'écrit `import type { A }`, jamais `import { type A }`, qui
    garderait `import "…"` et chargerait le module — serveur compris — dans le paquet client
    (`no-import-type-side-effects`). `tests/deprecations.test.mjs` vérifie que le lint voit
    réellement un appel, une clé et un geste déconseillés dans chaque dossier, que les deux
    options sont posées et que le compilateur refuse un `enum` comme un import sans `type`.
    Récent ne veut pas dire hors du socle : ce qui s'exécute dans le navigateur s'arrête à
    celui de Next (Chrome, Edge et Firefox 111, Safari 16.4) — `toSorted` ou `Map.groupBy`
    servent côté serveur. `tests/browser-support.test.mjs` lit ce socle dans Next et compile
    tout ce qu'atteint un composant client avec la bibliothèque ES2022 et le DOM : ce qui le
    dépasse y devient une erreur de type.

## Avant de livrer

`npm run verify` doit passer. L'audit de contraste est bloquant, en clair comme en sombre :
si une paire descend sous son seuil, on corrige le token, on ne supprime pas l'assertion.

Quand un bug est corrigé, le test qui l'aurait attrapé est ajouté. C'est comme ça qu'ont
été trouvés le `router.replace` qui cassait le retour arrière, le `?tri=distance` sans
ville qui rendait un ordre arbitraire, la recherche par ville qui se limitait à la
commune au lieu de son rayon, le compteur de non-lus qui comptait les messages qu'on
avait soi-même envoyés, le code postal accepté par le champ commune puis refusé par la
validation, la colonne épinglée d'une fiche qui repartait sous l'en-tête, le croisement
qui proposait à un compte sa propre demande, le classeur « Déposé récemment » qui
répétait les annonces à la une dans le désordre, la bannière insérée après la sixième
vignette qui amputait la deuxième rangée d'une grille à quatre colonnes, le titre
« Messages » qui changeait de taille en ouvrant un fil, un profil noté 5,0 sur deux
avis au-dessus d'un avis à 4,0, l'en-tête qui débordait à 1 024 px après l'ajout d'une
icône, et « Sans photo » coupé dans les miniatures.

Une règle que rien ne vérifie redevient fausse — c'est arrivé à celle des tailles en dur,
écrite en tête de `tokens.css` et démentie 162 fois. Une règle ajoutée ici s'accompagne
donc du test qui la tient.

Une lecture de `lib/data/` à clé scalaire est enveloppée dans `cache()` : `generateMetadata`
et la page demandent la même chose, et sans lui la phase 2 enverra deux requêtes là où une
suffit. Celles qui prennent un objet de requête ne le sont pas — leur argument change
d'identité à chaque appel et la mémoïsation ne prendrait jamais.

Les défauts de placement sont invisibles dans le DOM : une troncature, un champ sorti de sa
carte, un filigrane posé sur une donnée. Ils se **mesurent** (`scrollWidth`, rectangles,
intersections), et `npm run smoke` le fait.

Les contrôles natifs qui cassent le design sont remplacés par des composants maison
(`Select`, `Checkbox`) : l'élément natif reste présent — il porte l'état, le clavier et la
soumission — mais il est masqué visuellement.
