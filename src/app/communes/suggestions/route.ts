import { resolveCommuneInput, searchCities } from "@/lib/cities";

/* Les communes proposées à un champ commune pendant la frappe (CityCombobox).
   Le référentiel — 35 000 communes, 2,5 Mo — reste sur le serveur ; le
   navigateur ne reçoit que six suggestions, et la commune que la saisie
   désigne sans ambiguïté, s'il y en a une : un code postal d'une seule
   commune, un nom unique, « Nom (code) ».

   Rien de personnel : la réponse se garde un jour, dans le navigateur comme
   au CDN. Ni page ni lien : les moteurs n'ont rien à y indexer. */
const MAX_QUERY_LENGTH = 80;
const SUGGESTIONS = 6;

export function GET(request: Request): Response {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const resolution = query ? resolveCommuneInput(query) : null;
  return Response.json(
    {
      match: resolution?.status === "found" ? resolution.city : null,
      suggestions: query ? searchCities(query, SUGGESTIONS) : [],
    },
    { headers: { "Cache-Control": "public, max-age=86400", "X-Robots-Tag": "noindex" } },
  );
}
