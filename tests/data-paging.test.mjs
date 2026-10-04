import assert from "node:assert/strict";
import test from "node:test";
import { readAllPages } from "../src/lib/data/supabase-rows.ts";

/* La lecture d'une table entière par pages (readAllPages). Supabase rend au
   plus 1 000 lignes par réponse, sans erreur : lue d'un seul appel, une
   table plus longue perdait sa suite en silence. Ici, une table de
   PostgREST simulée : des lignes triées par clé, une page après un curseur,
   au plus `size` lignes — moins si la base plafonne plus bas (maxRows) —,
   et le compte total sur demande. */
function fakeTable(count, { maxRows = 1000, counted = true } = {}) {
  const rows = Array.from({ length: count }, (_, index) => ({ id: `id-${String(index).padStart(6, "0")}` }));
  const calls = [];
  const fetchPage = async (after, size) => {
    calls.push({ after, size });
    if (calls.length > 100) throw new Error("la lecture tourne sans fin");
    const start = after === null ? 0 : rows.findIndex((row) => row.id > after);
    const from = start === -1 ? rows.length : start;
    return { rows: rows.slice(from, from + Math.min(size, maxRows)), count: after === null && counted ? rows.length : null };
  };
  return { rows, calls, fetchPage };
}

const read = (table, pageSize = 500) => readAllPages(table.fetchPage, { cursor: "id", pageSize });

test("une table plus longue qu'une page se lit en entier, dans l'ordre, chaque page reprenant après la précédente", async () => {
  const table = fakeTable(1234);
  assert.deepEqual(await read(table), table.rows);
  assert.deepEqual(
    table.calls.map((call) => call.after),
    [null, table.rows[499]?.id, table.rows[999]?.id],
  );
});

test("une petite table se lit en une seule requête", async () => {
  const table = fakeTable(39);
  assert.equal((await read(table, 100)).length, 39);
  assert.equal(table.calls.length, 1);
});

test("une base qui plafonne sous la taille de page ne tronque rien : le compte dit ce qui manque", async () => {
  const table = fakeTable(1234, { maxRows: 300 });
  assert.deepEqual(await read(table), table.rows, "des pages courtes dès la première ont arrêté la lecture");
  assert.equal(table.calls.length, 5);
});

test("sans compte, une page courte clôt la lecture, et une page vide aussi", async () => {
  const short = fakeTable(120, { counted: false });
  assert.equal((await read(short, 100)).length, 120);
  assert.equal(short.calls.length, 2);

  const exact = fakeTable(200, { counted: false });
  assert.equal((await read(exact, 100)).length, 200);
  assert.equal(exact.calls.length, 3, "une table d'un nombre exact de pages se termine sur une page vide");
});

test("une ligne retirée pendant la lecture ne l'arrête pas trop tôt, ni ne la fait tourner sans fin", async () => {
  const table = fakeTable(150);
  const fetchFirst = table.fetchPage;
  table.fetchPage = async (after, size) => {
    const page = await fetchFirst(after, size);
    if (after === null) table.rows.splice(120, 1);
    return page;
  };
  assert.equal((await read(table, 100)).length, 149);
  assert.equal(table.calls.length, 3);
});

test("une base qui ne tient pas le curseur fait lever la lecture au lieu de la faire tourner", async () => {
  const table = fakeTable(1234);
  const stuck = { fetchPage: async (after, size) => table.fetchPage(null, size) };
  await assert.rejects(read(stuck), /Pagination bloquée sur id/);
});
