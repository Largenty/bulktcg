/* snake_case ⇄ camelCase, et rien d'autre ne fait cette conversion.

   Lecture : les lignes de la base deviennent le domaine au tout dernier
   moment. Les colonnes texte de Postgres ne portent aucune garantie de type :
   elles sont rétrécies, et une valeur inconnue lève au lieu d'être remplacée
   en silence — une dérive de schéma doit se voir tout de suite, pas produire
   une annonce à l'état « undefined ».

   Écriture : du formulaire validé vers les lignes à écrire. Les deux sens
   sont exercés dès la phase 1 — tests/mappers.test.mjs pour la lecture,
   tests/mappers-writes.test.mjs pour l'écriture — et le jour de la bascule,
   la couche données envoie ces objets tels quels à Supabase.

   Ce fichier est le point d'entrée ; chaque domaine a son module dans
   lib/data/mappers/. */

export { isActiveProRow, isProRow, toSellerProfile, toSellerSummary } from "@/lib/data/mappers/profiles";
export { toListing } from "@/lib/data/mappers/listings";
export {
  nextPreviousPriceCents,
  toListingEditionInserts,
  toListingInsert,
  toListingPhotoInserts,
  toListingStatusUpdate,
  toListingTagInserts,
  toListingUpdate,
} from "@/lib/data/mappers/listing-writes";
export { toWantedInsert, toWantedListing, toWantedStatusUpdate, toWantedUpdate } from "@/lib/data/mappers/wanted";
export {
  toBlockInsert,
  toConversation,
  toConversationInsert,
  toMessage,
  toMessageInsert,
} from "@/lib/data/mappers/messaging";
export { toCloseDealArgs, toDeal, toReview, toReviewInsert } from "@/lib/data/mappers/deals";
export {
  STORED_MATCH_COLUMNS,
  toMatchRecipient,
  toNotification,
  toStoredMatchSubject,
  toWantedMatchNotifications,
  type StoredListingForMatch,
} from "@/lib/data/mappers/notifications";
export { toReportInsert } from "@/lib/data/mappers/reports";
export { toLocationColumns } from "@/lib/data/mappers/shared";
