# Mettre BulkTCG en ligne : le guide pas à pas

Tout ce qui reste à faire **de ton côté**, hors du code, dans l'ordre : les comptes à créer,
les réglages à poser, les valeurs à recopier, et pour chaque étape, comment vérifier qu'elle
a marché. État au 2 octobre 2026 ; les prix ont été relevés ce jour-là et se revérifient au
moment de payer. Le détail technique est dans [`supabase/README.md`](supabase/README.md).

Partout, `bulktcg.fr` est un exemple : remplace-le par le domaine que tu auras choisi.

Deux temps :

- **Maintenant, étapes 1 à 8** : rien n'y attend du code. À la fin, le site tourne chez
  Vercel sur ta base Supabase, visible de toi seul, et les e-mails de compte partent pour de
  vrai.
- **Plus tard, étapes 9 à 11** : Cloudflare quand je commence les photos, Stripe quand je
  code le paiement, puis l'ouverture au public. Ce qui me reste à coder est listé
  [à la fin](#ce-qui-me-reste-à-coder).

## Vue d'ensemble

| # | Étape | Quand | Temps | Coût |
|---|---|---|---|---|
| 1 | [Le code sur GitHub](#1-le-code-sur-github) | maintenant | 10 min | gratuit |
| 2 | [Les quatre migrations Supabase](#2-les-quatre-migrations-supabase) | maintenant | 15 min | — |
| 3 | [L'authentification Supabase](#3-lauthentification-supabase) | maintenant | 15 min | — |
| 4 | [Le nom de domaine](#4-le-nom-de-domaine) | maintenant | 15 min | une dizaine d'euros par an |
| 5 | [Les e-mails avec Brevo](#5-les-e-mails-avec-brevo) | maintenant | 45 min, plus l'attente du DNS | gratuit jusqu'à 300 e-mails par jour |
| 6 | [Vercel, en prévisualisation](#6-vercel-en-prévisualisation) | maintenant | 45 min | gratuit |
| 7 | [La clé Insee](#7-la-clé-insee) | maintenant | 15 min | gratuit |
| 8 | [Le juridique et l'administratif](#8-le-juridique-et-ladministratif) | à lancer maintenant | plusieurs semaines | juriste, comptable |
| 9 | [Cloudflare Images](#9-cloudflare-images) | quand je commence les photos | 30 min | 5 $ par mois |
| 10 | [Stripe](#10-stripe) | quand je code le paiement | 30 min, plus sa validation | une commission par paiement |
| 11 | [L'ouverture](#11-louverture) | quand tout est prêt | 1 h, plus l'attente du DNS | Vercel Pro 20 $ et Supabase Pro 25 $ par mois |
| 12 | [Ensuite, l'entretien](#12-ensuite-lentretien) | une fois en ligne | — | — |

Une fois ouvert, le site coûte environ **50 $ par mois** (Vercel Pro, Supabase Pro,
Cloudflare Images), plus le domaine et la commission de Stripe sur chaque paiement.

## Où ranger les secrets

Tu vas récolter une dizaine de valeurs secrètes. Trois règles :

- **Un gestionnaire de mots de passe** (Bitwarden, 1Password, ou celui de ton navigateur),
  une fiche par service. Range chaque secret à l'instant où il s'affiche : plusieurs ne se
  montrent qu'une fois.
- **Jamais dans un fichier versionné, ni dans un message** — à moi non plus. Pose la valeur
  dans `.env` et dis-moi qu'elle y est : je la lis de là. `.env` est ignoré par Git (motif
  `.env*` du `.gitignore`).
- **Un nom qui commence par `NEXT_PUBLIC_` est lisible par tout visiteur** : jamais de
  secret derrière ce préfixe.

| Valeur | D'où elle vient | Où elle va |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | déjà dans ton `.env` | Vercel (étape 6) |
| l'identifiant et la clé SMTP de Brevo | Brevo (étape 5) | Supabase, et nulle part ailleurs |
| `CRON_SECRET` | tiré au hasard (étape 6) | Vercel |
| `INSEE_SIRENE_API_KEY` | le portail de l'Insee (étape 7) | `.env` et Vercel |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_IMAGES_API_TOKEN`, `CLOUDFLARE_IMAGES_SIGNING_KEY`, `NEXT_PUBLIC_PHOTOS_URL` | Cloudflare (étape 9) | `.env`, puis Vercel quand je te le dis |
| `DEMO_ACCOUNTS_PASSWORD` | déjà dans ton `.env` | nulle part ailleurs |
| `DEMO_USER_ID` | — | **jamais sur Vercel** : en production, ou avec Supabase, le serveur refuse de démarrer |

## 1. Le code sur GitHub

Vercel déploie depuis un dépôt Git hébergé. Le tien n'en a pas encore, et le travail des
derniers jours n'est pas commité.

- [ ] **Commiter** : dis-moi « commite » et je m'en charge sur `refonte-design`, ou fais-le
      toi-même.
- [ ] **Créer le dépôt** : [github.com/new](https://github.com/new) → nom `bulktcg` →
      **Private** → ne coche ni README, ni `.gitignore`, ni licence → **Create repository**.
- [ ] **Connecter le terminal à GitHub**, une fois pour toutes. GitHub refuse le mot de passe
      du compte pour pousser ; le plus simple est GitHub CLI :

  ```bash
  sudo apt install gh    # ou les instructions de cli.github.com
  gh auth login          # GitHub.com → HTTPS → Yes pour Git → Login with a web browser
  ```

- [ ] **Pousser les deux branches** (remplace `<ton-compte>`) :

  ```bash
  git remote add origin https://github.com/<ton-compte>/bulktcg.git
  git push -u origin main
  git push -u origin refonte-design
  ```

**Vérifier** : la page du dépôt montre les fichiers, et **aucun `.env`** à la racine. S'il y
en avait un, arrête-toi et préviens-moi : toutes les clés qu'il contient seraient à changer.

## 2. Les quatre migrations Supabase

Le cycle de vie des annonces (expiration, remontée, archivage), le statut professionnel et
le respect des blocages à la réservation ont ajouté quatre migrations, pas encore
appliquées à ton projet. **Une exécution par fichier, dans cet ordre** : la première ajoute
une valeur d'énumération, que PostgreSQL refuse d'employer dans la transaction qui l'a
créée — et l'éditeur SQL joue tout un collage en une seule transaction.

Tant que les trois premières manquent, le site branché sur ta base affiche l'écran d'erreur, et le journal
du serveur nomme les colonnes absentes (« Colonnes absentes en base … ») : c'est voulu.
Avant, une colonne manquante vidait les listes sans rien dire.

- [ ] Ton projet sur [supabase.com/dashboard](https://supabase.com/dashboard) → **SQL
      Editor** → nouvelle requête.
- [ ] Colle tout `supabase/migrations/20261002120000_listing_expiring_kind.sql` → **Run** →
      « Success. No rows returned ».
- [ ] Nouvelle requête : tout `supabase/migrations/20261002120100_listing_lifecycle.sql` →
      **Run**.
- [ ] Nouvelle requête : tout `supabase/migrations/20261002120200_pro_status.sql` → **Run**.
- [ ] Nouvelle requête : tout `supabase/migrations/20261004120000_reserve_respects_blocks.sql` →
      **Run**.
- [ ] **Vérifier** : cette requête doit rendre quatre `true`.

  ```sql
  select
    exists (select 1 from pg_enum where enumlabel = 'listing_expiring') as migration_14,
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'listings'
               and column_name = 'renewed_at') as migration_15,
    exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'pro_verified_at') as migration_16,
    exists (select 1 from pg_proc
             where proname = 'reserve_listing' and prosrc like '%is_blocked_between%') as migration_17;
  ```

Si une migration échoue, rien n'en est appliqué : ne passe pas à la suivante, et
envoie-moi le message d'erreur.

- [ ] **Facultatif : recharger la démonstration**, pour y retrouver les nouveaux cas — une
      annonce qui expire dans quatre jours, une annonce expirée, une annonce remontée :

  ```bash
  npm run supabase:seed -- --delete   # retire les comptes de démonstration et tout ce qui en dépend
  npm run supabase:seed               # les recharge, dates recalées sur aujourd'hui
  ```

  Le retrait emporte aussi ce que tu as créé en testant avec ces comptes. **Vérifier** : en
  local (`npm run dev`), connecte-toi en `lecomptoirdukado@bulktcg.example` — le mot de passe
  est `DEMO_ACCOUNTS_PASSWORD`, dans `.env` —, puis **Mon compte → Mes annonces** : une
  section « Expirées », et une annonce dont l'échéance approche.

## 3. L'authentification Supabase

Ces réglages ne dépendent pas encore du domaine.

- [ ] **Authentication → URL Configuration**
  - *Site URL* : `http://localhost:3000` pour l'instant. Les liens des e-mails partent de
    cette adresse ; elle deviendra `https://bulktcg.fr` le jour de l'ouverture.
  - *Redirect URLs* : ajoute `http://localhost:3000/**`.
- [ ] **Authentication → Sign In / Providers** : *Confirm email* activé. Puis, dans le
      fournisseur **Email** :
  - *Minimum password length* : **12** — le site en exige 12, Supabase en accepte 6 par
    défaut ;
  - *Secure password change* activé, mais pas l'option qui exige le mot de passe actuel :
    le parcours « mot de passe oublié » ne le connaît pas ;
  - *Email OTP Expiration* : 3600 secondes, l'heure qu'annoncent les e-mails ;
  - Google reste désactivé.
- [ ] **Authentication → Emails → Templates** : remplace deux modèles. Seul le lien compte :
      avec le modèle par défaut, l'adresse serait confirmée sans que la session s'ouvre, et le
      lien du mot de passe oublié n'aboutirait pas.

  *Confirm signup* — objet : `Confirmez votre adresse — BulkTCG`

  ```html
  <h2>Bienvenue sur BulkTCG</h2>
  <p>Confirmez votre adresse pour activer votre compte :</p>
  <p><a href="{{ .SiteURL }}/connexion/confirmation?token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse</a></p>
  <p>Le lien sert une fois, pendant une heure. Si vous n'avez pas créé de compte, ignorez ce message.</p>
  ```

  *Reset password* — objet : `Choisir un nouveau mot de passe — BulkTCG`

  ```html
  <h2>Nouveau mot de passe</h2>
  <p>Pour choisir un nouveau mot de passe sur BulkTCG :</p>
  <p><a href="{{ .SiteURL }}/connexion/confirmation?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
  <p>Le lien sert une fois, pendant une heure. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe ne change pas.</p>
  ```

**Vérifier** : à l'étape 5, une fois les e-mails branchés.

## 4. Le nom de domaine

Il sert à l'adresse d'expédition des e-mails dès l'étape 5, puis à l'adresse du site.

- [ ] **Choisir** : `bulktcg.fr` s'il est libre ; prends aussi le `.com` si tu veux protéger
      la marque. Le `.fr` demande un titulaire qui réside dans l'Union européenne.
- [ ] **Acheter** chez un registraire — OVHcloud ou Gandi en France, ou un autre : il suffit
      d'avoir la main sur la **zone DNS**. Aucune offre d'hébergement ni de messagerie :
      Vercel héberge, Brevo envoie.
- [ ] **Activer le renouvellement automatique** : un domaine qui expire arrête le site et
      les e-mails.
- [ ] **Créer une redirection d'e-mail** (souvent gratuite chez le registraire) de
      `contact@bulktcg.fr` vers ta boîte personnelle : les mentions légales demandent une
      adresse de contact.

**Vérifier** : la console du registraire montre le domaine actif et sa zone DNS, modifiable.

## 5. Les e-mails avec Brevo

Sans SMTP à toi, Supabase n'envoie que deux e-mails par heure, et seulement aux membres de
l'équipe du projet : personne ne pourrait confirmer son inscription. Brevo est français, et
son offre gratuite permet 300 e-mails par jour, sans carte. C'est largement assez : seuls
les e-mails de compte partent pour l'instant, la confirmation d'inscription et le mot de
passe oublié.

### 5.1 Le compte

- [ ] Inscris-toi sur [brevo.com](https://www.brevo.com/fr/), confirme ton adresse et
      complète le profil demandé. Si Brevo annonce une validation du compte, attends son feu
      vert avant d'envoyer.

### 5.2 Authentifier le domaine

- [ ] Menu du compte (en haut à droite) → **Expéditeurs, domaines et IP dédiées** → onglet
      **Domaines** → **Ajouter un domaine** → `bulktcg.fr`, en choisissant de l'authentifier
      **toi-même** (sauf si Brevo propose de le faire directement chez ton registraire).
- [ ] Brevo affiche quatre enregistrements : crée-les dans la zone DNS du registraire, **avec
      les valeurs qu'il te donne**. Ce tableau ne sert qu'à reconnaître leur forme :

| Type | Nom | Valeur |
|---|---|---|
| TXT | `@` (le domaine nu) | `brevo-code:…` |
| CNAME | `brevo1._domainkey` | `b1.bulktcg.fr.dkim.brevo.com` |
| CNAME | `brevo2._domainkey` | `b2.bulktcg.fr.dkim.brevo.com` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

  Deux pièges. La plupart des registraires ajoutent eux-mêmes le domaine au nom : écris
  `brevo1._domainkey`, pas `brevo1._domainkey.bulktcg.fr`. Et certains veulent un point à la
  fin de la cible d'un CNAME (`…dkim.brevo.com.`). Un seul enregistrement `_dmarc` par
  domaine.

- [ ] De retour dans Brevo, **Authentifier** : chaque ligne doit passer au vert, en quelques
      minutes ou quelques heures.
- [ ] Onglet **Expéditeurs** → **Ajouter un expéditeur** : nom `BulkTCG`, adresse
      `no-reply@bulktcg.fr`. Si Brevo envoie un code à cette adresse, crée d'abord chez le
      registraire une redirection de `no-reply@` vers ta boîte, comme pour `contact@`.

### 5.3 La clé SMTP

- [ ] Menu du compte → **SMTP et API** → onglet **SMTP** : relève le serveur
      (`smtp-relay.brevo.com`), le port (`587`) et l'**identifiant**, de la forme
      `…@smtp-brevo.com`.
- [ ] **Générer une nouvelle clé SMTP**, nommée `supabase-auth`, et range-la aussitôt : elle
      ne se réaffiche pas. Une clé d'API Brevo ne marche pas à sa place.

### 5.4 Brancher Brevo dans Supabase

- [ ] **Authentication → Emails → SMTP Settings** → **Enable custom SMTP** :

| Champ | Valeur |
|---|---|
| Sender email | `no-reply@bulktcg.fr` |
| Sender name | `BulkTCG` |
| Host | `smtp-relay.brevo.com` |
| Port number | `587` |
| Username | l'identifiant Brevo (`…@smtp-brevo.com`) |
| Password | la clé SMTP |

  Laisse l'intervalle minimal entre deux e-mails à sa valeur par défaut, puis **Save**.

- [ ] **Authentication → Rate Limits** : avec un SMTP à toi, Supabase autorise 30 e-mails par
      heure pour tout le projet. Garde 30 au début. Le plafond de Brevo, 300 par jour, peut
      arriver le premier : quand les inscriptions en approchent, passe à une offre payante de
      Brevo, puis relève cette limite.

### 5.5 Vérifier

- [ ] En local (`npm run dev`), inscris-toi sur `http://localhost:3000/inscription` avec ta
      vraie adresse : l'e-mail arrive en une minute ou deux, et son lien ouvre la session.
      C'est un vrai compte de la base ; tu pourras le supprimer depuis **Paramètres**.
- [ ] Dans Gmail, **⋮ → Afficher l'original** : SPF, DKIM et DMARC disent `PASS`.
- [ ] « Mot de passe oublié » avec la même adresse : le lien mène au choix d'un nouveau mot
      de passe.

Si rien n'arrive : les spams, puis les journaux de l'e-mail transactionnel dans Brevo, puis
ceux de Supabase (**Logs → Auth**).

## 6. Vercel, en prévisualisation

Le but : voir le vrai site tourner chez Vercel, sur ta base Supabase, sans photos et fermé
au public. La production attendra l'ouverture : **le serveur refuse de démarrer en
production avec Supabase mais sans Cloudflare Images**, pour ne jamais mettre en ligne un
site dont chaque annonce serait « Sans photo ». Une prévisualisation, elle, l'accepte.

### 6.1 Le compte et le projet

- [ ] [vercel.com/signup](https://vercel.com/signup) → **Continue with GitHub** → offre
      **Hobby**, gratuite. Elle suffit tant que le site est fermé : les conditions de Vercel
      réservent Hobby à un usage non commercial, et un site qui encaisse un paiement ou
      affiche une publicité doit passer en Pro (étape 11).
- [ ] [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → autorise
      Vercel à lire le dépôt `bulktcg`, et lui seul → **Import**. Nom du projet `bulktcg` ;
      Next.js est reconnu ; ne touche ni au dossier racine ni à la commande de build,
      n'ajoute aucune variable ici → **Deploy**.

Vercel construit alors `main` en production : l'ancienne version, sur ses données de
démonstration. Sans importance — elle est fermée au point suivant, et remplacée le jour de
l'ouverture. Si ce premier déploiement échoue, ignore-le pour la même raison.

### 6.2 Fermer le site au public

- [ ] **Settings → Deployment Protection** → **Vercel Authentication** activée, portée **All
      Deployments** → **Save**. Seul ton compte Vercel ouvre alors le site, production
      comprise, et Google n'indexe pas une démonstration aux annonces fictives.
- [ ] **Vérifier** : l'adresse de production (`https://bulktcg.vercel.app`, ou celle que
      Vercel a donnée), ouverte en navigation privée, montre la connexion de Vercel au lieu
      du site.

### 6.3 La région des fonctions

Chaque page interroge la base plusieurs fois : les fonctions doivent tourner à côté d'elle.
Par défaut, Vercel les place à Washington.

- [ ] La région de ta base : dans Supabase, bouton **Connect** en haut du projet ; l'adresse
      du *pooler* la contient (`aws-…-eu-west-3.pooler.supabase.com` : Paris).
- [ ] **Settings → Functions → Function Region** → la région Vercel correspondante →
      **Save**.

| Supabase | Vercel |
|---|---|
| `eu-west-3` (Paris) | `cdg1` (Paris) |
| `eu-central-1` (Francfort) | `fra1` (Francfort) |
| `eu-west-1` (Irlande) | `dub1` (Dublin) |
| `eu-west-2` (Londres) | `lhr1` (Londres) |

### 6.4 Les variables d'environnement

**Settings → Environment Variables**. Pour chacune : le nom, la valeur, les environnements
cochés, et **Sensitive** pour un secret — Vercel ne la réaffichera plus. Jamais
*Development* : en local, c'est ton `.env`.

- [ ] Tire `CRON_SECRET` et range-le :

  ```bash
  openssl rand -hex 32
  ```

| Variable | Production | Preview | |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | — | ✓ | recopiée de `.env` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | — | ✓ | recopiée de `.env` |
| `SUPABASE_SECRET_KEY` | — | ✓ | recopiée de `.env`, **Sensitive** |
| `CRON_SECRET` | ✓ | ✓ | **Sensitive** |
| `INSEE_SIRENE_API_KEY` | ✓ | ✓ | à l'étape 7, **Sensitive** |

**À ne pas poser** : `NEXT_PUBLIC_SITE_URL` (Vercel fournit le domaine du projet ; elle
viendra à l'ouverture), `DEMO_USER_ID`, `DEMO_ACCOUNTS_PASSWORD`, et aucune variable
Cloudflare avant que je te le dise.

### 6.5 Une prévisualisation branchée sur Supabase

Une variable ne vaut que pour les déploiements suivants, et Vercel ne déploie une branche
qu'à sa prochaine poussée.

- [ ] Pousse un commit vide sur `refonte-design` :

  ```bash
  git switch refonte-design
  git commit --allow-empty -m "Déployer la prévisualisation"
  git push
  ```

- [ ] **Deployments** → le déploiement *Preview* de `refonte-design` → **Visit**. Son
      adresse de branche reste la même d'une poussée à l'autre :
      `bulktcg-git-refonte-design-<ton-compte>.vercel.app`.

**Vérifier** :

- [ ] les annonces viennent de Supabase — « Sans photo » partout, c'est normal avant la
      phase 3 ;
- [ ] la connexion marche avec un compte de démonstration
      (`lecomptoirdukado@bulktcg.example`, mot de passe `DEMO_ACCOUNTS_PASSWORD`) ;
- [ ] l'onglet **Logs** du déploiement ne dit pas « Configuration refusée ». S'il le dit, le
      message nomme la variable en cause.

Pour essayer l'inscription sur la prévisualisation plutôt qu'en local, mets un moment son
adresse de branche en *Site URL* (étape 3) : les liens des e-mails y mèneront. Remets
`http://localhost:3000` ensuite.

## 7. La clé Insee

Sans elle, une entreprise qui a refusé la diffusion de ses données — souvent une
micro-entreprise — ne peut pas passer professionnelle : le répertoire public ne la montre
pas. La clé est gratuite et permet 30 requêtes par minute ; le site ne s'en sert que quand
quelqu'un déclare un SIRET.

- [ ] [portail-api.insee.fr](https://portail-api.insee.fr/) → **Se connecter** →
      **CONNEXION-POUR-LES-EXTERNES** → **Enregistrement** la première fois → le formulaire
      → le lien de confirmation reçu de `portail-api@insee.fr`.
- [ ] **Tableau de bord** → **Créer ma première application** → mode **simple** → nom
      `BulkTCG`, description « Vérification du SIRET des comptes professionnels » →
      **Créer l'application**.
- [ ] **Catalogue** → **API Sirene** → **Souscrire** → plan **Public** → **Suivant** →
      l'application `BulkTCG`.
- [ ] Ton application → onglet **Souscriptions** → API Sirene : la clé s'affiche à droite ;
      copie-la.
- [ ] Pose-la dans `.env` (`INSEE_SIRENE_API_KEY=…`) et sur Vercel (étape 6.4).
- [ ] **Vérifier** : la réponse doit commencer par `{"header":{"statut":200`.

  ```bash
  curl -s -H "X-INSEE-Api-Key-Integration: $(grep '^INSEE_SIRENE_API_KEY=' .env | cut -d= -f2-)" \
    https://api.insee.fr/api-sirene/3.11/siret/55203253400703 | head -c 80; echo
  ```

- [ ] Dis-moi « clé Insee posée ». La réponse d'une entreprise non diffusée a été
      reconstituée d'après la documentation, faute de clé : j'en interrogerai une vraie et
      je remplacerai celle des tests.

## 8. Le juridique et l'administratif

À lancer maintenant : c'est le plus long, et l'ouverture en dépend.

- [ ] **La structure.** Les options payantes et le forfait pro sont une activité
      commerciale : avant le premier euro encaissé, il faut une entreprise. Une
      micro-entreprise suffit pour commencer, déclarée sur le guichet unique,
      [formalites.entreprises.gouv.fr](https://formalites.entreprises.gouv.fr/). Son SIRET
      servira aux mentions légales, à Stripe et aux factures. Vois le régime de TVA avec un
      comptable : le forfait s'affiche aujourd'hui « 29 € HT », et tous les prix sont
      provisoires (`src/lib/site.ts`).
- [ ] **Les mentions légales** : l'éditeur (nom, adresse, SIRET, contact), le directeur de
      la publication, les hébergeurs (Vercel pour le site, Supabase pour la base).
      Donne-moi ces informations et je remplis la page : elle liste déjà ce que la LCEN
      impose, sans rien inventer.
- [ ] **La politique de confidentialité** (RGPD), qui n'existe pas encore : ce qui est
      collecté et pourquoi, combien de temps — dont la règle des photos, supprimées trente
      jours après la vente ou l'expiration sauf signalement en cours —, qui le traite
      (Supabase, Vercel, Brevo, Cloudflare, l'Insee pour le SIRET, Stripe), et comment
      exercer ses droits.
- [ ] **Les CGU**, et des **CGV** pour les options et le forfait, qui n'existent pas encore.
      Un point à faire trancher : un particulier qui achète une option a en principe
      quatorze jours pour se rétracter, sauf s'il demande l'exécution immédiate et renonce à
      ce droit — l'écran de paiement devra alors le lui faire dire.
- [ ] **Les accords de sous-traitance** (DPA) de chaque prestataire, à garder : la politique
      de confidentialité les cite.
- [ ] **Le registre des traitements** : la CNIL en donne un modèle simple.
- [ ] **Tout faire relire par un juriste**, avec ce que le site affiche déjà : la mise en
      garde au dépôt (un professionnel qui se dit particulier risque jusqu'à cinq ans de
      prison et 750 000 € d'amende en ligne, art. L132-2 du Code de la consommation), les
      « Conditions de la vente » de chaque fiche (art. D111-8), et les sections « Qui
      publie, et dans quel ordre » et « Conservation » des mentions légales.

Je peux rédiger les brouillons à partir de ce que le site fait réellement ; le juriste les
corrige.

## 9. Cloudflare Images

**Quand je te dis que je commence les photos** : l'abonnement se paie dès qu'il est pris.
Les photos des annonces y vivront. Cloudflare ne sert jamais le fichier reçu, seulement des
copies qu'il ré-encode sans métadonnées — la position GPS d'une photo prise chez soi
disparaît —, et il sait garder privées celles des lots réservés aux pros.

- [ ] Crée un compte sur [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
      et confirme l'adresse. Inutile d'y ajouter le domaine.
- [ ] **Images → Hosted Images** → abonne-toi à **Images Paid** : 5 $ par mois par tranche
      de 100 000 photos stockées, plus 1 $ par tranche de 100 000 affichages. Les variantes
      ne comptent pas.
- [ ] Dans le panneau **Developer resources** de cette page, relève l'**Account ID**
      (`CLOUDFLARE_ACCOUNT_ID`) et l'**Account hash**, qui donne l'adresse des photos :

  ```
  NEXT_PUBLIC_PHOTOS_URL=https://imagedelivery.net/<account hash>/{key}/{variant}
  ```

  `{key}` et `{variant}` s'écrivent tels quels, accolades comprises : le site y pose
  l'identifiant de la photo et la variante.

- [ ] Onglet **Keys** → copie la clé de signature (`CLOUDFLARE_IMAGES_SIGNING_KEY`) : elle
      signe les adresses des photos privées.
- [ ] Le jeton d'API : icône du profil → **My Profile** → **API Tokens** → **Create Token** →
      **Create Custom Token** → nom `bulktcg-images` → permission **Account · Cloudflare
      Images · Edit** → *Account Resources* : ton compte → **Continue to summary** →
      **Create Token** → copie-le, il ne se réaffiche pas (`CLOUDFLARE_IMAGES_API_TOKEN`).
      La page propose une commande `curl` de test : elle doit répondre « This API Token is
      valid and active ».
- [ ] Onglet **Delivery** → **Create variant**, cinq fois. Pour chacune : *Fit* **Scale
      down**, *Metadata* **Strip all**, et *Always allow public access* **désactivé** —
      sinon une photo réservée aux pros s'afficherait sans signature.

| Nom | Largeur | Hauteur |
|---|---|---|
| `w160` | 160 | 120 |
| `w320` | 320 | 240 |
| `w640` | 640 | 480 |
| `w1024` | 1024 | 768 |
| `w1600` | 1600 | 1200 |

- [ ] Supprime la variante `public`, créée par défaut, et vérifie que les **Flexible
      variants** restent désactivées : elles laisseraient n'importe qui choisir ses
      réglages, métadonnées comprises.
- [ ] Pose les quatre valeurs dans `.env`, avec un `CRON_SECRET` (obligatoire avec elles ;
      un autre `openssl rand -hex 32` convient en local), et dis-le moi : je vérifierai sur
      ton compte les deux réponses de l'API que le code suppose encore — le code d'une image
      introuvable, et l'identifiant d'une image dont on change la visibilité.

**Pas sur Vercel avant que la phase 3 soit livrée** : posées en production avec Supabase,
ces variables ouvriraient un site dont le dépôt de photos ne marche pas encore.

## 10. Stripe

**Quand je code le paiement.** Il faut l'entreprise de l'étape 8.

- [ ] Crée le compte sur [stripe.com/fr](https://stripe.com/fr) et active-le : l'entreprise,
      son SIRET, un IBAN, une pièce d'identité. Le mode test est disponible tout de suite.
- [ ] Confirme les prix, tous provisoires (`src/lib/site.ts`) : forfait pro 29 € HT par mois,
      « À la une » 2 €, « Urgent » 1 €, « Remontée » 1,50 €, « 8 photos » 3 €.
- [ ] La suite viendra avec le code : je te donnerai les clés à poser sur Vercel, l'adresse
      du webhook à déclarer chez Stripe et les produits à créer.

## 11. L'ouverture

Quand tout est prêt de mon côté (photos, paiement, limitation de débit, modération) et du
tien (étapes 1 à 10, textes juridiques en ligne). Dans cet ordre :

- [ ] **Les offres payantes.** Vercel **Pro**, depuis la page **Billing** de ton compte :
      obligatoire pour un site qui encaisse ou affiche de la publicité. Supabase **Pro**,
      depuis la page **Billing** de ton organisation : des sauvegardes quotidiennes gardées
      sept jours — le plan gratuit n'en a aucune — et plus de mise en pause.
- [ ] **Le domaine.** Vercel → **Settings → Domains** → **Add** → `bulktcg.fr`, en acceptant
      que `www.bulktcg.fr` redirige vers lui. Vercel affiche les enregistrements à créer, un
      `A` pour le domaine nu et un `CNAME` pour `www` : recopie **les siens** chez le
      registraire, et supprime les enregistrements `A` ou `CNAME` de parking qui occupent
      déjà `@` ou `www` — sans toucher à ceux de Brevo ni à la redirection d'e-mail. Attends
      « Valid Configuration » ; le certificat HTTPS est automatique.
- [ ] **Vider la base de la démonstration** : `npm run supabase:seed -- --delete`. Les
      communes et les séries restent.
- [ ] **Retirer les trois variables Supabase de *Preview*** : sinon chaque prévisualisation
      écrirait dans la vraie base. Pour garder des prévisualisations branchées, crée-leur un
      second projet Supabase.
- [ ] **Les variables de production** (*Production* seulement) : `NEXT_PUBLIC_SITE_URL` =
      `https://bulktcg.fr`, les trois variables Supabase, les quatre de Cloudflare, et celles
      de Stripe quand je les aurai nommées. `CRON_SECRET` et `INSEE_SIRENE_API_KEY` y sont
      déjà.
- [ ] **Mettre le code en production** : fusionne `refonte-design` dans `main` et pousse,
      ou demande-le-moi. Vercel construit la production avec ses variables.
- [ ] **Supabase → Authentication → URL Configuration** : *Site URL* `https://bulktcg.fr`,
      et ajoute `https://bulktcg.fr/**` aux *Redirect URLs*.
- [ ] **Ouvrir** : **Settings → Deployment Protection** → portée **Standard Protection**.
      La production devient publique ; les prévisualisations restent fermées.

**Vérifier** :

- [ ] `https://bulktcg.fr` s'ouvre en navigation privée, et `https://www.bulktcg.fr` y
      redirige.
- [ ] Une inscription avec ta vraie adresse : l'e-mail arrive, son lien mène sur
      `bulktcg.fr` et ouvre la session.
- [ ] Une annonce déposée avec ses photos les affiche.
- [ ] **Settings → Cron Jobs** liste `/taches/quotidiennes`, chaque jour à 4 h UTC — à la
      minute près en Pro. Lance-la une fois à la main :

  ```bash
  read -rs CRON_SECRET   # colle la valeur puis Entrée ; rien ne s'affiche
  curl -s -H "Authorization: Bearer $CRON_SECRET" https://bulktcg.fr/taches/quotidiennes; echo
  ```

  La réponse commence par `{"lifecycle":`. Sans l'en-tête, la même adresse répond 401. Le
  lendemain, **View Logs**, à côté de la tâche, montre son passage en 200.

- [ ] L'[Observatory de Mozilla](https://developer.mozilla.org/en-US/observatory) note
      `bulktcg.fr` **A+**.
- [ ] [Google Search Console](https://search.google.com/search-console) → **Ajouter une
      propriété** → **Domaine** → `bulktcg.fr` → l'enregistrement TXT qu'il donne, chez le
      registraire → **Valider**. Puis **Sitemaps** → `sitemap.xml`.

## 12. Ensuite, l'entretien

| Quand | Quoi |
|---|---|
| chaque jour, tout seul | la tâche quotidienne ; un œil de temps en temps sur **Cron Jobs → View Logs** |
| à chaque nouvelle extension | `node scripts/editions-update.mjs`, `npm test`, `npm run supabase:editions`, puis commit et déploiement |
| chaque année, en janvier | `node scripts/communes-update.mjs` (les fusions de communes du 1er janvier), `npm test`, `npm run supabase:communes`, puis commit et déploiement |
| quand les e-mails approchent 300 par jour | l'offre payante de Brevo, puis la limite de Supabase relevée (étape 5.4) |
| chaque année | le renouvellement du domaine, s'il n'est pas automatique |

Le référentiel part en base **avant** le déploiement : le site ne propose jamais une série
ou une commune que la base refuserait.

Déjà décidé, pour plus tard :

- « À la une » sur trente jours : d'abord limiter le nombre de places à la une (deux ou
  trois par page, en roulement), seulement ensuite la nouvelle formule.
- Les e-mails de notification — l'annonce qui expire, les croisements, les messages : je les
  coderai, ils partiront par Brevo.
- Un collecteur `report-to` pour la CSP, puis le préchargement HSTS
  ([hstspreload.org](https://hstspreload.org/)) une fois le domaine définitif servi en HTTPS
  partout.
- Une vraie régie publicitaire demandera un bandeau de consentement aux cookies.
  Aujourd'hui il n'en faut pas : le site ne pose que des cookies nécessaires (session,
  inscription).

## Ce qui me reste à coder

Pour savoir ce qui bloque quoi :

| Chantier | Bloque l'ouverture | Attend de toi |
|---|---|---|
| Les photos (phase 3) : dépôt, visibilité, ménage quotidien des fichiers | oui | l'étape 9 |
| Le paiement des options et du forfait, et son webhook | oui | les étapes 8 et 10 |
| La limitation de débit devant la connexion, l'inscription et le mot de passe oublié | oui | — |
| L'outil de modération des signalements (tant qu'un signalement est ouvert, les photos de l'annonce visée restent) | oui | — |
| Les pages légales : mentions, confidentialité, CGU, CGV | oui | l'étape 8 |
| Le compteur de vues, l'écran pour débloquer quelqu'un | non | — |
| Les e-mails de notification | non | l'étape 5 |

## Si quelque chose coince

| Symptôme | Cause probable |
|---|---|
| « Configuration refusée — le serveur ne démarre pas » dans les journaux Vercel | une variable mal formée ou un groupe à moitié rempli ; le message la nomme. Souvent : une espace collée avec la valeur, un `CRON_SECRET` trop court, `NEXT_PUBLIC_PHOTOS_URL` sans `{key}/{variant}`, ou Supabase en production sans Cloudflare |
| Le build échoue sur « NEXT_PUBLIC_SITE_URL manque » | Vercel ne transmet plus ses variables système : **Settings → Environment Variables** → *Automatically expose System Environment Variables*, ou pose `NEXT_PUBLIC_SITE_URL` |
| La connexion de Vercel s'affiche au lieu du site | la protection de l'étape 6.2 : normal avant l'ouverture |
| Une variable changée reste sans effet | elle ne vaut que pour les déploiements suivants : **Deployments** → **⋯** → **Redeploy** |
| « Sans photo » sur toutes les annonces | normal avant la phase 3 |
| Aucun e-mail reçu | les spams ; un domaine pas encore tout vert chez Brevo ; les journaux de Brevo et de Supabase (étape 5.5) |
| L'inscription refuse pour excès de demandes | la limite de 30 e-mails par heure de Supabase, ou le plafond quotidien de Brevo |
| Supabase annonce le projet en pause | un projet gratuit sans activité pendant une semaine est mis en pause : **Resume project** dans son tableau de bord. Un projet Pro ne l'est jamais |
| Le domaine reste en « Invalid Configuration » | un enregistrement de parking occupe encore `@` ou `www`, ou le DNS n'a pas fini de se propager (jusqu'à quelques heures) |

## Références

- Supabase : [SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp),
  [adresses de redirection](https://supabase.com/docs/guides/auth/redirect-urls),
  [sauvegardes](https://supabase.com/docs/guides/platform/backups),
  [mise en pause des projets gratuits](https://supabase.com/docs/guides/platform/free-project-pausing).
- Vercel : [tâches planifiées](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
  [région des fonctions](https://vercel.com/docs/functions/configuring-functions/region),
  [protection des déploiements](https://vercel.com/docs/deployment-protection),
  [usage commercial](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage).
- Brevo : [authentifier un domaine](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).
- Cloudflare Images : [tarifs](https://developers.cloudflare.com/images/pricing/),
  [variantes](https://developers.cloudflare.com/images/manage-images/create-variants/),
  [images privées](https://developers.cloudflare.com/images/manage-images/serve-images/serve-private-images/).
- Insee : [se connecter aux API](https://www.sirene.fr/static-resources/documentation/Insee_API_publique_modalites_connexion.pdf).
