import "server-only";
import { lookupCompany, type CompanyLookup, type RegisteredCompany } from "@/lib/company-registry";
import { readInseeApiKey } from "@/lib/env";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getProfileById } from "@/lib/data/profiles";
import { getCurrentUserId } from "@/lib/data/session";
import { performWrite } from "@/lib/data/write-seam";
import type { ProStatusValues } from "@/lib/schemas/pro-status-form";

/* Le statut professionnel du compte connecté, et de personne d'autre : ces
   fonctions ne prennent pas d'identifiant, elles écrivent sur la session.

   Devenir professionnel : le SIRET, de forme déjà vérifiée par le schéma,
   est interrogé au répertoire des entreprises ; un établissement en
   activité fait passer le compte en « pro » avec sa raison sociale et la
   date de la vérification. Ces colonnes ne sont dans les droits d'aucun
   rôle connecté : la clé de service les écrit, ici seulement, après la
   vérification — un compte qui se déclarerait pro depuis la console
   n'aurait rien vérifié. Le forfait reste à part (pro_until). */

export type ProStatusResult = {
  siret: string;
  legalName: string | null;
  companyName: string;
};

/* Ce que dit chaque verdict du répertoire qui n'en est pas un. */
const REFUSALS: Record<Exclude<CompanyLookup["status"], "found" | "unavailable">, string> = {
  closed: "Cet établissement est fermé au répertoire des entreprises : indiquez le SIRET d'un établissement en activité.",
  unknown:
    "Ce SIRET n'apparaît pas au répertoire public des entreprises. Vérifiez-le ; une entreprise qui a refusé la diffusion de ses données ne se vérifie pas encore automatiquement ici.",
};

/* Le nom affiché à côté du pseudo : celui que la boutique a choisi, sinon
   l'enseigne du répertoire, sinon sa raison sociale. */
function chooseCompanyName(values: Pick<ProStatusValues, "companyName">, company: RegisteredCompany): string | null {
  const name = values.companyName || company.tradeName || company.legalName;
  return name ? name.slice(0, 80) : null;
}

export async function declareProStatus(
  values: ProStatusValues,
  lookup: (siret: string) => Promise<CompanyLookup> = (siret) =>
    lookupCompany(siret, { fetch, inseeApiKey: readInseeApiKey(process.env) }),
): Promise<MutationResult<ProStatusResult>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };
  const profile = await getProfileById(userId);
  if (!profile) return { status: "not-found" };
  if (profile.isPro) return { status: "invalid", fieldErrors: { siret: "Votre compte est déjà professionnel." } };

  const verdict = await lookup(values.siret);
  if (verdict.status === "unavailable") return { status: "failed", retryable: true };
  if (verdict.status !== "found") return { status: "invalid", fieldErrors: { siret: REFUSALS[verdict.status] } };

  const companyName = chooseCompanyName(values, verdict.company);
  if (companyName === null) {
    return { status: "invalid", fieldErrors: { companyName: "Le répertoire ne donne pas de nom à afficher : indiquez celui de votre boutique." } };
  }
  const update = {
    account_type: "pro",
    siret: values.siret,
    legal_name: verdict.company.legalName,
    pro_verified_at: new Date().toISOString(),
    company_name: companyName,
  };
  return performWrite(
    "profiles.pro",
    { id: userId, profile: update },
    { siret: values.siret, legalName: verdict.company.legalName, companyName },
    ({ admin }) => admin().from("profiles").update(update).eq("id", userId).eq("account_type", "individual").select("id").single(),
    (code) =>
      code === "23505"
        ? { siret: "Ce SIRET est déjà rattaché à un autre compte. Si personne d'autre ne devrait l'utiliser, signalez ce compte depuis son profil." }
        : null,
  );
}

/* Repasser en compte particulier : leave_pro_status (migration 16) refuse
   tant qu'un forfait court, et retire le statut, l'enseigne, la fiche
   boutique et ses liens ensemble. */
export async function leaveProStatus(): Promise<MutationResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };
  const profile = await getProfileById(userId);
  if (!profile?.isPro) return { status: "not-found" };
  if (profile.hasProPlan) {
    return { status: "invalid", fieldErrors: { status: "Votre forfait pro court encore : il se résilie d'abord, et le statut ensuite." } };
  }

  return performWrite("profiles.leavePro", { id: userId }, null, ({ user }) => user.rpc("leave_pro_status"));
}
