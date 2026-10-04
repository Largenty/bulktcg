/* Le SIRET d'un établissement : quatorze chiffres, le SIREN de l'entreprise
   puis le numéro de l'établissement. Saisi par une boutique qui déclare son
   statut professionnel (Paramètres), vérifié ensuite auprès du répertoire
   des entreprises (lib/company-registry.ts) ; ici, rien que la forme, sans
   réseau, pour répondre tout de suite à une faute de frappe.

   La clé est celle de Luhn sur les quatorze chiffres. Une exception, que
   l'Insee documente : les établissements de La Poste (SIREN 356 000 000),
   trop nombreux pour la clé de Luhn, dont la somme des chiffres est un
   multiple de cinq. */

const LA_POSTE_SIREN = "356000000";

/* Ce qu'on tape : « 552 032 534 00703 », avec ou sans espaces, points ou
   tirets. Le reste est laissé tel quel, et la forme le refusera. */
export function normalizeSiret(input: string): string {
  return input.replace(/[\s.-]/g, "");
}

function luhnSum(digits: string): number {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[digits.length - 1 - index]);
    const doubled = index % 2 === 1 ? digit * 2 : digit;
    sum += doubled > 9 ? doubled - 9 : doubled;
  }
  return sum;
}

export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  if (siret.startsWith(LA_POSTE_SIREN)) {
    return [...siret].reduce((sum, digit) => sum + Number(digit), 0) % 5 === 0;
  }
  return luhnSum(siret) % 10 === 0;
}
