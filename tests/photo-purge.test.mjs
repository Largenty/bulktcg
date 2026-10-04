import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { CLOUDFLARE_IMAGE_NOT_FOUND, PHOTO_PURGE, isFileGone, purgePhotoFiles } from "../src/lib/photo-purge.ts";

/* Le ménage des fichiers photo, côté serveur : Cloudflare d'abord, la base
   ensuite, lot après lot, dans le temps imparti, au débit que l'API de
   Cloudflare supporte, et chaque appel dans son délai. La sélection, ses
   délais, ses reprises, la taille des lots et le bail sont tenus par la base
   (supabase/tests/scenarios/11-photo-purge.sql) ; ici, l'ordre des gestes et
   le temps qu'ils prennent. */

const GONE = { status: 200, errorCodes: [] };
const NOT_FOUND = { status: 404, errorCodes: [CLOUDFLARE_IMAGE_NOT_FOUND] };
const SECOND = 1000;

const files = (count, retry = false) => Array.from({ length: count }, (_, index) => ({ file_key: `cf-${index + 1}`, retry }));

/* Une doublure : la base rend les lots d'une file, Cloudflare répond selon
   `answer` en `callMs(key)` millisecondes, et l'horloge avance à chaque
   attente comme à chaque appel. Un délai se pose comme AbortSignal.timeout :
   un appel plus long est abandonné à son échéance, et rejette. */
function harness({ queue, answer = () => GONE, callMs = () => 100, limits = {}, busy = false, forgetFails = 0 }) {
  let clock = 0;
  let failingForgets = forgetFails;
  const journal = [];
  const logs = [];
  const calls = [];
  const forgets = [];
  const pending = [...queue];
  const deadlines = new WeakMap();
  const steps = {
    claim: async (size) => {
      journal.push(`claim ${size}`);
      return busy ? null : pending.splice(0, size);
    },
    removeFile: async (key, signal) => {
      const { milliseconds, controller } = deadlines.get(signal);
      calls.push({ key, at: clock, timeout: milliseconds });
      journal.push(`remove ${key}`);
      const duration = callMs(key);
      if (duration > milliseconds) {
        clock += milliseconds;
        controller.abort(new DOMException("délai dépassé", "TimeoutError"));
        throw signal.reason;
      }
      clock += duration;
      const result = answer(key);
      if (result instanceof Error) throw result;
      return result;
    },
    forget: async (keys) => {
      if (failingForgets > 0) {
        failingForgets -= 1;
        throw new Error("base indisponible");
      }
      journal.push(`forget ${keys.join(",")}`);
      forgets.push({ at: clock, count: keys.length });
    },
    release: async () => {
      journal.push("release");
    },
    log: (line) => logs.push(line),
    now: () => clock,
    sleep: async (milliseconds) => {
      clock += milliseconds;
    },
    timeout: (milliseconds) => {
      const controller = new AbortController();
      deadlines.set(controller.signal, { milliseconds, controller });
      return controller.signal;
    },
  };
  return { steps, journal, logs, calls, forgets, elapsed: () => clock, limits: { ...PHOTO_PURGE, ...limits } };
}

test("une ligne n'est oubliée qu'après le retrait de son fichier chez Cloudflare, et le bail est rendu", async () => {
  const { steps, journal, limits } = harness({ queue: files(4) });
  const report = await purgePhotoFiles(steps, limits);
  assert.deepEqual(report, { removed: ["cf-1", "cf-2", "cf-3", "cf-4"], retried: [], backlog: false });
  assert.deepEqual(journal, ["claim 100", "remove cf-1", "remove cf-2", "remove cf-3", "remove cf-4", "forget cf-1,cf-2,cf-3,cf-4", "release"]);
});

test("lot après lot, jusqu'à un lot incomplet : il ne reste alors rien à prendre", async () => {
  const { steps, journal, limits } = harness({ queue: files(5), limits: { batchSize: 2 } });
  const report = await purgePhotoFiles(steps, limits);
  assert.deepEqual(report.removed, ["cf-1", "cf-2", "cf-3", "cf-4", "cf-5"]);
  assert.deepEqual(journal, [
    "claim 2", "remove cf-1", "remove cf-2", "forget cf-1,cf-2",
    "claim 2", "remove cf-3", "remove cf-4", "forget cf-3,cf-4",
    "claim 2", "remove cf-5", "forget cf-5",
    "release",
  ]);
});

test("seule « image introuvable » dit qu'un fichier est déjà parti ; tout autre échec se retente, et se dit", async () => {
  /* Un 404 sans ce code — une route mal construite, un mauvais compte —
     ferait oublier des lignes dont le fichier reste chez Cloudflare. */
  const answers = {
    "cf-1": NOT_FOUND,
    "cf-2": { status: 404, errorCodes: [7003] },
    "cf-3": { status: 500, errorCodes: [] },
    "cf-4": new Error("réseau coupé"),
    "cf-5": { status: 404, errorCodes: [] },
  };
  const { steps, journal, logs, limits } = harness({ queue: files(5), answer: (key) => answers[key] });
  const report = await purgePhotoFiles(steps, limits);
  assert.deepEqual(report, { removed: ["cf-1"], retried: ["cf-2", "cf-3", "cf-4", "cf-5"], backlog: false });
  assert.deepEqual(journal.slice(-2), ["forget cf-1", "release"]);
  /* Une ligne par réponse, pas une par fichier. */
  assert.equal(logs.length, 4);
  for (const answer of ["HTTP 404, codes 7003", "HTTP 500", "sans réponse", "HTTP 404)"]) {
    assert.ok(logs.some((line) => line.includes(answer)), `aucune ligne pour « ${answer} »`);
  }
});

test("une reprise qui échoue de nouveau est dite à part : c'est elle qui demande qu'on regarde", async () => {
  const { steps, logs, limits } = harness({ queue: files(2, true), answer: () => ({ status: 500, errorCodes: [] }) });
  await purgePhotoFiles(steps, limits);
  assert.match(logs.join("\n"), /2 fichier\(s\) non retiré\(s\) \(HTTP 500\), dont 2 déjà en reprise — cf-1, cf-2/);
});

test("un refus de débit arrête le passage : insister bloquerait aussi les dépôts des vendeurs", async () => {
  const answers = { "cf-1": GONE, "cf-2": { status: 429, errorCodes: [] } };
  const { steps, journal, logs, limits } = harness({ queue: files(6), answer: (key) => answers[key] ?? GONE, limits: { batchSize: 3 } });
  const report = await purgePhotoFiles(steps, limits);
  /* Le reste du lot attend sa reprise ; ce qui est parti est oublié. */
  assert.deepEqual(report, { removed: ["cf-1"], retried: ["cf-2", "cf-3"], backlog: true });
  assert.deepEqual(journal, ["claim 3", "remove cf-1", "remove cf-2", "forget cf-1", "release"]);
  assert.match(logs.join("\n"), /en retard\s:\sCloudflare refuse le débit \(429\)/);
});

test("deux retraits par seconde au plus : la moitié de la limite de l'API de Cloudflare", async () => {
  for (const duration of [100, 700]) {
    const { steps, calls, limits } = harness({ queue: files(5), callMs: () => duration });
    await purgePhotoFiles(steps, limits);
    const gaps = calls.slice(1).map((call, index) => call.at - (calls[index]?.at ?? 0));
    assert.ok(gaps.every((gap) => gap >= PHOTO_PURGE.minIntervalMs), `écarts de ${gaps.join(", ")} ms`);
    /* Un appel déjà lent n'attend pas en plus. */
    if (duration > PHOTO_PURGE.minIntervalMs) assert.ok(gaps.every((gap) => gap === duration));
  }
});

test("le passage tient dans son temps, ne prend que ce qu'il peut retirer, et dit son retard", async () => {
  const { steps, journal, logs, limits } = harness({ queue: files(50), limits: { budgetMs: 2000 } });
  const report = await purgePhotoFiles(steps, limits);
  /* 2 000 ms à deux retraits par seconde : quatre fichiers pris, quatre
     retirés — aucun pris pour rien, qui attendrait sa reprise une heure. */
  assert.deepEqual(journal.filter((entry) => entry.startsWith("claim")), ["claim 4"]);
  assert.deepEqual(report, { removed: ["cf-1", "cf-2", "cf-3", "cf-4"], retried: [], backlog: true });
  assert.match(logs.join("\n"), /Ménage des photos en retard\s:\stemps écoulé avant la fin du lot, 4 fichier\(s\) retiré\(s\)/);
});

test("des appels lents — 1, 3 ou 30 secondes — n'emportent pas le passage au-delà de son temps, et rien de fait n'est perdu", async () => {
  /* La relecture : à 3 secondes par retrait, un lot de cent finissait à
     300 secondes, l'âge où Vercel arrête une fonction, sans avoir rien
     oublié ni rien dit. */
  const vercelLimitMs = 300 * SECOND;
  const worstEndMs = PHOTO_PURGE.budgetMs + 2 * PHOTO_PURGE.callTimeoutMs;
  for (const [duration, queued] of [[1 * SECOND, 50], [3 * SECOND, 200], [30 * SECOND, 50]]) {
    const { steps, calls, forgets, logs, elapsed, limits } = harness({ queue: files(queued), callMs: () => duration });
    const report = await purgePhotoFiles(steps, limits);
    const label = `${duration / SECOND} s par appel`;
    /* Aucun appel ne court au-delà du temps imparti, ni au-delà de son délai. */
    for (const call of calls) {
      assert.ok(call.timeout <= PHOTO_PURGE.callTimeoutMs, `${label} : délai de ${call.timeout} ms`);
      assert.ok(call.at + call.timeout <= PHOTO_PURGE.budgetMs, `${label} : un appel court jusqu'à ${call.at + call.timeout} ms`);
    }
    assert.ok(elapsed() <= worstEndMs && worstEndMs < vercelLimitMs, `${label} : fini à ${elapsed()} ms`);
    /* Ce qui est retiré s'oublie par paquets, au fil du passage. */
    assert.ok(forgets.every(({ count }) => count <= PHOTO_PURGE.progressEvery), `${label} : un paquet de plus de ${PHOTO_PURGE.progressEvery}`);
    assert.equal(forgets.reduce((sum, { count }) => sum + count, 0), report.removed.length, label);
    assert.equal(report.removed.length + report.retried.length, queued <= PHOTO_PURGE.batchSize ? queued : PHOTO_PURGE.batchSize, label);
    if (duration === 1 * SECOND) {
      assert.deepEqual([report.removed.length, report.backlog], [50, false], label);
      assert.deepEqual(forgets.map(({ at }) => at), [25 * SECOND, 50 * SECOND], label);
    }
    if (duration === 3 * SECOND) {
      /* Quatre-vingts retirés en 240 secondes ; le premier paquet est oublié
         à 75 secondes, pas à la fin. */
      assert.equal(report.removed.length, 80, label);
      assert.equal(forgets[0]?.at, 75 * SECOND, label);
      assert.equal(report.backlog, true, label);
    }
    if (duration === 30 * SECOND) {
      /* Chaque appel abandonné à dix secondes : vingt-quatre tentatives, et
         le journal le dit. */
      assert.equal(calls.length, PHOTO_PURGE.budgetMs / PHOTO_PURGE.callTimeoutMs, label);
      assert.equal(report.removed.length, 0, label);
      assert.match(logs.join("\n"), /24 fichier\(s\) non retiré\(s\) \(délai dépassé\)/, label);
    }
  }
});

test("le lot suivant se règle sur le rythme observé : rien n'est pris qui ne pourrait être retiré à temps", async () => {
  /* À 3 secondes par retrait, 20 secondes restantes ne valent que six
     fichiers : en prendre dix en laisserait quatre marqués pour une heure. */
  const { steps, journal, limits } = harness({ queue: files(30), callMs: () => 3 * SECOND, limits: { batchSize: 10, budgetMs: 50 * SECOND } });
  const report = await purgePhotoFiles(steps, limits);
  assert.deepEqual(journal.filter((entry) => entry.startsWith("claim")), ["claim 10", "claim 6"]);
  assert.deepEqual([report.removed.length, report.retried, report.backlog], [16, [], true]);
});

test("un autre passage tient le bail : celui-ci s'arrête sans rien prendre, et le dit", async () => {
  const { steps, journal, logs, limits } = harness({ queue: files(3), busy: true });
  const report = await purgePhotoFiles(steps, limits);
  assert.deepEqual(report, { removed: [], retried: [], backlog: false });
  assert.deepEqual(journal, ["claim 100", "release"]);
  assert.match(logs.join("\n"), /un autre passage tient le bail/);
});

test("une étape qui lève : ce qui est parti est oublié quand même, le bail rendu, l'arrêt dit, l'erreur remonte", async () => {
  const { steps, journal, logs, limits } = harness({ queue: files(3), forgetFails: 1 });
  await assert.rejects(purgePhotoFiles(steps, limits), /base indisponible/);
  assert.deepEqual(journal.slice(-2), ["forget cf-1,cf-2,cf-3", "release"]);
  assert.match(logs.join("\n"), /Ménage des photos interrompu\s:\sbase indisponible\. 3 fichier\(s\) retiré\(s\) et oublié\(s\)/);
});

test("rien à oublier, rien d'écrit en base, et aucun retard annoncé à tort", async () => {
  const { steps, journal, logs, limits } = harness({ queue: files(3), answer: () => ({ status: 503, errorCodes: [] }) });
  const report = await purgePhotoFiles(steps, limits);
  assert.ok(!journal.some((entry) => entry.startsWith("forget")));
  assert.equal(report.backlog, false);
  assert.ok(!logs.some((line) => line.includes("en retard")));
});

test("seuls un succès et « image introuvable » disent qu'un fichier n'est plus chez Cloudflare", () => {
  for (const status of [200, 204]) assert.equal(isFileGone({ status, errorCodes: [] }), true, String(status));
  assert.equal(isFileGone(NOT_FOUND), true);
  for (const removal of [
    { status: 404, errorCodes: [] },
    { status: 404, errorCodes: [7003] },
    ...[0, 400, 401, 403, 409, 429, 500, 503].map((status) => ({ status, errorCodes: [CLOUDFLARE_IMAGE_NOT_FOUND] })),
  ]) {
    assert.equal(isFileGone(removal), false, JSON.stringify(removal));
  }
});

test("les bornes du ménage tiennent dans ce que Vercel et Cloudflare imposent, et le guide les cite", () => {
  const { batchSize, maxBatchSize, budgetMs, callTimeoutMs, minIntervalMs, retryAfterSeconds, leaseSeconds } = PHOTO_PURGE;
  assert.ok(batchSize >= 1 && batchSize <= maxBatchSize);
  /* Le pire passage — le temps imparti, puis l'oubli des derniers fichiers
     et le bail rendu, chacun dans son délai — finit avant que Vercel arrête
     la fonction (300 secondes), et avant l'échéance de son bail. */
  assert.ok(budgetMs + 2 * callTimeoutMs < 300_000);
  assert.ok(budgetMs + 2 * callTimeoutMs < leaseSeconds * 1000);
  /* 1 200 requêtes par cinq minutes pour tout le compte : le seul passage
     que le bail admet n'en prend pas plus de la moitié. */
  assert.ok(300_000 / minIntervalMs <= 1200 / 2);
  /* Une reprise ne revient qu'après la fin certaine du passage qui l'a
     prise. */
  assert.ok(retryAfterSeconds > leaseSeconds);
  const guide = readFileSync(path.join(import.meta.dirname, "..", "supabase", "README.md"), "utf8");
  assert.ok(guide.includes(`${budgetMs / minIntervalMs} fichiers par passage`), "le guide ne cite pas la capacité d'un passage");
  assert.ok(guide.includes(String(CLOUDFLARE_IMAGE_NOT_FOUND)), "le guide ne cite pas le code « image introuvable »");
  /* Le code se vérifie sur les deux cas ordinaires du ménage : une image
     déjà retirée, et l'identifiant d'un dépôt abandonné, que Cloudflare n'a
     peut-être jamais reçu. */
  assert.match(guide, /retirer deux fois\s+la même image/);
  assert.match(guide, /l'identifiant d'une adresse de dépôt expirée sans avoir\s+servi/);
  /* Le guide ne propose pas de planifier le ménage plus souvent que son
     bail : « jusqu'à chaque minute » laissait s'additionner quatre passages,
     2 400 requêtes par cinq minutes (relecture du suivi). */
  const schedule = guide.match(/jamais plus souvent que toutes les (\w+)\s+minutes/);
  assert.ok(schedule, "le guide ne dit pas à quel rythme planifier le ménage");
  const MINUTES = { deux: 2, trois: 3, quatre: 4, cinq: 5, dix: 10, quinze: 15, trente: 30 };
  assert.ok((MINUTES[schedule[1]] ?? Number(schedule[1])) * 60 >= leaseSeconds, `toutes les ${schedule[1]} minutes, plus souvent que le bail`);
  assert.doesNotMatch(guide, /chaque minute/);
});
