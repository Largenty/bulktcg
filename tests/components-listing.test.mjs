import assert from "node:assert/strict";
import test from "node:test";

import { ListingSpecs } from "../src/components/listing/ListingSpecs.tsx";
import { ListingCard } from "../src/components/listing/ListingCard.tsx";
import { ListingGrid } from "../src/components/listing/ListingGrid.tsx";
import { getListingBySlug, getListings } from "../src/lib/data/listings.ts";
import { getWantedListings } from "../src/lib/data/wanted.ts";
import { WantedCard } from "../src/components/wanted/WantedCard.tsx";
import { toListingFormDefaults } from "../src/lib/form-defaults.ts";
import { render, text } from "./markup.mjs";

/* La vignette et la fiche d'une annonce, et la carte d'une demande : ce qui
   est affiché, et surtout ce qui ne l'est pas quand l'information manque. */

test("un lot scellé affiche un tiret pour ce qui n'a pas été mesuré, jamais zéro", async () => {
  const listing = await getListingBySlug("display-scelle-ecarlate-et-violet-151-avignon-07");
  assert.ok(listing, "annonce de démonstration introuvable");
  assert.equal(listing.cardCount, null);

  const markup = text(render(ListingSpecs({ listing })));
  assert.match(markup, /Non compté par le vendeur/);
  assert.match(markup, /Non pesé par le vendeur/);
  assert.doesNotMatch(markup, /0 cartes/);
  assert.doesNotMatch(markup, /0 kg/);
});

test("une baisse de prix affiche le pourcentage et l'ancien prix barré", async () => {
  const listing = await getListingBySlug("vrac-2000-cartes-magic-annees-2015-2020-bollene-06");
  assert.ok(listing);
  const markup = render(ListingCard({ listing, now: Date.now() }));
  /* La pastille dit la baisse, le pied barre l'ancien prix ; un lecteur
     d'écran entend les deux en toutes lettres. */
  assert.match(text(markup), /−27 % de baisse/);
  assert.match(markup, /<s>/);
  assert.match(text(markup), /Au lieu de \d/);
});

test("une annonce à la une porte son badge", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  assert.match(text(render(ListingCard({ listing, now: Date.now() }))), /À la une/);
});

test("le bandeau de la vignette tient les quatre informations sans en perdre", async () => {
  const listing = await getListingBySlug("classeur-one-piece-complet-op-01-a-op-04-l-isle-sur-la-sorgue-14");
  assert.ok(listing);
  const markup = text(render(ListingCard({ listing, now: Date.now() })));
  for (const expected of ["One Piece", "250 cartes", "NM", "VF"]) {
    assert.match(markup, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("la grille rend autant de vignettes que d'annonces reçues", async () => {
  const listings = await getListings({ limit: 6 });
  const markup = render(ListingGrid({ listings }));
  assert.equal(markup.split("<article").length - 1, listings.length);
});

test("le filet de couleur du jeu est bien posé sur la vignette", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  assert.match(render(ListingCard({ listing, now: Date.now() })), /background-color:var\(--pokemon\)/);
});

test("la forme courte de la langue tient dans le bandeau, la forme longue reste sur la fiche", async () => {
  const listing = await getListingBySlug("carton-8-kg-de-vrac-magic-tri-entierement-a-faire-valence-13");
  assert.ok(listing);
  assert.equal(listing.language, "mixed");

  const card = text(render(ListingCard({ listing, now: Date.now() })));
  assert.match(card, /Multi/);
  assert.doesNotMatch(card, /Langues mêlées/);

  const specs = text(render(ListingSpecs({ listing })));
  assert.match(specs, /Langues mêlées/);
});

test("une distance n'apparaît que si elle a été calculée", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  assert.doesNotMatch(text(render(ListingCard({ listing, now: Date.now() }))), / à /);
  /* Sous 10 km la décimale informe encore ; au-delà elle donne une fausse
     précision sur une distance à vol d'oiseau, donc on arrondit. */
  assert.match(text(render(ListingCard({ listing, distanceKm: 4.35, now: Date.now() }))), /à 4,4 km/);
  assert.match(text(render(ListingCard({ listing, distanceKm: 18.4, now: Date.now() }))), /à 18 km/);
  assert.match(text(render(ListingCard({ listing, distanceKm: 0.4, now: Date.now() }))), /à moins d'1 km/);
});

test("le filigrane nomme l'annonce et son vendeur", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  const { buildWatermarkLabel } = await import("../src/lib/watermark.ts");
  const label = buildWatermarkLabel(listing);

  assert.match(label, /^BK-[0-9A-Z]{6} · @lecomptoirdukado$/);
  assert.equal(buildWatermarkLabel(listing, { isCompact: true }), "@lecomptoirdukado");

  /* La vignette n'a pas la place de la référence : elle porte le pseudo,
     qui est la partie que l'acheteur compare au vendeur affiché. */
  const card = text(render(ListingCard({ listing, now: Date.now() })));
  assert.match(card, /@lecomptoirdukado/);
});

test("deux annonces n'ont jamais la même référence", async () => {
  const listings = await getListings({ includeSold: true, limit: 1000 });
  const references = listings.map((listing) => listing.reference);
  assert.equal(new Set(references).size, references.length);
});

test("la référence est citable sur la fiche, pas seulement dans le filigrane", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  const specs = text(render(ListingSpecs({ listing })));
  assert.match(specs, /Référence/);
  assert.match(specs, new RegExp(listing.reference));
});

test("le filigrane est masqué aux lecteurs d'écran, son contenu étant déjà lu ailleurs", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  const markup = render(ListingCard({ listing, now: Date.now() }));
  /* Le filigrane vit dans la ligne de crédit, masquée en bloc : le vendeur
     et sa note sont lus plus loin, dans une phrase complète. */
  const credit = markup.match(/<p[^>]*class="credit"[^>]*>[\s\S]*?<\/p>/)?.[0] ?? "";
  assert.match(credit, /^<p[^>]*aria-hidden="true"/);
  assert.match(credit, /class="watermark"/);
  assert.match(text(markup), /Proposé par lecomptoirdukado, note de 4,9 sur 5/);
});

test("une demande de recherche n'affiche une distance que si une origine existe", async () => {
  const [wanted] = await getWantedListings({ limit: 1 });
  const withoutOrigin = text(render(WantedCard({ wanted, now: Date.now() })));
  const withOrigin = text(render(WantedCard({ wanted, distanceKm: 8.4, now: Date.now() })));

  assert.doesNotMatch(withoutOrigin, / de vous/);
  assert.match(withOrigin, /à 8,4 km de vous/);
});

test("une vignette sans série ni produit n'affiche aucune pastille vide", async () => {
  const { ListingTagStrip } = await import("../src/components/listing/ListingTags.tsx");
  const empty = render(
    ListingTagStrip({ listing: { gameId: "magic", editions: [], tags: [] } }),
  );
  assert.equal(empty, "", "un bandeau vide est rendu au lieu de rien");
});

test("le bandeau de vignette replie au-delà de trois valeurs plutôt que de s'allonger", async () => {
  const { ListingTagStrip } = await import("../src/components/listing/ListingTags.tsx");
  const { getEditionById } = await import("../src/lib/editions.ts");
  const markup = text(
    render(
      ListingTagStrip({
        listing: {
          gameId: "pokemon",
          editions: ["pokemon-ev08", "pokemon-ev07", "pokemon-ev06"].map(getEditionById),
          tags: ["booster-box", "playmat"],
        },
      }),
    ),
  );
  assert.match(markup, /EV08/);
  assert.match(markup, /\+2/, "le repli n'indique pas combien de valeurs sont cachées");
  assert.doesNotMatch(markup, /Tapis de jeu/, "la cinquième valeur est affichée malgré le repli");
});

test("une fiche sans série le dit, au lieu de laisser un blanc", async () => {
  const { ListingTagDetails } = await import("../src/components/listing/ListingTags.tsx");
  const markup = text(
    render(ListingTagDetails({ listing: { gameId: "magic", editions: [], tags: [] } })),
  );
  /* Deux fois la même phrase, et c'est voulu : une case non cochée ne dit
     pas si le vendeur a répondu « non » ou s'il n'a pas répondu. */
  assert.equal(markup.match(/Non précisé par le vendeur/g).length, 2);
  assert.doesNotMatch(markup, /Rien d'autre/);
});

test("une annonce urgente le dit sur sa vignette, une annonce vendue ne le dit plus", async () => {
  const { isListingUrgent } = await import("../src/lib/listing-display.ts");
  const listing = await getListingBySlug("carton-5-kg-vrac-yu-gi-oh-non-trie-valence-24");
  assert.ok(listing?.urgentUntil, "l'annonce de démonstration n'est plus urgente");
  assert.equal(isListingUrgent(listing, Date.now()), true);
  assert.match(text(render(ListingCard({ listing, now: Date.now() }))), /Urgent/);

  /* Un lot vendu n'a plus rien d'urgent, même si l'option court encore. */
  const sold = { ...listing, status: "sold" };
  assert.equal(isListingUrgent(sold, Date.now()), false);
  assert.doesNotMatch(text(render(ListingCard({ listing: sold, now: Date.now() }))), /Urgent/);

  /* Une option expirée ne s'affiche plus, sans qu'on la retire à la main. */
  assert.equal(isListingUrgent({ ...listing, urgentUntil: "2020-01-01T00:00:00.000Z" }, Date.now()), false);
});

test("sur un lot réservé pour un autre, la fiche propose la liste d'attente et plus le contact", async () => {
  const { ViewerActions } = await import("../src/components/listing/ViewerActions.tsx");
  const { getListingForViewer } = await import("../src/lib/data/listings.ts");
  const { MOCK_LISTING_ROWS } = await import("../src/lib/mock/listings.mock.ts");
  const slug = (id) => MOCK_LISTING_ROWS.find((row) => row.id === id).slug;
  const actions = async (id) => text(render(await ViewerActions({ listing: await getListingForViewer(slug(id), "u-01") })));

  /* l-27 : réservé pour u-12 ; u-01 avait écrit avant, il relit son fil. */
  const reserved = await actions("l-27");
  assert.match(reserved, /Me prévenir s'il redevient disponible/);
  assert.match(reserved, /Relire votre conversation/);
  assert.doesNotMatch(reserved, /Contacter le vendeur/);
  /* l-16 : déjà inscrit, il peut se retirer. */
  assert.match(await actions("l-16"), /Ne plus attendre ce lot/);
  /* l-21 : son propre lot, réservé pour quelqu'un — le panneau du vendeur. */
  assert.match(await actions("l-21"), /Votre annonce/);
});

test("une vignette ouverte à l'échange le dit, les autres non ; la modification le restitue", async () => {
  const { getListings } = await import("../src/lib/data/listings.ts");
  const open = (await getListings({ openToTrade: true, limit: 1 }))[0];
  assert.ok(open, "aucun lot ouvert à l'échange");
  assert.match(text(render(ListingCard({ listing: open, now: Date.now() }))), /Échange possible/);
  assert.doesNotMatch(text(render(ListingCard({ listing: { ...open, openToTrade: false, tradeNote: null }, now: Date.now() }))), /Échange/);
  const defaults = toListingFormDefaults(open);
  assert.equal(defaults.openToTrade, "on");
  assert.equal(defaults.tradeNote, open.tradeNote ?? "");
});
