import { isCronAuthorized } from "@/lib/cron-auth";
import { runListingLifecycle } from "@/lib/data/listing-lifecycle-mutations";
import { readCronSecret } from "@/lib/env";

/* La tâche quotidienne, appelée par Vercel Cron (vercel.json) avec
   « Authorization: Bearer <CRON_SECRET> ». Elle fait ce que le passage du
   temps demande d'écrire : prévenir le vendeur d'une annonce qui expire dans
   sept jours, retirer les photos d'une annonce archivée. L'expiration
   elle-même ne s'écrit pas — chaque lecture la déduit des dates. Le ménage
   des fichiers photo viendra s'y ajouter avec Cloudflare Images (phase 3,
   supabase/README.md, § 6).

   Sans secret configuré, ou sans le bon, elle ne fait rien et le dit par son
   statut : une route qu'on appelle sans droit n'apprend rien à personne. Ni
   page ni lien : les moteurs n'ont rien à y indexer. */
const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: Request): Promise<Response> {
  const secret = readCronSecret(process.env);
  if (secret === null) return Response.json({ error: "CRON_SECRET n'est pas configuré" }, { status: 503, headers: HEADERS });
  if (!isCronAuthorized(request.headers.get("authorization"), secret)) return new Response(null, { status: 401, headers: HEADERS });

  const lifecycle = await runListingLifecycle();
  if (lifecycle !== null) {
    console.info(
      `tâche quotidienne : ${lifecycle.warnedListings} vendeur(s) prévenu(s), ${lifecycle.archivedListings} annonce(s) archivée(s), ${lifecycle.removedPhotos} photo(s) retirée(s)`,
    );
  }
  return Response.json({ lifecycle }, { headers: HEADERS });
}
