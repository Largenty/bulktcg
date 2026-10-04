/* Un nombre tel qu'on le tape en français : « 42,5 » vaut « 42.5 », et
   « 1 000 » vaut mille — l'espace des milliers, ordinaire, insécable ou
   fine, qu'un clavier ou un copier-coller y met. Elle rendait NaN : « 1 000
   cartes » était refusé. La règle était recopiée sept fois — schémas,
   brouillons, requêtes. Une saisie illisible rend NaN, que chaque appelant
   refuse à sa façon. */
export function parseDecimal(value: string): number {
  return Number(value.replace(/[\s\u00a0\u202f]/g, "").replace(",", "."));
}

/* Une quantité saisie : strictement positive, ou null. Un champ vide, « abc »
   ou « 0 » ne décrivent rien — et un aperçu n'en invente pas. */
export function parsePositiveDecimal(value: string): number | null {
  const parsed = parseDecimal(value);
  return value.trim() !== "" && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
