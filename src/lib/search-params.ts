/* Les paramètres d'URL tels que Next les remet à une page : une clé peut
   manquer, figurer une fois, ou plusieurs (« ?jeu=a&jeu=b »). Le type et
   ses lecteurs étaient recopiés dans une vingtaine de fichiers. */
export type ParamValue = string | string[] | undefined;

export type SearchParams = Record<string, ParamValue>;

/* La première valeur d'un paramètre répété : « ?jeu=a&jeu=b » se lit « a ». */
export function firstParam(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/* La valeur d'un critère, sans ses espaces de bord. Un paramètre vide n'est
   pas un critère : « ?q= » ne filtre rien. */
export function readParam(params: SearchParams, key: string): string | undefined {
  const value = firstParam(params[key])?.trim();
  return value ? value : undefined;
}

/* Une valeur retenue seulement si elle appartient à la liste : une valeur
   trafiquée ou périmée est ignorée, jamais transformée en filtre. */
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}
