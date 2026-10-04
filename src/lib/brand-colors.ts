/* Les couleurs d'une marque tierce ne sont pas les nôtres.

   C'est la seconde exception documentée à la règle « aucune valeur
   hexadécimale en dur », après lib/og-colors.ts, et pour une raison
   différente : celles-ci ne doivent surtout PAS suivre notre palette. Un
   token les rendrait modifiables avec le reste du thème, et le logo Google
   cesserait d'être le logo Google — ce que ses conditions d'utilisation
   interdisent explicitement.

   Elles ne servent qu'au tracé du logo, jamais à du texte : le contraste du
   bouton lui-même se mesure sur nos propres tokens. */
export const GOOGLE_MARK_COLOR = {
  blue: "#4285F4",
  green: "#34A853",
  yellow: "#FBBC05",
  red: "#EA4335",
} as const;
