import type { NextConfig } from "next";
import { GAME_IDS } from "./src/types/game";
import { policyEnvironment } from "./src/lib/csp";
import { ICON_SIZES } from "./src/lib/icon-sizes";
import { GAME_SEGMENT, routes } from "./src/lib/routes";

/* Phase 2 : les photos des vendeurs sont servies par Cloudflare Images, dont
   le domaine entre dans l'optimiseur d'images comme dans la CSP. */
const { isHttps, photosHost } = policyEnvironment();

/* Les en-têtes de sécurité, posés sur toutes les réponses. Le site n'en
   posait aucun (audit du front, M1).

   Sauf la CSP : elle porte un nonce neuf à chaque réponse, et c'est
   src/proxy.ts qui la pose (voir lib/csp.ts). Écrite ici aussi, elle
   partirait en double — un second en-tête sans nonce, que le navigateur
   appliquerait en plus du premier, et qui refuserait tous les scripts. */
export const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /* Tout ce que le site n'emploie pas est refusé, y compris à une régie ou
     un script tiers qui s'y glisserait. Seules des fonctions que Chrome
     reconnaît : « bluetooth » écrivait un avertissement dans la console de
     chaque page, sans rien refuser. */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=(), serial=(), hid=(), display-capture=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  /* Deux ans, dès que l'adresse publique est en HTTPS — domaine de Vercel
     compris (lib/csp.ts) ; jamais sur http://localhost, où tourne le smoke. */
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  /* « X-Powered-By: Next.js » ne sert qu'à qui cherche une version à viser. */
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      /* Les pages et leurs ressources ne se chargent pas depuis un autre site
         (CORP). Sauf les images que d'autres affichent : l'optimiseur, les
         icônes et les images de partage, que Facebook, WhatsApp ou une
         messagerie vont chercher. */
      {
        source: "/:path((?!_next/image|icon|apple-icon|.*opengraph-image).*)",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-site" }],
      },
      /* Les icônes portent l'empreinte de leur contenu dans l'adresse
         (?679453bc…) : une nouvelle icône a une nouvelle adresse. Servies
         max-age=0 par défaut, elles étaient redemandées à chaque page. Les
         seules tailles dessinées : sur tout /icon/:size, la 404 d'une taille
         inconnue restait figée un an. */
      { source: `/icon/:size(${ICON_SIZES.join("|")})`, headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/apple-icon", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
  images: {
    /* Phase 2 : dès que les photos sont chez Cloudflare, chaque largeur du
       srcset reçoit la variante qui la couvre (lib/photo-loader.ts) au lieu
       de faire ré-optimiser par Next une image déjà ré-encodée, et une photo
       privée ne passe jamais par l'optimiseur, dont le cache est commun à
       tous les lecteurs. En phase 1, pas de chargeur : il éteindrait
       /_next/image, dont les photos d'Unsplash ont besoin. */
    ...(photosHost ? { loader: "custom" as const, loaderFile: "./src/lib/photo-loader.ts" } : {}),
    /* Les photos de démonstration sont hébergées par Unsplash. C'est le seul
       domaine externe autorisé en phase 1 : tout le reste (polices comprises)
       est servi depuis le domaine, et npm run smoke le vérifie. */
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      ...(photosHost ? [{ protocol: "https" as const, hostname: photosHost, pathname: "/**" }] : []),
    ],
    formats: ["image/avif", "image/webp"],
    /* 160 et 192 en plus des tailles par défaut : la miniature de 76 px et la
       vignette mobile de 104 px, en double densité, se téléchargeaient à
       256 px. */
    imageSizes: [32, 48, 64, 96, 128, 160, 192, 256, 384],
  },
  /* /mes-annonces est devenu un onglet du compte. La redirection est
     permanente et non un doublon de page : un lien collé dans une
     conversation il y a trois mois doit continuer de tomber au bon
     endroit, et c'est exactement ce que le produit promet par ailleurs. */
  async redirects() {
    return [
      { source: "/mes-annonces", destination: routes.accountListings, permanent: true },
      /* /pokemon/lots a été la page d'un jeu, puis /annonces?jeu=pokemon (qui
         redirige depuis sa propre page), et c'est aujourd'hui /pokemon. La
         redirection est permanente : un site qui promet des liens qui ne
         bougent pas ne casse pas les siens. La liste des jeux vient de
         GAME_IDS : recopiée ici à la main, elle en oubliait trois. */
      { source: `/:game(${GAME_IDS.map((gameId) => GAME_SEGMENT[gameId]).join("|")})/lots`, destination: "/:game", permanent: true },
      /* Les adresses d'une lettre sont devenues des mots : /a/, /r/ et /p/
         ne disaient rien à qui lisait le lien. Leurs images de partage
         suivent avec le reste du chemin. */
      { source: "/a/:path*", destination: `${routes.listings}/:path*`, permanent: true },
      { source: "/r/:path*", destination: `${routes.wantedListings}/:path*`, permanent: true },
      { source: "/p/:path*", destination: "/profil/:path*", permanent: true },
      /* Un jeu dont l'adresse s'écrit désormais en mots séparés, ou en
         français : /onepiece, /yugioh, /other, et leurs pages de ville. */
      ...GAME_IDS.filter((gameId) => GAME_SEGMENT[gameId] !== gameId).flatMap((gameId) => [
        { source: `/${gameId}`, destination: routes.game(gameId), permanent: true },
        { source: `/${gameId}/:path*`, destination: `${routes.game(gameId)}/:path*`, permanent: true },
      ]),
    ];
  },
};

export default nextConfig;
