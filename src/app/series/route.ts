import { getEditionCatalog } from "@/lib/editions";
import { gameFromSegment } from "@/lib/routes";

/* Les séries d'un jeu, pour le formulaire de dépôt : il les demande quand le
   vendeur choisit son jeu (useGameEditions). Le référentiel reste sur le
   serveur, et aucune API extérieure n'est appelée ici — elles ne le sont que
   par scripts/editions-update.mjs.

   Rien de personnel : la réponse se garde une heure, dans le navigateur
   comme au CDN. Un jeu inconnu répond 404 ; « Autre » n'a pas de séries. */
export function GET(request: Request): Response {
  const gameId = gameFromSegment(new URL(request.url).searchParams.get("jeu"));
  const headers = { "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" };
  if (!gameId) return Response.json({ error: "Jeu inconnu." }, { status: 404, headers });
  return Response.json(getEditionCatalog(gameId), { headers });
}
