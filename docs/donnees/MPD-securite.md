# MPD — Sécurité : RLS, droits, photos

Partie du [MPD](MPD.md). Migration `20260929120900_security.sql` ; le registre des photos
naît dans `20260929120300_listings.sql`.

## 1. Le modèle

Trois rôles se présentent à la base :

| Rôle | Qui | RLS |
|---|---|---|
| `anon` | un visiteur sans session | appliquée |
| `authenticated` | un compte connecté ; `auth.uid()` rend son identifiant | appliquée |
| `service_role` | le serveur : paiement, imports des référentiels, envoi des e-mails, modération, croisement d'un dépôt, compteur de vues | contournée |

Supabase accorde par défaut tous les droits sur le schéma public à `anon` et
`authenticated`. La sécurité tient donc en trois couches :

1. **La RLS est activée sur les vingt et une tables** — `tests/schema-security.test.mjs` échoue si
   une table en manque. Sans politique, rien n'est permis.
2. **Les politiques disent quelles lignes** chacun lit et écrit.
3. **Les droits de colonnes disent lesquelles de ses colonnes** le titulaire d'une ligne
   modifie. Sans eux, la politique « modifiée par son vendeur » laisserait un vendeur se
   mettre « À la une » depuis la console du navigateur.

La couche données (`src/lib/data/*-mutations.ts`) refait ces contrôles pour rendre une
réponse lisible ; la base les garantit. Une sous-requête dans une politique est elle-même
soumise à la RLS de la table qu'elle lit : les photos, séries et produits d'une annonce
réservée aux pros sont invisibles de qui ne voit pas l'annonce, sans règle de plus.

## 2. Politiques par table

| Table | Lecture | Écriture |
|---|---|---|
| `communes`, `editions`, `product_tag_games` | tous | aucune (imports, clé de service) |
| `profiles` | tous | création et modification de sa propre ligne |
| `account_settings` | son titulaire | modification de sa ligne ; création par déclencheur |
| `listings` | audience `everyone`, ou son vendeur, ou un pro au forfait actif (`is_active_pro`) | création, modification, suppression par son vendeur |
| `listing_photos`, `listing_editions`, `listing_tags` | avec leur annonce | par le vendeur de l'annonce ; une photo doit venir de ses téléversements — et un déclencheur le revérifie pour la clé de service |
| `wanted_listings` | tous | création, modification, suppression par son acheteur |
| `conversations` | ses deux participants | ouverture par un participant, voir ci-dessous ; aucune mise à jour directe |
| `messages` | les participants | écrit en son nom par un participant non bloqué ; sur un lot réservé, seuls le vendeur et la personne désignée ; lu (`read_at`) par le destinataire seul |
| `deals` | ses deux parties | aucune : `close_deal` |
| `reviews` | tous | par une partie de la vente, sur l'autre ; jamais modifié |
| `listing_waitlist` | sa propre inscription | inscription sur le lot réservé d'un autre, retrait de la sienne |
| `notifications` | leur destinataire | `read_at` par le destinataire ; création par déclencheur ou clé de service |
| `blocks` | leur auteur | pose et levée par leur auteur |
| `reports` | personne (modération, clé de service) | dépôt en son nom |
| `photo_uploads` | ses propres fichiers | aucune : le serveur, avec la clé de service |
| `photo_purge_lease` | personne | aucune : le ménage, avec la clé de service |

L'ouverture d'une conversation est la politique la plus riche. Elle exige que l'appelant
soit l'un des deux participants, que personne n'ait bloqué personne, que le lot soit
disponible et que `seller_id` soit **le vendeur de l'annonce** ; et quand c'est le vendeur
qui écrit le premier — il propose son lot à une demande (`proposeListing`) —, que
l'acheteur ait une demande ouverte **sur ce jeu**. Proposer du Magic à qui cherche du
Pokémon serait du démarchage.

## 3. Droits de colonnes

Là où une politique laisse quelqu'un écrire sa ligne, les colonnes qu'il peut écrire
sont exactement celles d'un type d'écriture de `src/lib/data/rows.ts`, et
`tests/schema-security.test.mjs` compare les deux listes.

| Table | Insertion permise | Mise à jour permise | Jamais depuis le navigateur |
|---|---|---|---|
| `profiles` | `id`, `username`, `city`, `postal_code`, `avatar_initials`, `bio` | les mêmes sauf `id`, plus la fiche boutique, ses pages de places de marché et `company_name` | `account_type`, `pro_until`, `siret`, `legal_name`, `pro_verified_at`, notes, `sold_listing_count` |
| `account_settings` | — | `alert_matches`, `alert_messages` (`AccountSettingsUpdate`) | la création, la suppression |
| `listings` | `ListingInsert` | `ListingUpdate` | `featured_until`, `urgent_until`, `extra_photos`, `bump_started_at`, `bump_until`, `renewed_at`, `view_count`, `reserved_for`, `slug` après coup |
| `wanted_listings` | `WantedInsert` | `WantedUpdate` | `slug` après coup, `created_at`, `updated_at` |
| `conversations` | `ConversationInsert` | aucune | dates de retrait (`hide_conversation`), `last_message_at` |
| `messages` | `MessageInsert` | `read_at` | `read_at` à l'envoi, `created_at` |
| `reviews` | `ReviewInsert` | aucune | `reviewed_id`, `reviewed_role`, `listing_id` (`stamp_review`) |
| `deals` | aucune | aucune | tout (`close_deal`) |
| `notifications` | aucune | `read_at` | tout le reste |
| `blocks` | `BlockInsert` | aucune | `created_at` |
| `reports` | `ReportInsert` | aucune | `resolved_at`, qui est à la modération |

Les fonctions suivent la même logique : `record_listing_view` n'est exécutable que par
`service_role`. Un vendeur qui pourrait l'appeler gonflerait ses vues en boucle ; le
serveur l'appelle, avec la clé de service, quand une fiche est servie. `claim_photo_purge`
et `forget_purged_photos` aussi : la première rend les fichiers de tous les comptes et les
promet au retrait, la seconde efface leur registre.

## 4. Fonctions `security definer`

Elles voient au-delà de la RLS de l'appelant ; chacune est bornée par ce qu'elle
vérifie elle-même :

| Fonction | Ce qu'elle voit en plus | Sa borne |
|---|---|---|
| `is_active_pro` | le profil de n'importe qui | ne rend qu'un booléen déjà public (le badge) |
| `is_blocked_between` | les blocages posés par l'autre | ne répond que pour une paire dont l'appelant fait partie : personne ne sonde qui bloque qui |
| `waitlist_count` | les inscrits d'un lot | ne compte que pour le vendeur du lot, jamais un nom |
| `pro_only_count_by_game` | les annonces réservées | ne rend qu'un nombre par jeu |
| `close_deal`, `reserve_listing`, `hide_conversation` | la conversation, l'annonce | n'agissent que si l'appelant est le vendeur (ou un participant pour `hide_conversation`) ; `close_deal` et `reserve_listing` refusent deux comptes dont l'un a bloqué l'autre (migration 17 pour la seconde) |
| `claim_photo_purge` | le registre de tous les comptes | exécutable par `service_role` seul ; ne rend qu'un fichier qu'aucune photo n'affiche, passé son délai de grâce, relu sous verrou en `read committed` — elle refuse tout autre niveau —, par lots de 1 000 au plus |
| `forget_purged_photos` | le registre de tous les comptes | exécutable par `service_role` seul ; n'efface que les lignes que le ménage a marquées |
| `release_photo_purge` | le bail du ménage | exécutable par `service_role` seul ; ne rend que le bail du passage qui l'appelle |
| fonctions de déclencheur | les tables qu'elles tiennent à jour | ne s'exécutent qu'à l'écriture qui les déclenche |

`check_report_target`, au contraire, reste sous les droits de l'appelant : c'est
précisément sa RLS qui dit ce qu'il peut lire, donc signaler.

## 5. Photos chez Cloudflare

Les fichiers ne sont pas dans la base : Cloudflare Images les reçoit, les ré-encode et les
sert — décidé, R2 écarté (`supabase/README.md`, § 6). La base tient le registre
`photo_uploads`, et c'est lui qui dit à qui appartient chaque fichier.

| Règle | Où | Ce qu'elle empêche |
|---|---|---|
| Le serveur seul inscrit un téléversement (`revoke insert, update, delete` au rôle connecté ; clé de service) | droits | un compte qui déclarerait à son nom l'image d'un autre |
| Chacun lit ses propres lignes (`téléversements lus par leur propriétaire`) ; un anonyme rien (`revoke all … from anon`) | RLS, droits | dresser la liste des fichiers des autres |
| Une photo d'annonce vient des téléversements du vendeur lui-même (`photos écrites par le vendeur`) | RLS | accrocher le fichier d'un autre vendeur : son pseudo finirait dans le filigrane, que `/securite` apprend à vérifier |
| La même règle pour tous les rôles, clé de service comprise, à l'accrochage comme au déplacement d'une photo (`listing_photos_check_upload`) ; et côté serveur, avant le paiement, pour les photos 4 à 8 (`findUnattachableUploads`, qui écarte aussi un fichier déjà affiché ailleurs ou pris par le ménage) | déclencheur, serveur | glisser la clé du fichier d'un autre parmi les photos 4 à 8, que le webhook de paiement accroche avec la clé de service : payée, l'option rendrait publique la photo d'un lot réservé aux pros (relecture Cloudflare, F1) |
| Un fichier n'affiche qu'une photo (`listing_photos_one_photo_per_file`) | contrainte | une clé que Cloudflare remplace refusée par une annonce vendue qui partageait le fichier : Cloudflare et la base se contrediraient |
| Une photo d'annonce référence un fichier du registre (`→ photo_uploads (key)`, *on delete restrict*) | clé étrangère | une photo que le serveur n'a pas délivrée ; un ménage qui retirerait un fichier encore affiché |
| Le ménage ne se lance qu'avec la clé de service (`claim_photo_purge`, `forget_purged_photos`, `revoke execute`) | droits | un compte qui ferait retirer les fichiers des autres, lirait la liste de ceux qui vont partir, ou en effacerait le registre |
| Un fichier pris par le ménage ne s'accroche plus, même avec la clé de service (`listing_photos_check_upload`) | déclencheur | une photo publiée sur un fichier que Cloudflare va retirer — elle s'afficherait vide, sans que rien ne le signale |
| Un seul passage du ménage à la fois (`photo_purge_lease`, pris par `claim_photo_purge`, illisible pour les rôles de l'API) | bail, droits | deux passages qui doubleraient le débit envoyé à Cloudflare : sa limite bloquerait tout le compte, dépôts des vendeurs compris |

Pourquoi un registre plutôt qu'un préfixe de chemin : Cloudflare Images ne laisse pas
choisir l'identifiant d'une image privée — une image à identifiant choisi ne peut pas
exiger d'URL signée —, et les photos d'un lot réservé aux pros doivent l'être. Aucun
préfixe ne peut donc porter le propriétaire.

Les photos d'une annonce réservée aux pros sont privées chez Cloudflare : une adresse ne
suffit pas, il faut une URL signée (HMAC-SHA256, `src/lib/photo-signing.ts`). La page n'en
porte jamais : une route du site revérifie le lecteur sous la RLS à chaque image, puis le
redirige vers une URL signée de dix à quinze minutes (`supabase/README.md`, § 8). Aucune
variante « toujours publique » ne doit exister : elle contournerait la signature. Aucune
variante flexible non plus : elle ne sert pas une image privée, et laisserait demander
`metadata=keep`.

## 6. Limites connues

* **Une URL signée vaut jusqu'à son expiration** : transmise, elle montre la photo d'un
  lot réservé à qui la reçoit, le temps qu'elle dure — un quart d'heure au plus. La page
  n'en porte aucune : chaque image repasse par la route qui vérifie le lecteur, et un
  forfait expiré ferme la porte à l'image suivante.
* **La fin de forfait (`pro_until`) est lisible par tous**, avec le reste du profil : le
  badge PRO se calcule sur elle à chaque vignette (`isActiveProRow`). La date exacte
  n'est affichée qu'au titulaire.
* **Les fichiers ne suivent pas les suppressions en cascade** : retirer une photo, une
  annonce ou un compte laisse le fichier chez Cloudflare jusqu'au ménage — un jour de
  grâce, plus au plus un jour d'attente de la tâche quotidienne. Pendant ce temps, une
  photo publique reste lisible par qui a gardé son adresse. Le registre date le
  décrochage et rend le fichier trouvable, et la clé étrangère empêche d'en retirer un
  encore affiché.
