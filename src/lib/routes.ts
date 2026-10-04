/* Import relatif, et le seul du projet : next.config.ts charge ce module
   hors du bundler, là où l'alias @/ n'est pas résolu — il a arrêté le
   serveur de développement au premier import d'une valeur. */
import { GAME_IDS, type GameId } from "../types/game";

/* Les adresses du site, écrites une fois.

   Un lien, une redirection, une revalidation, le plan du site, robots.txt et
   les données structurées passent tous par ici : une route se renomme dans
   ce fichier et nulle part ailleurs. Il y en avait deux cent soixante-dix
   écrites à la main dans quatre-vingt-dix fichiers, et c'est ainsi que
   /pokemon/lots a survécu dans des liens après sa suppression.

   tests/routes.test.mjs vérifie que chaque adresse construite ici mène à une
   page de src/app, et qu'aucune n'est écrite à la main ailleurs. typedRoutes
   ne le ferait pas : /[game] et /[game]/[city] acceptent toute adresse d'un
   ou deux segments, si bien que « /deposerr » ou « /mon-compte/annonce » y
   passeraient. Le test, lui, sait que [game] ne prend qu'un jeu connu.

   Les adresses se lisent en français, comme le reste de l'interface :
   /annonces/<lien>, /recherches/<lien>, /profil/<pseudo>. Elles étaient
   /a/, /r/ et /p/ — trois lettres qu'aucun lecteur ne déchiffre dans un
   lien collé sur Facebook, et qui ne disent rien à un moteur de recherche.
   Les anciennes redirigent en permanence (next.config.ts) : un lien déjà
   partagé ne casse pas.

   Les paramètres qui appartiennent à un domaine — filtres d'une liste,
   étapes du compte, vues des ventes, cible d'un signalement — se posent dans
   le module de ce domaine, sur ces adresses. */

/* Les paramètres des adresses construites ici, lus par les pages qu'elles
   visent : écrits une fois pour les deux côtés. En français, comme tous les
   paramètres visibles. */
export const ROUTE_PARAM = {
  returnTo: "suivant",
  aboutListing: "annonce",
  aboutWanted: "recherche",
  forWanted: "pour",
} as const;

/* L'ancre de la section des avis, sur un profil comme sur une vente. */
export const REVIEWS_ANCHOR = "avis";

/* Les deux onglets d'une page de jeu ou de ville. Le fragment porte la vue :
   il est visible, il se copie, et le retour arrière le défait — comme un
   filtre d'URL. Mais contrairement à un paramètre de requête il ne demande
   rien au serveur — les deux panneaux sont déjà dans la page — et n'invente
   pas une seconde adresse pour le même contenu, que les moteurs devraient
   apprendre à ignorer sur chaque page de ville. */
export const MARKET_FRAGMENT = { sell: "ventes", buy: "recherches" } as const;

/* Un segment dynamique : un identifiant, un lien permanent, un pseudo. Ils
   sont déjà sûrs par construction ; l'encodage garantit qu'aucun ne sortira
   jamais de son segment. */
const segment = (value: string) => encodeURIComponent(value);

/* Le segment d'adresse de chaque jeu : son nom tel qu'on le tape, mots
   séparés — /one-piece, /yu-gi-oh —, et « Autre » en français plutôt que
   /other. L'identifiant reste celui du code et de la base ; l'adresse, elle,
   se lit, et le même segment sert dans le chemin comme dans ?jeu=. */
export const GAME_SEGMENT: Record<GameId, string> = {
  pokemon: "pokemon",
  magic: "magic",
  onepiece: "one-piece",
  lorcana: "lorcana",
  riftbound: "riftbound",
  yugioh: "yu-gi-oh",
  naruto: "naruto",
  other: "autres-jeux",
};

/* Le jeu d'un segment d'adresse, ou null. */
export function gameFromSegment(value: string | null | undefined): GameId | null {
  return GAME_IDS.find((gameId) => GAME_SEGMENT[gameId] === value) ?? null;
}

const withParam = (path: string, name: string, value: string) => `${path}?${new URLSearchParams({ [name]: value })}`;

export const routes = {
  home: "/",
  listings: "/annonces",
  wantedListings: "/recherches",
  deposit: "/deposer",
  depositWanted: "/deposer/recherche",
  inbox: "/messages",
  notifications: "/notifications",
  account: "/mon-compte",
  accountListings: "/mon-compte/annonces",
  accountWanted: "/mon-compte/recherches",
  accountDeals: "/mon-compte/transactions",
  accountProfile: "/mon-compte/profil",
  accountSettings: "/mon-compte/parametres",
  pro: "/pro",
  proListings: "/pro/lots",
  safety: "/securite",
  legal: "/mentions-legales",
  report: "/signaler",
  signIn: "/connexion",
  signUp: "/inscription",
  passwordReset: "/mot-de-passe-oublie",
  /* Après une inscription, ou une demande de nouveau mot de passe : la page
     qui dit qu'un lien part, et quoi faire s'il n'arrive pas. */
  signUpSent: "/inscription/e-mail-envoye",
  passwordResetSent: "/mot-de-passe-oublie/e-mail-envoye",
  newPassword: "/nouveau-mot-de-passe",
  /* Où mène le lien reçu par e-mail — confirmer son adresse, choisir un
     nouveau mot de passe (lib/email-link.ts) —, et où il renvoie quand il a
     déjà servi ou expiré. */
  emailConfirmation: "/connexion/confirmation",
  expiredLink: "/connexion/lien-expire",
  /* Deux fichiers que Next sert à une adresse fixe (src/app/sitemap.ts,
     apple-icon.tsx) : robots.txt y déclare le plan du site, les données
     structurées y prennent leur logo. */
  sitemap: "/sitemap.xml",
  appleIcon: "/apple-icon",
  /* Les communes proposées à un champ commune pendant la frappe : le
     référentiel reste sur le serveur (lib/cities.ts). */
  communeSuggestions: (query: string) => `/communes/suggestions?${new URLSearchParams({ q: query })}`,
  /* Les séries d'un jeu, que le formulaire de dépôt demande au choix du jeu. */
  gameEditions: (gameId: GameId) => `/series?${new URLSearchParams({ jeu: GAME_SEGMENT[gameId] })}`,
  /* La tâche quotidienne, que Vercel Cron appelle avec son secret
     (vercel.json) : le cycle de vie des annonces, puis le ménage des photos. */
  dailyTasks: "/taches/quotidiennes",

  /* La page d'un jeu est une adresse et non un paramètre : /pokemon se lit,
     se partage, prolonge les pages de ville (/pokemon/avignon, qui
     répondait quand /pokemon tombait en 404), et laisse robots.txt écarter
     les combinaisons de filtres d'une seule règle. Elle a vécu sur
     /annonces?jeu=pokemon, qui redirige désormais ici. */
  game: (gameId: GameId) => `/${GAME_SEGMENT[gameId]}`,
  gameCity: (gameId: GameId, citySlug: string) => `/${GAME_SEGMENT[gameId]}/${segment(citySlug)}`,
  /* La liste d'un jeu, ou de tous. */
  listingsFor: (gameId: GameId | null | undefined) => (gameId ? `/${GAME_SEGMENT[gameId]}` : "/annonces"),
  /* Une annonce et une demande vivent sous leur liste, un profil sous son
     nom commun. */
  listing: (slug: string) => `/annonces/${segment(slug)}`,
  wanted: (slug: string) => `/recherches/${segment(slug)}`,
  profile: (username: string) => `/profil/${segment(username)}`,
  profileReviews: (username: string) => `/profil/${segment(username)}#${REVIEWS_ANCHOR}`,
  conversation: (conversationId: string) => `/messages/${segment(conversationId)}`,
  /* Écrire au vendeur d'un lot, ou proposer un lot à qui cherche. */
  contactSeller: (listingSlug: string) => withParam("/messages/nouveau", ROUTE_PARAM.aboutListing, listingSlug),
  proposeListing: (wantedSlug: string) => withParam("/messages/nouveau", ROUTE_PARAM.aboutWanted, wantedSlug),
  /* Déposer un lot en réponse à une demande. */
  depositFor: (wantedSlug: string) => withParam("/deposer", ROUTE_PARAM.forWanted, wantedSlug),
  editListing: (slug: string) => `/mon-compte/annonces/${segment(slug)}/modifier`,
  editWanted: (slug: string) => `/mon-compte/recherches/${segment(slug)}/modifier`,
  deal: (dealId: string) => `/mon-compte/transactions/${segment(dealId)}`,
  dealReviews: (dealId: string) => `/mon-compte/transactions/${segment(dealId)}#${REVIEWS_ANCHOR}`,
  /* Se connecter, ou créer son compte, puis revenir là où l'on était. Le
     retour par défaut — l'accueil du compte — ne s'écrit pas. */
  signInThenReturn: (returnTo: string) =>
    returnTo === "/mon-compte" ? "/connexion" : withParam("/connexion", ROUTE_PARAM.returnTo, returnTo),
  signUpThenReturn: (returnTo: string) =>
    returnTo === "/mon-compte" ? "/inscription" : withParam("/inscription", ROUTE_PARAM.returnTo, returnTo),
};

/* Le chemin de retour après connexion : un chemin de ce site, ou l'accueil
   du compte. Jamais une autre adresse — « //site-piege.example » et
   « /\site-piege.example » en sont une pour un navigateur, et une connexion
   qui y renverrait ferait du site le premier maillon d'un hameçonnage. Le
   paramètre arrive de l'URL : il se lit comme une saisie, pas comme une
   promesse. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return routes.account;
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return routes.account;
  const base = "https://retour.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return routes.account;
  }
  if (url.origin !== base) return routes.account;
  /* Le contrôle porte aussi sur le chemin normalisé : « /..//site-piege.example »
     devient « //site-piege.example » une fois les « .. » résolus, que le
     navigateur lirait comme une autre adresse. Le premier contrôle ne voyait
     que la saisie. */
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (url.pathname.startsWith("//") || new URL(path, base).origin !== base) return routes.account;
  /* Revenir sur la connexion elle-même tournerait en rond. */
  if (url.pathname === routes.signIn || url.pathname === routes.signUp) return routes.account;
  return path;
}
