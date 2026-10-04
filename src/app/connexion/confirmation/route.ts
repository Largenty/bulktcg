import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { confirmEmailLink } from "@/lib/data/auth-mutations";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { readEmailLink } from "@/lib/email-link";
import { routes } from "@/lib/routes";

/* Où mène le lien reçu par e-mail. Il ouvre la session du compte — les
   cookies partent avec la redirection —, puis mène au nouveau mot de passe,
   ou là d'où l'inscription est partie. Un lien qui a servi, a expiré ou
   n'en est pas un mène à une page qui le dit, et propose d'en recevoir un
   autre. Google restant désactivé, aucune route d'échange de code OAuth
   n'existe.

   Une adresse confirmée arrive dans son compte, dont le profil doit se
   lire tout de suite : la liste des profils en cache est expirée, sans
   rien resservir de périmé ({ expire: 0 } — updateTag n'existe que dans une
   action serveur). Un compte créé autrement que par le formulaire n'a
   jamais vu l'invalidation de l'inscription. */
export async function GET(request: NextRequest) {
  const link = readEmailLink(request.nextUrl.searchParams);
  const destination = link ? await confirmEmailLink(link) : null;
  if (destination && link?.type !== "recovery") revalidateTag(CACHE_TAGS.profiles, { expire: 0 });
  redirect(destination ?? routes.expiredLink);
}
