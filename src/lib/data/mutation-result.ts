/* Ce que rend toute écriture de la couche données.

   « not-persisted » est l'état de la phase 1 : l'entrée a été validée côté
   serveur, l'autorisation vérifiée, et rien n'a été écrit parce qu'il n'y a
   pas encore de base. L'interface le dit tel quel, au lieu d'afficher une
   confirmation qui serait fausse. En phase 2, les mêmes fonctions rendent
   « saved » et l'interface n'a pas une ligne à changer : elle sait déjà
   afficher les deux.

   « not-found » couvre aussi ce qui existe mais n'appartient pas au
   demandeur : répondre « interdit » confirmerait que l'objet existe.

   « failed » et « rate-limited » sont les deux échecs qui ne tiennent pas à
   la demande elle-même : la base, le réseau ou le débit. Sans eux, une base
   indisponible n'avait aucun statut pour le dire — la couche données aurait
   levé, et l'écran d'erreur aurait remplacé la page, saisie comprise. */

export type FieldErrors = Partial<Record<string, string>>;

export type MutationResult<T = null> =
  | { status: "saved"; data: T }
  | { status: "not-persisted"; data: T }
  | { status: "invalid"; fieldErrors: FieldErrors }
  | { status: "unauthenticated" }
  | { status: "not-found" }
  /* Rien n'a été écrit : base injoignable, délai dépassé, coupure réseau,
     serveur redéployé entre deux clics. `retryable` dit si recommencer tel
     quel a une chance d'aboutir — une panne passagère, oui ; un refus de la
     base qu'aucun message ne traduit, non. */
  | { status: "failed"; retryable: boolean }
  /* Trop de demandes en peu de temps (audit de sécurité, M7) : rien n'a été
     écrit, et l'écran dit dans combien de temps réessayer. */
  | { status: "rate-limited"; retryAfterSeconds: number };

/* Le refus d'une écriture avant tout contrôle de fond : pas de session, ou
   un objet qui n'est pas à la personne connectée — « introuvable », jamais
   « interdit ». Assignable à toute MutationResult. */
export type AccessRefusal = Extract<MutationResult<never>, { status: "unauthenticated" | "not-found" }>;

export function notPersisted<T>(data: T): MutationResult<T> {
  return { status: "not-persisted", data };
}

/* La demande a été acceptée : enregistrée, ou, en phase 1, validée sans
   rien écrire. C'est la condition sur laquelle un écran avance — le statut
   choisi reste affiché, le récapitulatif s'ouvre. */
export function isAccepted<T>(result: MutationResult<T>): result is Extract<MutationResult<T>, { data: T }> {
  return result.status === "saved" || result.status === "not-persisted";
}

/* Un échec qui ne dit rien de la demande : la même, renvoyée plus tard,
   peut aboutir. L'écran garde donc la saisie et le geste sous la main. */
export function isTransientFailure(result: MutationResult<unknown>): boolean {
  return (result.status === "failed" && result.retryable) || result.status === "rate-limited";
}

/* Phase 2 : l'écriture a eu lieu. */
export function saved<T>(data: T): MutationResult<T> {
  return { status: "saved", data };
}

/* Les refus de la base qu'un message général suffit à dire, quand l'appelant
   n'en a pas de plus précis pour le champ concerné. */
const INVALID_MESSAGES: Record<string, string> = {
  "23514": "Une valeur ne respecte pas les règles du site.",
  "23505": "Cet élément existe déjà.",
  "23503": "Une valeur renvoie à un élément inconnu : commune, série ou lot.",
  "23502": "Un champ obligatoire manque.",
  "22P02": "Une valeur est mal formée.",
  "22023": "Une valeur est mal formée.",
};

/* Introuvable, ou interdit — que l'on ne distingue pas : dire « interdit »
   confirmerait que l'objet existe. 42501 est aussi le refus de la RLS. */
const NOT_FOUND_CODES = new Set(["42501", "P0002", "PGRST116"]);

/* Une session expirée ou absente, vue par PostgREST ou par Auth. */
const UNAUTHENTICATED_CODES = new Set(["PGRST301", "PGRST302", "PGRST303", "session_not_found", "session_expired", "bad_jwt", "no_authorization"]);

/* Ce qui tient à la base ou au réseau, et passera sans doute au second
   essai : délai dépassé, connexion perdue, ressources épuisées, conflit de
   concurrence, base qui redémarre. */
const RETRYABLE_CODE = /^(57014|08\w{3}|53\w{3}|40001|40P01|57P0[123])$/;

type ErrorLike = { name?: unknown; code?: unknown; status?: unknown };

/* L'échec d'une écriture de Supabase, traduit en statut (supabase/README.md,
   § 5). `invalid` reçoit le message du champ concerné quand l'appelant le
   connaît (`fieldErrorsFor`), un message général sinon. */
export function toMutationFailure(error: unknown, fieldErrorsFor?: (code: string) => FieldErrors | null): MutationResult<never> {
  const { name, code: rawCode, status } = (typeof error === "object" && error !== null ? error : {}) as ErrorLike;
  const code = typeof rawCode === "string" ? rawCode : "";
  if (status === 429 || /^over_\w+_rate_limit$/.test(code)) return { status: "rate-limited", retryAfterSeconds: 60 };
  const invalid = INVALID_MESSAGES[code];
  if (invalid !== undefined) return { status: "invalid", fieldErrors: fieldErrorsFor?.(code) ?? { form: invalid } };
  if (NOT_FOUND_CODES.has(code)) return { status: "not-found" };
  if (UNAUTHENTICATED_CODES.has(code)) return { status: "unauthenticated" };
  const isNetwork = error instanceof TypeError || name === "AbortError" || name === "TimeoutError" || name === "AuthRetryableFetchError";
  const isServerDown = typeof status === "number" && status >= 500;
  return { status: "failed", retryable: isNetwork || isServerDown || RETRYABLE_CODE.test(code) };
}
