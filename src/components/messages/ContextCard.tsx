import Link from "next/link";
import type { ReactNode } from "react";
import type { Listing } from "@/types/listing";
import type { WantedListing } from "@/types/wanted";
import { GameBadge } from "@/components/listing/GameBadge";
import { ListingImage } from "@/components/listing/ListingImage";
import { StatusBadge } from "@/components/listing/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { ProBadge } from "@/components/pro/ProBadge";
import { Rating } from "@/components/ui/Rating";
import { formatPrice } from "@/lib/format";
import { LOT_TYPE_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { routes } from "@/lib/routes";

/* À côté du message, ce dont on parle : on n'écrit pas « bonjour, c'est pour
   le lot » sans le voir. */
function Frame({ children, person }: { children: ReactNode; person: WantedListing["buyer"] }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)]">
      {children}
      <div className="flex items-center gap-3 border-t-[length:var(--border-width)] border-[var(--line)] p-4">
        <Avatar initials={person.avatarInitials} size="sm" />
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold">{person.username}</span>
            {person.isPro ? <ProBadge /> : null}
          </p>
          <Rating ratingAvg={person.ratingAvg} ratingCount={person.ratingCount} />
        </div>
      </div>
    </div>
  );
}

export function ListingContextCard({ listing }: { listing: Listing }) {
  return (
    <Frame person={listing.seller}>
      <ListingImage gameId={listing.gameId} photo={listing.photos[0]} alt={listing.title} ratio="4 / 3" sizes="400px" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <GameBadge gameId={listing.gameId} />
          <StatusBadge status={listing.status} />
        </div>
        <Link href={routes.listing(listing.slug)} className="font-semibold leading-snug underline-offset-4 hover:underline">
          {listing.title}
        </Link>
        <p className="flex items-baseline justify-between gap-3">
          <span className="price text-[length:var(--number-md)] font-bold">{formatPrice(listing.priceCents)}</span>
          <span className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{listing.city}</span>
        </p>
      </div>
    </Frame>
  );
}

export function WantedContextCard({ wanted }: { wanted: WantedListing }) {
  return (
    <Frame person={wanted.buyer}>
      <div className="flex flex-col gap-2.5 p-4">
        <div>
          <GameBadge gameId={wanted.gameId} />
        </div>
        <Link href={routes.wanted(wanted.slug)} className="font-semibold leading-snug underline-offset-4 hover:underline">
          {wanted.title}
        </Link>
        <dl className="mono grid grid-cols-2 gap-2 text-[length:var(--text-xs)] text-[var(--ink-soft)]">
          <div>
            <dt className="text-[var(--muted)]">Budget</dt>
            <dd>{wanted.maxPriceCents === null ? UNKNOWN_VALUE : `≤ ${formatPrice(wanted.maxPriceCents)}`}</dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">Format</dt>
            <dd>{wanted.lotType === null ? "Tout format" : LOT_TYPE_LABELS[wanted.lotType]}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[var(--muted)]">Depuis</dt>
            <dd>
              {wanted.city}, jusqu&apos;à {wanted.maxDistanceKm} km
            </dd>
          </div>
        </dl>
      </div>
    </Frame>
  );
}
