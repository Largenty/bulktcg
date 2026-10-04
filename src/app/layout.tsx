import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Mona_Sans, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { FragmentHistorySync } from "@/components/layout/FragmentHistorySync";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ThemeSync } from "@/components/layout/ThemeSync";
import { NONCE_HEADER } from "@/lib/csp";
import { INDEXABLE, OPEN_GRAPH_BASE } from "@/lib/metadata";
import { THEME_COLOR } from "@/lib/og-colors";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

/* Les quatre familles sont servies depuis le domaine : aucune requête ne
   part vers Google au chargement de la page. Space Grotesk pour les titres :
   l'équivalent libre le plus proche de la sans-serif d'Anthropic (Styrene B,
   aujourd'hui Anthropic Sans), qui est propriétaire. Science Gothic, en
   capitales larges, pour les libellés et les prix — le lettrage des
   étiquettes de gradation. Mona Sans pour le texte courant. Atkinson
   Hyperlegible Mono pour les codes, volumes et références : un zéro barré et
   des 1, I et l qu'on ne confond pas.

   Seul le sous-ensemble latin est préchargé : il couvre tout le français, œ,
   € et espaces insécables compris. Le latin étendu de Mona Sans et de Space
   Grotesk reste déclaré, et ne se télécharge que si la page en affiche un
   caractère — un pseudo, un titre d'annonce. Le précharger coûtait 34 Ko à
   chaque page pour du texte qu'aucune n'affiche d'emblée. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

/* Science Gothic ne compose que des capitales, des chiffres et des prix :
   elle est servie réduite à ces signes et à ses graisses et largeurs
   employées — 44 Ko au lieu de 94, le premier poste de chaque page. Le
   fichier se refait par scripts/fonts/subset-science-gothic.mjs, et
   tests/fonts.test.mjs vérifie qu'il couvre encore les libellés et les
   feuilles de style. Pas de police de repli ajustée : elle se calcule sur
   des minuscules que ce fichier n'a pas ; la pile de repli vit dans les
   jetons (--font-display). */
const science = localFont({
  src: "./fonts/science-gothic-caps.woff2",
  weight: "350 800",
  declarations: [{ prop: "font-stretch", value: "50% 120%" }],
  variable: "--font-science",
  display: "swap",
  adjustFontFallback: false,
});

const mona = Mona_Sans({
  subsets: ["latin"],
  variable: "--font-mona",
  display: "swap",
});

/* Absente de la table de métriques de Next, qui ne sait pas lui calculer
   une police de repli ajustée. Turbopack ne lit pas adjustFontFallback avant
   de la chercher, et avertissait à chaque build : une pile de repli
   explicite, la même que --font-mono, lui évite la recherche. */
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  display: "swap",
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "monospace"],
});

/* La barre du navigateur prolonge l'en-tête : blanche en clair, ardoise en
   sombre. */
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  /* « ./ » se résout contre le chemin de chaque page : une canonique et un
     og:url par défaut partout — l'accueil n'en avait pas. Une page qui
     fixe les siens les remplace. */
  alternates: { canonical: "./" },
  openGraph: { ...OPEN_GRAPH_BASE, url: "./" },
  robots: INDEXABLE,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /* Le nonce de cette réponse, posé par src/proxy.ts (voir lib/csp.ts) : sans
     lui, la CSP refuse le script de thème. Lire la requête rend chaque page
     dynamique, et c'est voulu : Next ne pose son propre nonce que sur une
     page rendue à la demande. */
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html
      lang="fr"
      className={`${spaceGrotesk.variable} ${science.variable} ${mona.variable} ${atkinsonMono.variable}`}
      /* Le script ci-dessous pose data-theme avant que React ne s'hydrate : le
         serveur, lui, ne connaît pas le thème. React doit accepter le DOM. */
      suppressHydrationWarning
    >
      <head>
        {/* Exécuté pendant l'analyse du HTML, avant la première peinture :
            sans lui, un thème imposé s'afficherait après coup. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeSync />
        <FragmentHistorySync />
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
