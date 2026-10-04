/* Le lien reçu par e-mail — confirmer son adresse, choisir un nouveau mot
   de passe —, tel que les modèles du tableau de bord de Supabase le
   construisent (supabase/README.md, § 3) :
   /connexion/confirmation?token_hash=…&type=email, ou &type=recovery.

   Il arrive de l'URL : il se lit comme une saisie. Un type inconnu ou une
   empreinte hors format ne partent même pas vers Supabase. */

export type EmailLinkType = "email" | "signup" | "recovery";

export type EmailLink = { tokenHash: string; type: EmailLinkType };

/* « signup » est l'ancien nom de « email » pour une inscription, que des
   modèles d'e-mail écrits à la main portent encore. */
function isEmailLinkType(value: string | null): value is EmailLinkType {
  return value === "email" || value === "signup" || value === "recovery";
}

export function readEmailLink(params: URLSearchParams): EmailLink | null {
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash === null || !/^[A-Za-z0-9_-]{16,256}$/.test(tokenHash)) return null;
  if (!isEmailLinkType(type)) return null;
  return { tokenHash, type };
}
