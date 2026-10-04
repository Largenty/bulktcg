/* Une adresse montrée à demi : sa première lettre, puis le domaine entier —
   de quoi reconnaître la sienne et repérer une faute de frappe dans le
   domaine (« gmial.com »), sans l'écrire en clair. null pour ce qui n'a pas
   la forme d'une adresse. */
export function maskEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  const [first] = Array.from(email);
  if (at < 1 || at === email.length - 1 || first === undefined) return null;
  return `${first}•••${email.slice(at)}`;
}

/* La forme d'une adresse masquée : un cookie se relit comme une saisie. */
export const MASKED_EMAIL = /^[^\s@•]•••@[^\s@<>]+\.[^\s@<>]+$/u;
