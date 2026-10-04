import type { WantedListing } from "@/types/wanted";
import { GameBadge } from "@/components/listing/GameBadge";
import { WantedStatusBadge } from "@/components/wanted/WantedStatusBadge";
import { formatDate, formatPrice, formatRelativeTime } from "@/lib/format";

/* Le bloc qu'un vendeur lit en premier sur une demande : quel jeu, où elle
   en est, ce qui est cherché, et le budget — le « prix » d'une demande, écrit
   comme un plafond. Sans budget annoncé, on le dit en toutes lettres plutôt
   que d'afficher un tiret à la place du chiffre. */
export function WantedHeadline({ wanted }: { wanted: WantedListing }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <GameBadge gameId={wanted.gameId} size="md" />
        <WantedStatusBadge status={wanted.status} />
      </div>

      <h1 className="display text-[length:var(--text-h3)] sm:text-[length:var(--text-2xl)]">{wanted.title}</h1>

      <p className="text-[length:var(--text-md)] text-[var(--muted)]">
        {wanted.city} ({wanted.postalCode}) · déposée{" "}
        <time dateTime={wanted.createdAt}>{formatRelativeTime(wanted.createdAt, Date.now())}</time>
        {wanted.fulfilledAt ? (
          <>
            {" "}
            · trouvé le <time dateTime={wanted.fulfilledAt}>{formatDate(wanted.fulfilledAt)}</time>
          </>
        ) : null}
      </p>

      <div>
        <p className="label text-[var(--muted)]">Budget maximum</p>
        {wanted.maxPriceCents === null ? (
          <p className="mt-2 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
            <strong className="block text-[length:var(--text-xl)] font-semibold text-[var(--ink)]">Pas de budget annoncé</strong>
            L&apos;acheteur préfère qu&apos;on lui propose un prix.
          </p>
        ) : (
          <p className="price mt-2 text-[length:var(--number-3xl)] font-bold leading-none">
            ≤ {formatPrice(wanted.maxPriceCents)}
          </p>
        )}
      </div>
    </div>
  );
}
