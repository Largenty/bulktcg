import "server-only";
import type { PhotoPurgeClaimRow } from "@/lib/data/rows";

/* Le ménage des fichiers photo, côté serveur (supabase/README.md, § 6). La
   base rend les fichiers à retirer — claim_photo_purge(), passé leurs délais
   de grâce, marqués pour que plus rien ne les accroche —, Cloudflare les
   retire, puis la base oublie ceux dont le retrait est confirmé
   (forget_purged_photos). Jamais dans l'autre ordre : une ligne effacée
   avant son fichier laisserait chez Cloudflare une image que plus rien ne
   désigne, et que plus aucun ménage ne trouverait.

   Lot après lot, jusqu'à un lot incomplet — il ne reste rien à prendre — ou
   la fin du temps imparti. Chaque appel, à la base comme à Cloudflare, a son
   délai, et aucun ne court au-delà de cette fin : Vercel arrête une fonction
   au bout de 300 secondes, et un passage arrêté net n'aurait rien oublié ni
   rien dit. Ce qui est retiré s'oublie donc au fil de l'eau, par paquets, et
   le journal suit. Un seul passage à la fois : le premier lot prend un bail,
   rendu à la fin (release_photo_purge).

   Les gestes arrivent en paramètres : le gestionnaire de route de la phase 2,
   appelé par Vercel Cron, les branche sur Supabase (clé de service, un
   identifiant de passage tiré au hasard), sur l'API de Cloudflare — DELETE
   /accounts/{id}/images/v1/{identifiant}, l'identifiant entièrement encodé
   comme la documentation l'exige —, sur le journal du serveur, sur
   l'horloge et sur AbortSignal.timeout ; les tests, sur des doublures. */

/* Ce que Cloudflare répond à un retrait : le statut HTTP, et les codes
   d'erreur de son corps JSON ({ success, errors: [{ code, message }] }). */
export type FileRemoval = { status: number; errorCodes: number[] };

export type PhotoPurgeSteps = {
  /* rpc("claim_photo_purge", { purge_run, batch_size }) — null quand un
     autre passage tient le bail (55P03). */
  claim: (batchSize: number, signal: AbortSignal) => Promise<PhotoPurgeClaimRow[] | null>;
  removeFile: (key: string, signal: AbortSignal) => Promise<FileRemoval>;
  /* rpc("forget_purged_photos", { file_keys }) */
  forget: (keys: string[], signal: AbortSignal) => Promise<void>;
  /* rpc("release_photo_purge", { purge_run }) */
  release: (signal: AbortSignal) => Promise<void>;
  /* Le journal du serveur : ce qui n'a pas pu être retiré, et le retard. */
  log: (line: string) => void;
  /* L'horloge, l'attente et le délai d'un appel, en millisecondes. */
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
  timeout: (milliseconds: number) => AbortSignal;
};

export const PHOTO_PURGE = {
  /* La borne de claim_photo_purge, que tests/schema-sync.test.mjs compare. */
  maxBatchSize: 1000,
  batchSize: 100,
  /* Aucun retrait ne commence ni ne court au-delà de 240 secondes ; seuls
     l'oubli des derniers fichiers et le bail rendu viennent après, chacun
     dans son délai — 260 secondes au pire, sous les 300 de Vercel. */
  budgetMs: 240_000,
  /* Un appel sans réponse au bout de dix secondes est abandonné ; son
     fichier revient en reprise. */
  callTimeoutMs: 10_000,
  /* Ce qui est fait s'oublie et se dit par paquets de 25 fichiers : arrêté
     net, un passage n'en perd qu'un paquet, que la reprise rattrape. */
  progressEvery: 25,
  /* Deux retraits par seconde au plus, soit 480 par passage : la moitié de
     la limite de l'API de Cloudflare — 1 200 requêtes par cinq minutes et
     par utilisateur, au-delà de quoi tous ses appels sont refusés cinq
     minutes, adresses de dépôt des vendeurs comprises. Le bail empêche deux
     passages de s'additionner. */
  minIntervalMs: 500,
  /* Un fichier pris sans être retiré revient une heure plus tard, et le
     bail d'un passage dure cinq minutes (claim_photo_purge, même
     comparaison) : plus que le pire passage, qui finit à 260 secondes. */
  retryAfterSeconds: 3600,
  leaseSeconds: 300,
} as const;

export type PhotoPurgeLimits = { batchSize: number; budgetMs: number; callTimeoutMs: number; progressEvery: number; minIntervalMs: number };

/* Le code que Cloudflare Images rend pour une image qu'il n'a pas. NON
   VÉRIFIÉ : la référence de l'API ne liste aucun code d'erreur, et 5404
   (« Image not found ») vient des forums de Cloudflare, pas de sa
   documentation. À confirmer au branchement sur les deux cas ordinaires du
   ménage : retirer deux fois la même image, et retirer l'identifiant d'une
   adresse de dépôt expirée sans avoir servi (un dépôt abandonné) — puis
   lire chaque réponse (supabase/README.md, § 6). */
export const CLOUDFLARE_IMAGE_NOT_FOUND = 5404;

const TOO_MANY_REQUESTS = 429;

/* Retiré, ou déjà parti. Seul « image introuvable » dit qu'un passage
   précédent l'a retiré sans pouvoir oublier sa ligne : un autre 404 — une
   route mal construite, un mauvais compte — ne prouve rien, et compté comme
   parti, il ferait oublier des lignes dont le fichier reste chez
   Cloudflare. */
export function isFileGone({ status, errorCodes }: FileRemoval): boolean {
  if (status >= 200 && status < 300) return true;
  return status === 404 && errorCodes.includes(CLOUDFLARE_IMAGE_NOT_FOUND);
}

export type PhotoPurgeReport = {
  removed: string[];
  /* Pris sans être retirés : ils reviennent en reprise au premier passage
     qui suit d'une heure au moins. */
  retried: string[];
  /* Le passage s'est arrêté avant d'avoir tout pris : temps écoulé, ou
     débit refusé par Cloudflare. */
  backlog: boolean;
};

/* Un retrait qui n'a pas abouti : la réponse de Cloudflare, ou aucune. */
type Failure = { key: string; retry: boolean; removal: FileRemoval | null; timedOut: boolean };

export async function purgePhotoFiles(steps: PhotoPurgeSteps, limits: PhotoPurgeLimits = PHOTO_PURGE): Promise<PhotoPurgeReport> {
  const { claim, removeFile, forget, release, log, now, sleep, timeout } = steps;
  const deadline = now() + limits.budgetMs;
  const report: PhotoPurgeReport = { removed: [], retried: [], backlog: false };
  let gone: string[] = [];
  let failures: Failure[] = [];
  let rateLimited = false;

  /* Le délai d'un appel pendant le passage : jamais au-delà de sa fin. */
  const inBudget = () => timeout(Math.max(0, Math.min(limits.callTimeoutMs, deadline - now())));

  /* Dire, puis oublier : le journal d'abord, qui ne peut pas échouer. */
  const recordProgress = async (signal: AbortSignal) => {
    for (const line of describeFailures(failures)) log(line);
    failures = [];
    if (gone.length === 0) return;
    await forget(gone, signal);
    report.removed.push(...gone);
    gone = [];
  };

  const run = async () => {
    let nextCallAt = now();
    let callTime = 0;
    let calls = 0;
    for (;;) {
      /* Ne prendre que ce que le temps restant permet de retirer, au rythme
         observé : un fichier pris et laissé là attend sa reprise une heure. */
      const pace = Math.max(limits.minIntervalMs, calls > 0 ? callTime / calls : 0);
      const room = Math.min(limits.batchSize, Math.floor((deadline - now()) / pace));
      if (room < 1) {
        report.backlog = true;
        return;
      }
      const batch = await claim(room, inBudget());
      if (batch === null) {
        log("Ménage des photos : un autre passage tient le bail, celui-ci s'arrête sans rien prendre.");
        return;
      }
      for (const [index, { file_key: key, retry }] of batch.entries()) {
        const wait = Math.max(0, nextCallAt - now());
        if (rateLimited || now() + wait >= deadline) {
          /* Le reste du lot attend sa reprise. */
          report.retried.push(...batch.slice(index).map((row) => row.file_key));
          report.backlog = true;
          return;
        }
        if (wait > 0) await sleep(wait);
        nextCallAt = now() + limits.minIntervalMs;
        const started = now();
        const signal = inBudget();
        const removal = await removeFile(key, signal).catch((): null => null);
        callTime += now() - started;
        calls += 1;
        if (removal !== null && isFileGone(removal)) {
          gone.push(key);
        } else {
          report.retried.push(key);
          failures.push({ key, retry, removal, timedOut: signal.aborted });
          /* Insister bloquerait aussi les dépôts des vendeurs. */
          if (removal?.status === TOO_MANY_REQUESTS) rateLimited = true;
        }
        if (gone.length + failures.length >= limits.progressEvery) await recordProgress(inBudget());
      }
      if (rateLimited) {
        report.backlog = true;
        return;
      }
      await recordProgress(inBudget());
      if (batch.length < room) return;
    }
  };

  let interruption: unknown = null;
  try {
    await run();
  } catch (error) {
    interruption = error;
  }
  /* Quoi qu'il soit arrivé : oublier ce qui est parti, dire le reste, rendre
     le bail — chacun dans son délai. */
  await recordProgress(timeout(limits.callTimeoutMs)).catch((error: unknown) => {
    log(`Ménage des photos : l'oubli de ${gone.length} fichier(s) retiré(s) a échoué (${describe(error)}) — ils reviendront en reprise, et Cloudflare répondra qu'ils sont partis.`);
  });
  await release(timeout(limits.callTimeoutMs)).catch((error: unknown) => {
    log(`Ménage des photos : le bail n'a pas pu être rendu (${describe(error)}) — il échoira de lui-même.`);
  });
  if (interruption !== null) {
    log(`Ménage des photos interrompu : ${describe(interruption)}. ${report.removed.length} fichier(s) retiré(s) et oublié(s) avant l'arrêt.`);
    throw interruption;
  }
  if (report.backlog) {
    const cause = rateLimited ? "Cloudflare refuse le débit (429)" : "temps écoulé avant la fin du lot";
    log(
      `Ménage des photos en retard : ${cause}, ${report.removed.length} fichier(s) retiré(s) — il en reste sans doute, que le prochain passage prendra. Si cela revient chaque jour, planifier le ménage plus souvent (supabase/README.md, § 6).`,
    );
  }
  return report;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* Une ligne par réponse de Cloudflare, et non par fichier : une panne de
   l'API ferait autrement mille lignes identiques. Une reprise qui échoue de
   nouveau est dite à part — c'est elle qui demande qu'on regarde. */
function describeFailures(failures: Failure[]): string[] {
  const groups = Map.groupBy(failures, ({ removal, timedOut }) => {
    if (removal === null) return timedOut ? "délai dépassé" : "sans réponse";
    return `HTTP ${removal.status}${removal.errorCodes.length > 0 ? `, codes ${removal.errorCodes.join(", ")}` : ""}`;
  });
  return [...groups].map(([answer, group]) => {
    const repeated = group.filter((failure) => failure.retry).length;
    const examples = group.slice(0, 3).map((failure) => failure.key).join(", ");
    return `Ménage des photos : ${group.length} fichier(s) non retiré(s) (${answer}), dont ${repeated} déjà en reprise — ${examples}. Ils reviendront en reprise au prochain passage.`;
  });
}
