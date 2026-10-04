import "server-only";
import { resolveCommuneInput } from "@/lib/cities";
import type { City } from "@/lib/city-label";
import { z } from "@/lib/schemas/zod";

/* La commune d'un formulaire, vérifiée par le serveur seul : le référentiel
   — 35 000 communes — ne part pas dans le navigateur, et le schéma partagé
   n'y vérifie que la forme. Le nom et le code postal envoyés deviennent le
   couple du référentiel, tel que la base l'attend.

   Sans JavaScript, le code postal manque : un nom unique, un code postal
   d'une seule commune ou « Nom (code) » suffisent. Un homonyme demande de
   choisir, et le message dit lesquels. */

/* Le libellé d'un homonyme : le département les distingue. */
const describe = (city: City) => `${city.name} (${city.postalCode}, ${city.departmentName})`;

const SHOWN_CANDIDATES = 3;

export function ambiguousCommuneMessage(candidates: City[]): string {
  const shown = candidates.slice(0, SHOWN_CANDIDATES).map(describe).join(", ");
  const rest = candidates.length - SHOWN_CANDIDATES;
  return `Plusieurs communes portent ce nom : choisissez la vôtre dans la liste proposée — ${shown}${rest > 0 ? ` et ${rest} autres` : ""}.`;
}

export function withKnownCommune<Values extends { city: string; postalCode: string }>(schema: z.ZodType<Values>, unknownMessage: string) {
  return schema.transform((values, context): Values => {
    const resolution = resolveCommuneInput(values.city, values.postalCode);
    if (resolution.status === "found") return { ...values, city: resolution.city.name, postalCode: resolution.city.postalCode };
    context.addIssue({
      code: "custom",
      path: ["city"],
      message: resolution.status === "ambiguous" ? ambiguousCommuneMessage(resolution.candidates) : unknownMessage,
    });
    return z.NEVER;
  });
}
