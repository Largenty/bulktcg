/* Rendu des composants pour les tests (pas de suffixe .test : le lanceur ne
   l'exécute pas). Le JSX réel passe par react-dom/server, et le texte est
   comparé tel qu'un lecteur le lit. */
import { renderToStaticMarkup } from "react-dom/server";

export const render = (element) => renderToStaticMarkup(element);

/* Le HTML sans ses balises, entités décodées et espaces resserrées : on
   compare du texte français lisible. */
export function text(markup) {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
