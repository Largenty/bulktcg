import type { MetadataRoute } from "next";
import { GAME_IDS } from "@/types/game";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

/* Les robots d'entraînement des modèles d'IA : la page d'accueil, rien de
   plus. Ils lisent le site pour entraîner un modèle et ne renvoient
   personne ; l'accueil suffit à dire ce qu'est BulkTCG. Nommés un par un :
   une règle sur « * » couperait aussi les aperçus de Facebook et de
   WhatsApp, et les moteurs de recherche.

   Google-Extended et Applebot-Extended ne sont pas des robots mais des
   jetons : ils refusent l'entraînement sans réduire l'exploration, qui est
   celle de Googlebot et d'Applebot, au service de la recherche.

   robots.txt est une demande, pas une barrière : un robot qui abuse l'ignore.
   Contre la surcharge, c'est la limitation de débit et le pare-feu de
   l'hébergeur qui protègent. */
export const AI_TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "FacebookBot",
  "Bytespider",
  "Amazonbot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "AI2Bot",
  "PanguBot",
  "Timpibot",
  "ImagesiftBot",
  "Omgilibot",
];

/* Les robots d'aperçu : ils ne lisent qu'une page, quand quelqu'un colle un
   lien. Une recherche filtrée partagée dans un groupe Facebook doit garder
   son aperçu : les combinaisons de filtres écartées plus bas ne les
   concernent pas. Les moteurs de recherche des assistants (OAI-SearchBot,
   ChatGPT-User, Claude-SearchBot, PerplexityBot…) suivent, eux, la règle
   commune : ils citent les annonces comme Google les trouve. */
export const LINK_PREVIEW_BOTS = [
  "facebookexternalhit",
  "Facebot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
  "TelegramBot",
  "WhatsApp",
];

/* Ce qui n'appartient qu'à un compte : rien à y trouver pour un robot. */
const PRIVATE_PATHS = [
  routes.deposit,
  routes.account,
  routes.inbox,
  routes.notifications,
  routes.signIn,
  routes.signUp,
  routes.passwordReset,
  routes.newPassword,
  routes.report,
];

/* Les listes filtrables. Leurs combinaisons de filtres — tri, prix, état,
   série, ville — se comptent par milliers, sont servies en noindex et
   rendues à chaque visite : leur exploration coûte sans rien apporter. La
   pagination reste ouverte, pour que les annonces se découvrent aussi par
   les liens. Jamais « /*? » : l'optimiseur d'images, les icônes et les
   images de partage portent eux aussi un paramètre. */
const LISTING_PATHS = [routes.listings, ...GAME_IDS.map(routes.game)];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        /* Les images de partage portent un paramètre (?<empreinte>) : la règle
           des combinaisons de filtres d'une page de ville les aurait écartées
           de Google. La règle la plus longue l'emporte : elles restent
           ouvertes. */
        allow: ["/", ...LISTING_PATHS.map((path) => `${path}?page=`), "/*/opengraph-image"],
        disallow: [
          ...PRIVATE_PATHS,
          ...LISTING_PATHS.map((path) => `${path}?`),
          ...GAME_IDS.map((gameId) => `${routes.game(gameId)}/*?`),
          `${routes.wantedListings}?`,
        ],
      },
      { userAgent: LINK_PREVIEW_BOTS, allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_TRAINING_CRAWLERS, allow: "/$", disallow: "/" },
    ],
    sitemap: `${SITE_URL}${routes.sitemap}`,
  };
}
