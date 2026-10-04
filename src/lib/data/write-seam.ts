import "server-only";
import { notPersisted, saved, toMutationFailure, type FieldErrors, type MutationResult } from "@/lib/data/mutation-result";
import { adminClient, isSupabaseMode, userClient, type SupabaseClient } from "@/lib/data/source";

/* La couture de la phase 1.

   Il n'y a pas encore de base : chaque écriture passe par ici avec la charge
   exacte qu'elle enverra à Supabase — lignes construites par mappers.ts,
   identifiants vérifiés, autorisation contrôlée — et s'arrête là.

   Chercher « deferWrite » dans le projet donne la liste de ce qu'il reste à
   brancher en phase 2, et rien d'autre. Chaque appel est remplacé par la
   requête correspondante ; la fonction qui l'entoure garde sa signature,
   ses contrôles et son résultat.

   Phase 2 : chaque écriture passe par performWrite, qui garde la couture
   pour la démonstration et écrit dans Supabase dès que la base est
   configurée. Les trois écritures que le schéma prévoyait sans appelant en
   ont un : le fil marqué lu à son ouverture (messages.read), les réglages
   d'alerte (accountSettings.update), et la vue d'une fiche (listings.view),
   comptée avec la clé de service par une route que la fiche appelle. */
export type WriteOperation =
  | "listings.insert"
  | "listings.update"
  | "listings.status"
  | "listings.delete"
  | "listings.renew"
  | "wanted.insert"
  | "wanted.update"
  | "wanted.status"
  | "wanted.delete"
  | "conversations.insert"
  | "conversations.delete"
  | "messages.insert"
  | "deals.close"
  | "reviews.insert"
  | "listings.reserve"
  | "waitlist.insert"
  | "waitlist.delete"
  | "notifications.insert"
  | "notifications.read"
  | "blocks.insert"
  | "reports.insert"
  | "profiles.update"
  | "profiles.pro"
  | "profiles.leavePro"
  | "profiles.delete"
  | "messages.read"
  | "accountSettings.update"
  | "listings.view"
  | "auth.signIn"
  | "auth.signUp"
  | "auth.passwordReset"
  | "auth.passwordUpdate";

export async function deferWrite(operation: WriteOperation, payload: unknown): Promise<void> {
  void operation;
  void payload;
}

/* Les clients d'une écriture : celui de la personne, sous la RLS — le cas
   général —, et, pour ce qu'aucun rôle connecté n'a le droit d'écrire,
   l'administrateur, créé seulement si l'écriture le demande. */
export type WriteClients = { user: SupabaseClient; admin: () => SupabaseClient };

/* Une écriture, dans les deux phases. Démonstration : la couture, puis
   « not-persisted ». Phase 2 : la requête `execute`, puis « saved », ou
   l'échec traduit par toMutationFailure — `fieldErrorsFor` donne le message
   du champ concerné quand la base refuse une valeur. Une exception — réseau
   coupé, délai dépassé — devient un échec, jamais l'écran d'erreur : la
   saisie reste à l'écran.

     return performWrite("listings.status", { id, status }, { status }, ({ user }) =>
       user.from("listings").update({ status }).eq("id", id).select("id").single(),
     );

   Une mise à jour ou une suppression que la RLS écarte n'échoue pas : elle
   ne touche aucune ligne. D'où `.select("id").single()`, qui rend alors
   PGRST116, traduit en « introuvable ». La fonction qui appelle garde ses
   contrôles d'identité et de propriété, faits avant : la RLS les tient
   aussi, mais c'est elle qui dit « introuvable » sans aller-retour. */
export async function performWrite<T>(
  operation: WriteOperation,
  payload: unknown,
  data: T,
  execute: (clients: WriteClients) => PromiseLike<{ error: unknown }>,
  fieldErrorsFor?: (code: string) => FieldErrors | null,
): Promise<MutationResult<T>> {
  if (!isSupabaseMode()) {
    await deferWrite(operation, payload);
    return notPersisted(data);
  }
  try {
    const { error } = await execute({ user: await userClient(), admin: adminClient });
    return error ? toMutationFailure(error, fieldErrorsFor) : saved(data);
  } catch (error) {
    return toMutationFailure(error, fieldErrorsFor);
  }
}

/* Une écriture dont la réponse porte ce que l'appelant rend : l'identifiant
   d'une conversation ouverte, le lien d'une annonce déposée. Démonstration :
   `mockData`, comme performWrite ; phase 2 : `toData` sur la réponse. */
export async function performWriteReturning<R, T>(
  operation: WriteOperation,
  payload: unknown,
  mockData: T,
  execute: (clients: WriteClients) => PromiseLike<{ data: R | null; error: unknown }>,
  toData: (data: R | null) => T,
  fieldErrorsFor?: (code: string) => FieldErrors | null,
): Promise<MutationResult<T>> {
  if (!isSupabaseMode()) {
    await deferWrite(operation, payload);
    return notPersisted(mockData);
  }
  try {
    const { data, error } = await execute({ user: await userClient(), admin: adminClient });
    return error ? toMutationFailure(error, fieldErrorsFor) : saved(toData(data));
  } catch (error) {
    return toMutationFailure(error, fieldErrorsFor);
  }
}
