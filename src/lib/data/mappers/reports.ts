import type { ReportReason, ReportTarget } from "@/types/report";
import type { ReportInsert } from "@/lib/data/rows";

/* Un détail vide n'est pas un détail : null, pas une chaîne vide. */
export function toReportInsert(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
}): ReportInsert {
  const details = input.details.trim();
  return {
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: details === "" ? null : details,
  };
}
