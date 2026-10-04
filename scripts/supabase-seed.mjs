/* Charge les données de démonstration dans le projet Supabase de .env —
   sans photos : elles arrivent avec Cloudflare Images, en phase 3.

   npm run supabase:seed                charge, ou complète ce qui manque
   npm run supabase:seed -- --delete    retire les comptes de démonstration,
                                        et par cascade tout ce qui en dépend

   Les lignes sont celles de la démonstration (src/lib/data/source.ts,
   TABLES), au format de la base. Les comptes s'appellent
   <pseudo>@bulktcg.example — un domaine réservé, aucun courriel ne part —
   et partagent un mot de passe tiré au premier passage, écrit dans .env
   (DEMO_ACCOUNTS_PASSWORD) et jamais affiché. Relancé, le script retrouve
   ses lignes à leurs identifiants (UUID v5 des identifiants de la
   démonstration) et n'ajoute que ce qui manque. Le plan et l'ordre sont dans
   scripts/supabase-seed/plan.mjs ; les écritures, dans database.mjs.

   Il tourne sous le crochet des tests, qui résout l'alias @/ et charge le
   TypeScript de src/ : node --import ./tests/alias-hook.mjs … */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { countDemoRows, deleteAccounts, readProfileStats, seedDemo } from "./supabase-seed/database.mjs";
import { buildSeedPlan, demoId, generateDemoPassword } from "./supabase-seed/plan.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const PASSWORD_VARIABLE = "DEMO_ACCOUNTS_PASSWORD";

/* Le mot de passe commun : celui de l'environnement, ou un neuf, ajouté à
   .env avec ce qu'il est. Il n'est jamais écrit ailleurs ni affiché. */
function demoPassword() {
  const known = process.env[PASSWORD_VARIABLE];
  if (known) return { password: known, isNew: false };
  const password = generateDemoPassword();
  const previous = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const separator = previous === "" || previous.endsWith("\n") ? "" : "\n";
  appendFileSync(
    ENV_FILE,
    `${separator}\n# Le mot de passe commun des comptes de démonstration chargés dans Supabase par\n` +
      "# npm run supabase:seed (adresses <pseudo>@bulktcg.example). Tiré au hasard au premier\n" +
      "# chargement : le changer ici ne change pas celui des comptes, sauf à le retirer pour\n" +
      "# qu'un nouveau soit tiré et posé sur chacun au passage suivant.\n" +
      `${PASSWORD_VARIABLE}=${password}\n`,
  );
  return { password, isNew: true };
}

/* Une connexion par mot de passe, comme le ferait le formulaire : le jeton
   rendu prouve que le compte s'ouvre, et n'est ni gardé ni affiché. */
async function canSignIn(url, publishableKey, email, password) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  return response.ok && typeof body.access_token === "string";
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table.padEnd(18)} ${count}`);
}

async function main() {
  const { values } = parseArgs({ options: { delete: { type: "boolean", default: false } } });
  nextEnv.loadEnvConfig(ROOT, true, { info() {}, error: console.error });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secretKey || !publishableKey) {
    throw new Error("Supabase n'est pas configuré : NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY et SUPABASE_SECRET_KEY, dans .env.");
  }
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { TABLES } = await import("../src/lib/data/source.ts");
  const plan = buildSeedPlan(TABLES);
  const allAccountIds = [...plan.accounts.map((account) => account.id), ...plan.deletedAccountReviews.map((entry) => entry.account.id)];

  if (values.delete) {
    const deleted = await deleteAccounts(admin, allAccountIds);
    console.log(`Comptes de démonstration retirés : ${deleted}.`);
    printCounts("Ce qu'il reste de la démonstration :", await countDemoRows(admin, plan));
    return;
  }

  const { password, isNew } = demoPassword();
  if (isNew) console.log(`Mot de passe des comptes de démonstration tiré et écrit dans .env (${PASSWORD_VARIABLE}).`);
  const steps = await seedDemo(admin, plan, { password, passwordIsNew: isNew, throwawayPassword: generateDemoPassword() });
  console.log("Ajouté par ce passage :");
  for (const [label, count] of steps) console.log(`  ${label.padEnd(28)} ${count}`);

  printCounts("Dans la base, pour la démonstration :", await countDemoRows(admin, plan));

  const mockById = new Map(TABLES.profiles.map((profile) => [demoId(profile.id), profile]));
  console.log("\nNotes et ventes, tirées des avis et des ventes chargés (démonstration entre parenthèses) :");
  for (const row of await readProfileStats(admin, plan.accounts.map((account) => account.id))) {
    const mock = mockById.get(row.id);
    const rating = row.rating_avg === null ? "—" : Number(row.rating_avg).toFixed(1);
    const mockRating = mock?.rating_avg === null || mock === undefined ? "—" : mock.rating_avg.toFixed(1);
    console.log(
      `  ${row.username.padEnd(20)} note ${rating} sur ${row.rating_count} avis (${mockRating} sur ${mock?.rating_count ?? "?"}) ; ventes ${row.sold_listing_count} (${mock?.sold_listing_count ?? "?"})`,
    );
  }

  const [first] = plan.accounts;
  if (first) {
    const ok = await canSignIn(url, publishableKey, first.email, password);
    console.log(`\nConnexion de ${first.email} avec le mot de passe de .env : ${ok ? "acceptée" : "REFUSÉE"}.`);
    if (!ok) process.exitCode = 1;
  }
}

await main();
