"use client";

import { usePathname } from "next/navigation";
import { PillList, type PillItem } from "@/components/ui/PillList";

export type AccountTab = Omit<PillItem, "isCurrent">;

/* Le seul motif de rester un composant client : savoir sur quel onglet on
   est. Une modification d'annonce reste rangée sous « Mes annonces ». */
export function AccountNav({ tabs }: { tabs: AccountTab[] }) {
  const pathname = usePathname();
  const current =
    tabs
      .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
      .sort((left, right) => right.href.length - left.href.length)[0]?.href ?? null;

  return (
    <PillList
      navLabel="Sections du compte"
      isScrollable
      items={tabs.map((tab) => ({ ...tab, isCurrent: tab.href === current }))}
    />
  );
}
