import { serializeJsonLd } from "@/lib/structured-data";

/* Un bloc de données structurées. Un <script> natif et non next/script :
   c'est une donnée, pas du code — le navigateur ne l'exécute pas, et la
   CSP ne le concerne donc pas. La sérialisation échappe « < », pour qu'un
   titre de vendeur ne puisse pas fermer la balise. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
