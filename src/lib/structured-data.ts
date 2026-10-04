import type { Listing, ListingStatus } from "@/types/listing";
import type { SellerProfile, SellerSummary } from "@/types/profile";
import { communePagePath } from "@/lib/cities";
import { CONDITION_LABELS, GAME_LABELS, LANGUAGE_LABELS, LOT_TYPE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

/* Les données structurées (schema.org, en JSON-LD) : ce que les moteurs de
   recherche et les moteurs de réponse lisent d'une page sans avoir à la
   deviner — le prix d'un lot, s'il est encore disponible, où le récupérer,
   qui le vend. Fonctions pures : components/seo/JsonLd les rend, et
   tests/structured-data.test.mjs les vérifie sans rendu.

   Même règle qu'à l'écran : une valeur absente est omise, jamais écrite 0
   ni devinée. Aucune note agrégée — celle d'un vendeur n'est pas celle du
   lot —, et aucune coordonnée : la ville et le code postal suffisent. */

type JsonLdNode = Record<string, unknown>;

/* Un titre de vendeur ne doit jamais pouvoir fermer la balise <script> qui
   porte le bloc : « < », « > » et « & » sont écrits en échappement
   Unicode, que JSON.parse relit à l'identique. */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/* L'accueil s'écrit sans barre finale, comme sa balise canonique. */
const absoluteUrl = (path: string) => (path === "/" ? SITE_URL : new URL(path, `${SITE_URL}/`).toString());
const ORGANIZATION_ID = `${SITE_URL}/#organisation`;

const AVAILABILITY: Record<ListingStatus, string> = {
  available: "https://schema.org/InStock",
  reserved: "https://schema.org/Reserved",
  sold: "https://schema.org/SoldOut",
};

export type BreadcrumbItem = { name: string; path: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/* Le fil d'Ariane d'une fiche, celui de l'écran : Annonces › jeu › commune
   › le lot — l'écran s'arrête à la commune, le titre suit en dessous. La
   commune se retrouve par son couple avec le code postal, comme toutes les
   pages de commune ; un couple inconnu du référentiel n'a pas de page, et
   son maillon est omis plutôt que de mener à une 404. */
export function listingBreadcrumbItems(listing: Pick<Listing, "gameId" | "city" | "postalCode" | "slug" | "title">): BreadcrumbItem[] {
  const communePath = communePagePath(listing.gameId, listing);
  return [
    { name: "Annonces", path: routes.listings },
    { name: GAME_LABELS[listing.gameId], path: routes.game(listing.gameId) },
    ...(communePath ? [{ name: listing.city, path: communePath }] : []),
    { name: listing.title, path: routes.listing(listing.slug) },
  ];
}

/* Un compte professionnel se présente sous son enseigne, forfait ou non ;
   un particulier sous son pseudo. */
function sellerNode(seller: Pick<SellerSummary, "username" | "isPro" | "companyName">): JsonLdNode {
  return seller.isPro
    ? { "@type": "Organization", name: seller.companyName ?? seller.username, url: absoluteUrl(routes.profile(seller.username)) }
    : { "@type": "Person", name: seller.username, url: absoluteUrl(routes.profile(seller.username)) };
}

function listingProperties(listing: Listing): JsonLdNode[] {
  const properties: JsonLdNode[] = [];
  if (listing.cardCount !== null) {
    properties.push({ "@type": "PropertyValue", name: "Nombre de cartes", value: listing.cardCount });
  }
  if (listing.weightKg !== null) {
    properties.push({ "@type": "PropertyValue", name: "Poids", value: listing.weightKg, unitCode: "KGM", unitText: "kg" });
  }
  properties.push({ "@type": "PropertyValue", name: "État", value: CONDITION_LABELS[listing.condition] });
  properties.push({ "@type": "PropertyValue", name: "Langue", value: LANGUAGE_LABELS[listing.language] });
  if (listing.editions.length > 0) {
    properties.push({ "@type": "PropertyValue", name: "Séries", value: listing.editions.map((edition) => edition.code).join(", ") });
  }
  return properties;
}

/* Une fiche d'annonce : le lot et son offre. « Autre » n'a pas de marque —
   ses lots couvrent des jeux différents, et le titre dit lequel. */
export function listingJsonLd(listing: Listing): JsonLdNode {
  const url = absoluteUrl(routes.listing(listing.slug));
  const images = listing.photos.flatMap((photo) => (photo.url ? [absoluteUrl(photo.url)] : []));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#lot`,
    name: listing.title,
    description: listing.description,
    sku: listing.reference,
    ...(images.length > 0 ? { image: images } : {}),
    category: `Cartes à collectionner > ${GAME_LABELS[listing.gameId]} > ${LOT_TYPE_LABELS[listing.lotType]}`,
    ...(listing.gameId === "other" ? {} : { brand: { "@type": "Brand", name: GAME_LABELS[listing.gameId] } }),
    additionalProperty: listingProperties(listing),
    offers: {
      "@type": "Offer",
      url,
      price: (listing.priceCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: AVAILABILITY[listing.status],
      itemCondition:
        listing.condition === "sealed" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      /* De la main à la main : ni envoi, ni frais de port. */
      availableDeliveryMethod: "https://schema.org/OnSitePickup",
      availableAtOrFrom: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: listing.city,
          postalCode: listing.postalCode,
          addressCountry: "FR",
        },
      },
      seller: sellerNode(listing.seller),
    },
  };
}

/* Plusieurs nœuds d'une même page dans un seul bloc : un seul @context. */
function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.map(({ "@context": _context, ...node }) => node),
  };
}

/* La fiche : le lot, et le fil d'Ariane qui y mène. */
export function listingPageJsonLd(listing: Listing): JsonLdNode {
  return graph(listingJsonLd(listing), breadcrumbJsonLd(listingBreadcrumbItems(listing)));
}

/* L'accueil : le site et l'organisation qui le publie. Pas de SearchAction :
   Google a retiré le champ de recherche des résultats, et « sameAs »
   attendra que les pages Facebook et Instagram du site existent. */
export function siteJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: absoluteUrl("/"),
        logo: absoluteUrl(routes.appleIcon),
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        name: SITE_NAME,
        url: absoluteUrl("/"),
        inLanguage: "fr-FR",
        description: SITE_DESCRIPTION,
        publisher: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}

/* La boutique d'un compte professionnel, forfait ou non : le statut se
   déclare avec le SIRET, et l'écran montre sa fiche boutique tant qu'il
   dure. Les horaires sont un texte libre — les forcer dans openingHours
   inventerait une précision que la boutique n'a pas donnée : ils sont
   omis. */
export function storeJsonLd(profile: SellerProfile): JsonLdNode | null {
  if (!profile.isPro || !profile.shop) return null;
  const { address, website } = profile.shop;
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: profile.companyName ?? profile.username,
    url: absoluteUrl(routes.profile(profile.username)),
    address: {
      "@type": "PostalAddress",
      ...(address ? { streetAddress: address } : {}),
      addressLocality: profile.city,
      postalCode: profile.postalCode,
      addressCountry: "FR",
    },
    ...(website ? { sameAs: [website] } : {}),
  };
}
