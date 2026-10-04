import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { ListingLifecycleNote } from "../src/components/account/ListingLifecycleNote.tsx";
import { ListingCard } from "../src/components/listing/ListingCard.tsx";
import { ViewerActions } from "../src/components/listing/ViewerActions.tsx";
import { ContactSellerView } from "../src/components/messages/ContactSellerView.tsx";
import { NotificationList } from "../src/components/notifications/NotificationList.tsx";
import { isCronAuthorized } from "../src/lib/cron-auth.ts";
import { getListingById } from "../src/lib/data/listings.ts";
import { getNotificationsForUser } from "../src/lib/data/notifications.ts";
import { routes } from "../src/lib/routes.ts";
import { render, text } from "./markup.mjs";

/* Ce que le cycle de vie d'une annonce montre : la vignette d'une annonce
   remontée, la ligne de son vendeur — échéance, décompte, geste gratuit qui
   la relance, photos qui partent —, la cloche, et la porte de la tâche
   quotidienne. Les données de démonstration portent chaque cas : l-40
   expire dans quatre jours, l-41 a expiré, l-07 est vendue et archivée,
   l-06 est remontée. text() remplace chaque balise par une espace : la
   ponctuation qui suit un <strong> ou un <time> s'y lit précédée d'une
   espace. */

const now = Date.now();
const listingOf = async (id) => {
  const listing = await getListingById(id);
  assert.ok(listing, `${id} a disparu de la démonstration`);
  return listing;
};

test("une annonce remontée le dit sur sa vignette, à côté de sa vraie date de dépôt ; les autres non", async () => {
  const bumped = text(render(ListingCard({ listing: await listingOf("l-06"), now })));
  assert.match(bumped, /Remontée par son vendeur, option payante/);
  assert.match(bumped, /23 j/, "la vignette d'une annonce remontée ne garde plus sa date de dépôt");
  assert.doesNotMatch(text(render(ListingCard({ listing: await listingOf("l-01"), now }))), /Remontée/);
});

test("en ligne, une date discrète ; à l'approche de l'échéance, le décompte et le geste qui la prolonge", async () => {
  const quiet = render(ListingLifecycleNote({ listing: await listingOf("l-01"), now }));
  assert.match(text(quiet), /En ligne jusqu'au \d+ \S+ \d{4} : chaque modification ou changement de statut la prolonge de 90 jours/);
  assert.doesNotMatch(text(quiet), /Prolonger/);

  const soon = render(ListingLifecycleNote({ listing: await listingOf("l-40"), now }));
  assert.match(text(soon), /Expire dans 4 jours ?, le \d+ \S+ \d{4} ?\. Sans prolongation, elle quittera les listes/);
  assert.match(text(soon), /Prolonger de 90 jours Classeur 180 cartes Pokémon/, "le bouton ne nomme pas son annonce");
  assert.match(soon, /<time dateTime="\d{4}-\d{2}-\d{2}T/);
});

test("expirée, elle se remet en ligne d'un clic, et le vendeur sait quand ses photos partiront", async () => {
  const expired = text(render(ListingLifecycleNote({ listing: await listingOf("l-41"), now })));
  assert.match(expired, /Expirée le \d+ \S+ \d{4} : elle n'apparaît plus dans les listes/);
  assert.match(expired, /Sans remise en ligne, ses photos seront supprimées le \d+ \S+ \d{4} ?\./);
  assert.match(expired, /Remettre en ligne/);
});

test("vendue depuis plus de trente jours, elle est archivée : plus de photo, le texte et les avis restent", async () => {
  const sold = await listingOf("l-07");
  assert.deepEqual(sold.photos, [], "l'annonce archivée garde ses photos");
  const archived = text(render(ListingLifecycleNote({ listing: sold, now })));
  assert.match(archived, /Archivée depuis le \d+ \S+ \d{4} : une annonce archivée n'a plus de photos\. Le texte, le prix et les avis restent\./);
  assert.doesNotMatch(archived, /Prolonger|Remettre en ligne/, "une annonce vendue n'a rien à prolonger");
});

test("un visiteur lit qu'une annonce expirée n'est plus en ligne, sans bouton pour écrire au vendeur", async () => {
  /* La démonstration connecte u-01, vendeur de l-41 : vue par un autre, sa
     fiche ne propose plus le contact, ni l'adresse directe d'écriture. */
  const expired = await listingOf("l-41");
  const visitor = text(render(await ViewerActions({ listing: { ...expired, seller: { ...expired.seller, id: "u-02" } } })));
  assert.match(visitor, /Cette annonce n'est plus en ligne\. Son vendeur ne l'a pas prolongée/);
  assert.doesNotMatch(visitor, /Contacter le vendeur/);
  const contact = text(render(await ContactSellerView({ slug: expired.slug, viewerId: "u-02" })));
  assert.match(contact, /Cette annonce n'est plus en ligne/);
  assert.doesNotMatch(contact, /m'intéresse/, "le formulaire d'écriture s'affiche encore");
});

test("la cloche prévient d'une échéance sans dater ce que la prolongation changerait", async () => {
  const notifications = await getNotificationsForUser("u-01");
  const expiring = notifications.filter((notification) => notification.kind === "listing_expiring");
  assert.equal(expiring.length, 1);
  const markup = text(render(NotificationList({ notifications: expiring })));
  assert.match(markup, /« Classeur 180 cartes Pokémon Soleil et Lune » arrive à expiration : prolongez-la en un clic/);
  assert.match(markup, /Prolonger/);
});

test("la tâche quotidienne ne s'ouvre qu'au secret de Vercel Cron, et vercel.json l'appelle à son adresse", () => {
  const secret = "s".repeat(40);
  assert.equal(isCronAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isCronAuthorized(null, secret), false);
  assert.equal(isCronAuthorized(secret, secret), false, "le secret seul, sans « Bearer », ouvre la tâche");
  assert.equal(isCronAuthorized(`Bearer ${secret}x`, secret), false);
  const config = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "vercel.json"), "utf8"));
  assert.deepEqual(config.crons.map((cron) => cron.path), [routes.dailyTasks]);
});
