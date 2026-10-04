import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/* Vercel Cron appelle la tâche quotidienne avec « Authorization: Bearer
   <CRON_SECRET> ». La comparaison se fait en temps constant, sur deux
   empreintes de même longueur : une comparaison ordinaire s'arrête au
   premier caractère faux, et le temps de réponse dirait à un curieux
   combien il en a de justes. */
export function isCronAuthorized(header: string | null, secret: string): boolean {
  if (header === null) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
