/* Après un refus, le focus va au premier champ fautif dans l'ordre de
   l'écran — pas dans l'ordre du schéma —, pour qu'un lecteur d'écran comme
   un clavier arrive là où il faut corriger. Partagé par les dépôts et les
   formulaires du compte. */

export type FocusPlan = {
  /* L'ordre visuel des champs du formulaire. */
  order: readonly string[];
  /* Les champs dont l'élément porte un autre identifiant — le code postal
     n'a pas de champ à lui : il suit la commune choisie. */
  targets?: Record<string, string>;
};

export function focusFirstError(errors: Partial<Record<string, string>>, { order, targets = {} }: FocusPlan): void {
  const field = order.find((name) => name in errors);
  if (!field) return;
  const target = document.getElementById(targets[field] ?? field) ?? document.querySelector<HTMLElement>(`[name="${field}"]`);
  target?.focus();
}
