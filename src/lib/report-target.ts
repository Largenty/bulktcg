import type { ReportTarget } from "@/types/report";
import { routes } from "@/lib/routes";

/* Le paramètre d'URL de chaque cible, en français comme les autres : le lien
   « Signaler » se lit, et se partage à la modération. */
export const REPORT_PARAM: Record<ReportTarget, string> = {
  listing: "annonce",
  profile: "compte",
  conversation: "conversation",
  wanted: "demande",
};

/* Le formulaire de signalement d'une cible. */
export function getReportUrl(target: ReportTarget, targetKey: string): string {
  return `${routes.report}?${new URLSearchParams({ [REPORT_PARAM[target]]: targetKey })}`;
}
