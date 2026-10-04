import Link from "next/link";
import type { ReportTarget } from "@/types/report";
import { Icon } from "@/components/ui/Icon";
import { REPORT_TARGET_LABELS } from "@/lib/labels";
import { getReportUrl } from "@/lib/report-target";

/* Discret, toujours au même endroit, jamais sur ce qui vous appartient :
   c'est à la page de ne pas l'afficher sur sa propre annonce. */
export function ReportLink({ target, targetKey, isInverse = false }: { target: ReportTarget; targetKey: string; isInverse?: boolean }) {
  return (
    <Link
      href={getReportUrl(target, targetKey)}
      className={`inline-flex items-center gap-1.5 text-[length:var(--text-sm)] underline-offset-4 hover:underline ${
        isInverse ? "text-[var(--chalk-muted)] hover:text-[var(--chalk)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
      }`}
    >
      <Icon name="flag" size={14} />
      Signaler {REPORT_TARGET_LABELS[target]}
    </Link>
  );
}
