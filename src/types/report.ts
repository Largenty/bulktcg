/* Un signalement : ce qu'on signale, et pourquoi. Les motifs sont une liste
   fermée — un champ libre seul ne se trie pas, et la modération doit
   pouvoir traiter d'abord les arnaques. Le détail, facultatif, précise. */

export const REPORT_TARGETS = ["listing", "profile", "conversation", "wanted"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["scam", "counterfeit", "misleading", "stolen_photos", "harassment", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
