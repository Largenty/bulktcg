import type { Listing } from "@/types/listing";
import { ListingSpecs } from "@/components/listing/ListingSpecs";
import { SaleTerms } from "@/components/listing/SaleTerms";
import { ListingTagDetails } from "@/components/listing/ListingTags";

/* Des titres de section plus petits que le titre de l'annonce : la
   hiérarchie se lit à la taille, pas seulement au balisage. */
const SECTION_TITLE = "display mb-4 text-[length:var(--text-xl)]";

/* Tout ce qui décrit le lot, dans une seule carte : on lit une description
   en regardant l'objet. La description d'abord — c'est le vendeur qui
   parle —, les listes ensuite. Le texte prend la largeur de la carte : il
   était bridé à 68 caractères, et laissait un tiers de la carte vide. */
export function ListingDetails({ listing, className }: { listing: Listing; className?: string }) {
  return (
    <div className={["panel flex min-w-0 flex-col gap-9", className].filter(Boolean).join(" ")}>
      <section>
        <h2 className={SECTION_TITLE}>Description</h2>
        <div className="flex flex-col gap-4 text-[length:var(--text-body)] leading-relaxed">
          {listing.description.split("\n\n").map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
        </div>
      </section>
      <section>
        <h2 className={SECTION_TITLE}>Séries et produits</h2>
        <ListingTagDetails listing={listing} />
      </section>
      <section>
        <h2 className={SECTION_TITLE}>Caractéristiques</h2>
        <ListingSpecs listing={listing} />
      </section>
      <section>
        <h2 className={SECTION_TITLE}>Conditions de la vente</h2>
        <SaleTerms seller={listing.seller} />
      </section>
    </div>
  );
}
