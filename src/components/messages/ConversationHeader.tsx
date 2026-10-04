import Link from "next/link";
import type { SellerSummary } from "@/types/profile";
import { ConversationActions } from "@/components/messages/ConversationActions";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { ProBadge } from "@/components/pro/ProBadge";
import { Rating } from "@/components/ui/Rating";
import { routes } from "@/lib/routes";

/* La tête du fil : avec qui l'on parle — c'est le titre de la page —, et
   les gestes pour en sortir. Sur téléphone, un retour vers la liste : le
   volet des conversations n'y est pas affiché. */
export function ConversationHeader({ other, conversationId }: { other: SellerSummary; conversationId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Link href={routes.inbox} className="inline-flex items-center gap-1.5 text-[length:var(--text-md)] font-semibold lg:hidden">
        <Icon name="arrowLeft" size={16} />
        Conversations
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initials={other.avatarInitials} />
          <div className="min-w-0">
            <h1 className="display display-h2 display-user flex items-center gap-2">
              <Link href={routes.profile(other.username)} className="min-w-0 underline-offset-4 hover:underline">
                {other.username}
              </Link>
              {other.isPro ? <ProBadge /> : null}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[length:var(--text-sm)] text-[var(--muted)]">
              <Rating ratingAvg={other.ratingAvg} ratingCount={other.ratingCount} />
              <span className="mono">{other.city}</span>
            </p>
          </div>
        </div>
        <ConversationActions conversationId={conversationId} otherUsername={other.username} />
      </div>
    </div>
  );
}
