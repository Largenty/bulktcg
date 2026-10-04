import Link from "next/link";
import { OTHER_GAME_ID } from "@/types/game";
import type { Listing } from "@/types/listing";
import { TAG_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { QUERY_PARAM, buildListingHref } from "@/lib/listing-query";
import { routes } from "@/lib/routes";

type Facts = Pick<Listing, "editions" | "tags" | "gameId">;

/* Bandeau compact de la vignette : les codes de série, puis les produits.
   Pas de liens ici — le titre de la vignette porte déjà un lien qui couvre
   toute la carte, et un lien sous un autre lien ne se clique pas. */
export function ListingTagStrip({
  listing,
  limit = 3,
  className,
}: {
  listing: Pick<Listing, "editions" | "tags">;
  limit?: number;
  className?: string;
}) {
  const labels = [
    ...listing.editions.map((edition) => edition.code),
    ...listing.tags.map((tag) => TAG_LABELS[tag]),
  ];
  if (labels.length === 0) return null;

  const shown = labels.slice(0, limit);
  const hidden = labels.length - shown.length;

  return (
    <ul className={["list-none flex-wrap items-center gap-[5px]", className].filter(Boolean).join(" ")}>
      {shown.map((label) => (
        <li key={label} className="tag max-w-full">
          {label}
        </li>
      ))}
      {hidden > 0 ? (
        <li className="mono px-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">
          +{hidden}
          <span className="sr-only"> autres séries ou produits</span>
        </li>
      ) : null}
    </ul>
  );
}

/* Sur la fiche : tout est montré, et chaque pastille mène à la recherche
   correspondante. C'est ce qui rend le référentiel utile plutôt que
   décoratif. */
export function ListingTagDetails({ listing }: { listing: Facts }) {
  return (
    <dl className="grid gap-6 sm:grid-cols-2">
      <div>
        <dt className="label mb-2.5 text-[var(--muted)]">Séries</dt>
        <dd>
          {listing.editions.length > 0 ? (
            <ul className="flex list-none flex-wrap gap-2">
              {listing.editions.map((edition) => (
                <li key={edition.id}>
                  <Link
                    href={buildListingHref(routes.game(listing.gameId), {}, { [QUERY_PARAM.edition]: edition.id })}
                    className="tag h-auto min-h-[32px] gap-2 whitespace-normal py-1 hover:border-[var(--ink)]"
                  >
                    <span className="font-bold text-[var(--ink)]">{edition.code}</span>
                    <span className="font-body normal-case text-[var(--ink-soft)]">{edition.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            /* « Autre » n'a pas de liste de séries à cocher : ce n'est pas le
               vendeur qui n'a rien dit, c'est le formulaire qui ne demandait
               rien. */
            <NotSpecified note={listing.gameId === OTHER_GAME_ID ? "Nommées dans la description, s'il y a lieu" : undefined} />
          )}
        </dd>
      </div>

      <div>
        <dt className="label mb-2.5 text-[var(--muted)]">Produits inclus</dt>
        <dd>
          {listing.tags.length > 0 ? (
            <ul className="flex list-none flex-wrap gap-2">
              {listing.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={buildListingHref(routes.game(listing.gameId), {}, { [QUERY_PARAM.tag]: tag })}
                    className="tag min-h-[32px] border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--on-ink)] hover:bg-[var(--ink-soft)]"
                  >
                    {TAG_LABELS[tag]}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            /* « Rien d'autre que les cartes » serait une interprétation : une
               case non cochée ne dit pas si le vendeur a répondu non ou s'il
               n'a pas répondu. On affiche l'absence, on ne la traduit pas. */
            <NotSpecified />
          )}
        </dd>
      </div>
    </dl>
  );
}

function NotSpecified({ note = "Non précisé par le vendeur" }: { note?: string }) {
  return (
    <p className="text-[length:var(--text-lg)] font-semibold">
      {UNKNOWN_VALUE}
      <span className="ml-2 text-[length:var(--text-sm)] font-normal text-[var(--muted)]">{note}</span>
    </p>
  );
}
