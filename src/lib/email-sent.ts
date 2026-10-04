import "server-only";
import { cookies } from "next/headers";
import { MASKED_EMAIL, maskEmail } from "@/lib/email-mask";
import { SITE_URL } from "@/lib/site";

/* L'adresse à laquelle un lien vient de partir, montrée à demi sur la page
   qui suit (« l•••@gmail.com ») : dans un cookie httpOnly de dix minutes,
   que seule cette page reçoit. Jamais dans l'adresse de la page, qui finit
   dans l'historique, les journaux et les en-têtes Referer. */
const COOKIE = "bulktcg-sent-to";
const MAX_AGE_SECONDS = 600;

export async function rememberEmailSentTo(email: string, page: string): Promise<void> {
  const masked = maskEmail(email);
  if (masked === null) return;
  (await cookies()).set(COOKIE, masked, { httpOnly: true, secure: SITE_URL.startsWith("https:"), sameSite: "lax", path: page, maxAge: MAX_AGE_SECONDS });
}

export async function readEmailSentTo(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value !== undefined && MASKED_EMAIL.test(value) ? value : null;
}
