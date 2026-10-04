import "server-only";
import { z } from "@/lib/schemas/zod";

/* Le répertoire des entreprises, interrogé quand une boutique déclare son
   SIRET (Paramètres) : l'établissement existe-t-il, est-il en activité, et
   sous quel nom ? Côté serveur seulement, à l'envoi du formulaire — jamais
   pendant le rendu d'une page, ni depuis le navigateur.

   Deux sources, dans cet ordre :
   - l'API Recherche d'entreprises de l'État — sans clé, Licence Ouverte,
     7 requêtes par seconde. Une entreprise qui a refusé la diffusion de ses
     données n'y figure pas du tout : « absent » n'y veut pas dire « faux » ;
   - l'API Sirene de l'Insee, qui les rend avec leurs champs masqués
     (« [ND] »), quand une clé est configurée (INSEE_SIRENE_API_KEY). Sa
     réponse est reconstituée d'après la documentation et reste à vérifier
     avec une vraie clé (todo.md).

   Un SIRET prouve qu'un établissement existe, pas que la personne qui le
   tape le dirige : le compte s'engage par la déclaration qui l'accompagne,
   et un SIRET ne sert qu'un compte (profiles_one_account_per_siret).
   Chaque réponse est vérifiée par Zod ; un champ masqué devient null, jamais
   « [ND] » affiché sur un profil. */

export type RegisteredCompany = {
  siret: string;
  /* La raison sociale, ou le nom d'un entrepreneur individuel ; null quand
     le répertoire la masque. */
  legalName: string | null;
  /* L'enseigne ou le nom commercial de l'établissement, s'il en a un. */
  tradeName: string | null;
  isActive: boolean;
  source: "recherche-entreprises" | "sirene";
};

export type CompanyLookup =
  | { status: "found"; company: RegisteredCompany }
  /* Fermé : l'entreprise est cessée, ou cet établissement l'est. */
  | { status: "closed"; company: RegisteredCompany }
  /* Absent du répertoire public, et Sirene n'a pas pu trancher. */
  | { status: "unknown" }
  /* Panne, délai dépassé, limite atteinte : rien n'est conclu. */
  | { status: "unavailable" };

export type RegistryClient = {
  fetch: typeof fetch;
  /* null sans clé : seule la première source est interrogée. */
  inseeApiKey: string | null;
};

const SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search";
const SIRENE_URL = "https://api.insee.fr/api-sirene/3.11/siret";
const TIMEOUT_MS = 8_000;
const USER_AGENT = "BulkTCG (verification SIRET)";

/* Un champ masqué par le répertoire, ou vide : rien à afficher. */
function shown(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" || trimmed.includes("[ND]") ? null : trimmed;
}

const searchResponse = z.object({
  results: z.array(
    z.object({
      nom_complet: z.string().nullable(),
      nom_raison_sociale: z.string().nullable(),
      etat_administratif: z.string(),
      matching_etablissements: z
        .array(
          z.object({
            siret: z.string(),
            etat_administratif: z.string(),
            liste_enseignes: z.array(z.string()).nullable(),
            nom_commercial: z.string().nullable(),
          }),
        )
        .nullable(),
    }),
  ),
});

const sireneResponse = z.object({
  etablissement: z.object({
    siret: z.string(),
    uniteLegale: z.object({
      etatAdministratifUniteLegale: z.string(),
      denominationUniteLegale: z.string().nullable(),
      nomUniteLegale: z.string().nullable(),
      prenomUsuelUniteLegale: z.string().nullable(),
    }),
    periodesEtablissement: z.array(
      z.object({
        dateFin: z.string().nullable(),
        etatAdministratifEtablissement: z.string(),
        enseigne1Etablissement: z.string().nullable(),
        denominationUsuelleEtablissement: z.string().nullable(),
      }),
    ),
  }),
});

/* found ou closed, selon l'entreprise et l'établissement. */
function verdict(company: RegisteredCompany): CompanyLookup {
  return company.isActive ? { status: "found", company } : { status: "closed", company };
}

/* L'établissement dans les résultats de la recherche, s'il y est : une
   recherche par SIRET rend l'entreprise, et l'établissement qui correspond
   parmi les siens. */
export function readSearchResponse(siret: string, body: unknown): CompanyLookup {
  const parsed = searchResponse.safeParse(body);
  if (!parsed.success) return { status: "unavailable" };
  for (const result of parsed.data.results) {
    const establishment = result.matching_etablissements?.find((candidate) => candidate.siret === siret);
    if (!establishment) continue;
    return verdict({
      siret,
      legalName: shown(result.nom_raison_sociale) ?? shown(result.nom_complet),
      tradeName: shown(establishment.nom_commercial) ?? shown(establishment.liste_enseignes?.[0]),
      isActive: result.etat_administratif === "A" && establishment.etat_administratif === "A",
      source: "recherche-entreprises",
    });
  }
  return { status: "unknown" };
}

/* La réponse de Sirene : la période en cours de l'établissement — celle
   qui n'a pas de fin —, et son unité légale. */
export function readSireneResponse(siret: string, body: unknown): CompanyLookup {
  const parsed = sireneResponse.safeParse(body);
  if (!parsed.success || parsed.data.etablissement.siret !== siret) return { status: "unavailable" };
  const { uniteLegale, periodesEtablissement } = parsed.data.etablissement;
  const current = periodesEtablissement.find((period) => period.dateFin === null) ?? periodesEtablissement[0];
  const person = [shown(uniteLegale.prenomUsuelUniteLegale), shown(uniteLegale.nomUniteLegale)].filter(Boolean).join(" ");
  return verdict({
    siret,
    legalName: shown(uniteLegale.denominationUniteLegale) ?? (person === "" ? null : person),
    tradeName: shown(current?.enseigne1Etablissement) ?? shown(current?.denominationUsuelleEtablissement),
    isActive: uniteLegale.etatAdministratifUniteLegale === "A" && current?.etatAdministratifEtablissement === "A",
    source: "sirene",
  });
}

async function getJson(client: RegistryClient, url: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
  const response = await client.fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    redirect: "error",
  });
  return { status: response.status, body: response.ok ? await response.json() : null };
}

/* Le verdict sur un SIRET de forme valide (lib/siret.ts). Une panne de la
   première source ne se rattrape pas par la seconde : elle répond
   « indisponible », et la boutique réessaie. */
export async function lookupCompany(siret: string, client: RegistryClient): Promise<CompanyLookup> {
  try {
    const search = await getJson(client, `${SEARCH_URL}?${new URLSearchParams({ q: siret, page: "1", per_page: "1" })}`, {});
    if (search.status !== 200) return { status: "unavailable" };
    const found = readSearchResponse(siret, search.body);
    if (found.status !== "unknown" || client.inseeApiKey === null) return found;

    const sirene = await getJson(client, `${SIRENE_URL}/${siret}`, { "X-INSEE-Api-Key-Integration": client.inseeApiKey });
    if (sirene.status === 404) return { status: "unknown" };
    if (sirene.status !== 200) return { status: "unavailable" };
    return readSireneResponse(siret, sirene.body);
  } catch {
    return { status: "unavailable" };
  }
}
