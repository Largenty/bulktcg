import "server-only";
import type { ReportReason, ReportTarget } from "@/types/report";
import { getConversationById } from "@/lib/data/conversations";
import { getListingForViewer } from "@/lib/data/listings";
import { toReportInsert } from "@/lib/data/mappers";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getProfileByUsername } from "@/lib/data/profiles";
import { getCurrentUserId } from "@/lib/data/session";
import { getWantedBySlug } from "@/lib/data/wanted";
import { performWrite } from "@/lib/data/write-seam";

/* Ce qu'on signale, retrouvé côté serveur à partir de ce que l'écran
   connaît. Une annonce réservée aux pros n'existe pas pour un particulier :
   il ne peut pas la signaler, pas plus qu'il ne peut la lire. */
async function resolveTarget(
  type: ReportTarget,
  key: string,
  viewerId: string,
): Promise<{ id: string; ownerId: string } | null> {
  if (type === "listing") {
    const listing = await getListingForViewer(key, viewerId);
    return listing ? { id: listing.id, ownerId: listing.seller.id } : null;
  }
  if (type === "wanted") {
    const wanted = await getWantedBySlug(key);
    return wanted ? { id: wanted.id, ownerId: wanted.buyer.id } : null;
  }
  if (type === "profile") {
    const profile = await getProfileByUsername(key);
    return profile ? { id: profile.id, ownerId: profile.id } : null;
  }
  const conversation = await getConversationById(key, viewerId);
  if (!conversation || (conversation.buyer.id !== viewerId && conversation.seller.id !== viewerId)) return null;
  const other = conversation.buyer.id === viewerId ? conversation.seller : conversation.buyer;
  return { id: conversation.id, ownerId: other.id };
}

export async function reportContent(input: {
  targetType: ReportTarget;
  targetKey: string;
  reason: ReportReason;
  details: string;
}): Promise<MutationResult<null>> {
  const reporterId = await getCurrentUserId();
  if (!reporterId) return { status: "unauthenticated" };

  const target = await resolveTarget(input.targetType, input.targetKey, reporterId);
  if (!target) return { status: "not-found" };
  if (target.ownerId === reporterId) {
    return { status: "invalid", fieldErrors: { reason: "On ne se signale pas soi-même." } };
  }

  /* check_report_target refait le contrôle côté base : on ne signale ni
     soi-même, ni ce qu'on ne peut pas lire. */
  const report = toReportInsert({ reporterId, targetType: input.targetType, targetId: target.id, reason: input.reason, details: input.details });
  return performWrite("reports.insert", report, null, ({ user }) => user.from("reports").insert(report));
}
