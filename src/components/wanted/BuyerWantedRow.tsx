import Link from "next/link";
import type { WantedListing } from "@/types/wanted";
import { removeWanted } from "@/app/actions/wanted";
import { ItemActions } from "@/components/account/ItemActions";
import { WantedStatusSwitcher } from "@/components/account/WantedStatusSwitcher";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatPrice } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { gameColorVariable, gameInkVariable } from "@/lib/game-style";
import { GAME_LABELS, LOT_TYPE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

type BuyerWantedRowProps = {
  wanted: WantedListing;
  /* Le croisement inverse, compté côté serveur. */
  matchCount: number;
};

/* La ligne de gestion d'une demande de recherche. Même structure que celle
   d'une annonce — statut, croisement, gestes — mais le bandeau de couleur
   pleine remplace la photo : même dans son tableau de bord, une recherche ne
   se lit pas comme un lot. */
export function BuyerWantedRow({ wanted, matchCount }: BuyerWantedRowProps) {
  const shareUrl = `${SITE_URL}${routes.wanted(wanted.slug)}`;

  return (
    <li className="grid gap-4 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-4 sm:grid-cols-[112px_minmax(0,1fr)] lg:grid-cols-[112px_minmax(0,1fr)_auto] lg:items-start">
      <p
        className="label hidden aspect-square flex-col justify-between rounded-[var(--radius-md)] p-3 font-semibold sm:flex"
        style={{ backgroundColor: gameColorVariable(wanted.gameId), color: gameInkVariable(wanted.gameId) }}
      >
        <Icon name="search" size={20} strokeWidth={2.4} />
        <span>{GAME_LABELS[wanted.gameId]}</span>
      </p>

      <div className="min-w-0">
        <h3 className="text-[length:var(--text-body)] font-semibold leading-snug">
          <Link href={routes.wanted(wanted.slug)} className="underline-offset-4 hover:underline">
            {wanted.title}
          </Link>
        </h3>
        <p className="mono mt-1.5 text-[length:var(--text-xs)] text-[var(--muted)]">
          {wanted.maxPriceCents === null ? "Sans budget annoncé" : `Jusqu'à ${formatPrice(wanted.maxPriceCents)}`}
          {" · "}
          {wanted.lotType === null ? "tout format" : LOT_TYPE_LABELS[wanted.lotType]}
          {" · "}
          {wanted.city} + {wanted.maxDistanceKm} km
          {wanted.fulfilledAt ? (
            <>
              {" · trouvé le "}
              <time dateTime={wanted.fulfilledAt}>{formatDate(wanted.fulfilledAt)}</time>
            </>
          ) : null}
        </p>

        {/* Le compteur ne s'affiche que sur une demande encore ouverte : sur une
            demande fermée, il inviterait à rouvrir une porte close. */}
        {matchCount > 0 && wanted.status === "open" ? (
          <Link
            href={routes.wanted(wanted.slug)}
            className="mt-3 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-3 py-1 text-[length:var(--text-sm)] font-semibold text-[var(--on-ink)] hover:bg-[var(--ink-soft)]"
          >
            <Icon name="sparkle" size={15} />
            {countLabel(matchCount, "lot")} en ligne {matchCount > 1 ? "y répondent" : "y répond"}
          </Link>
        ) : null}

        <div className="mt-4">
          <WantedStatusSwitcher wantedId={wanted.id} title={wanted.title} status={wanted.status} />
        </div>
      </div>

      <div className="sm:col-span-2 lg:col-span-1 lg:w-[260px]">
        <ItemActions
          shareUrl={shareUrl}
          editHref={routes.editWanted(wanted.slug)}
          itemName={wanted.title}
          onDeleteAction={removeWanted.bind(null, wanted.id)}
          deleteConsequence="Le lien permanent cessera de répondre, et les vendeurs qui l'ont mis de côté tomberont sur une page introuvable. Pour arrêter de recevoir des propositions sans casser le lien, passez plutôt la demande en « Trouvé »."
        />
      </div>
    </li>
  );
}
