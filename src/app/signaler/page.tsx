import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReportTarget } from "@/types/report";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { StickyColumn } from "@/components/layout/StickyColumn";
import { ReportAside } from "@/components/report/ReportAside";
import { ReportForm } from "@/components/report/ReportForm";
import { getConversationById } from "@/lib/data/conversations";
import { getListingForViewer } from "@/lib/data/listings";
import { getProfileByUsername } from "@/lib/data/profiles";
import { requireCurrentUserId } from "@/lib/data/session";
import { getWantedBySlug } from "@/lib/data/wanted";
import { REPORT_TARGET_LABELS } from "@/lib/labels";
import { REPORT_PARAM, getReportUrl } from "@/lib/report-target";
import { routes } from "@/lib/routes";
import { firstParam, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Signaler",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<SearchParams> };

/* Ce que l'on signale, nommé en toutes lettres avant le formulaire : on ne
   signale pas « quelque chose ». Une cible introuvable — ou invisible pour
   celui qui signale, comme une annonce réservée aux pros — répond 404, et
   l'on ne se signale pas soi-même. */
async function describeTarget(type: ReportTarget, key: string, viewerId: string): Promise<{ label: string; back: string } | null> {
  if (type === "listing") {
    const listing = await getListingForViewer(key, viewerId);
    return listing && listing.seller.id !== viewerId ? { label: listing.title, back: routes.listing(listing.slug) } : null;
  }
  if (type === "wanted") {
    const wanted = await getWantedBySlug(key);
    return wanted && wanted.buyer.id !== viewerId ? { label: wanted.title, back: routes.wanted(wanted.slug) } : null;
  }
  if (type === "profile") {
    const profile = await getProfileByUsername(key);
    return profile && profile.id !== viewerId ? { label: profile.username, back: routes.profile(profile.username) } : null;
  }
  const conversation = await getConversationById(key, viewerId);
  if (!conversation || (conversation.buyer.id !== viewerId && conversation.seller.id !== viewerId)) return null;
  const other = conversation.buyer.id === viewerId ? conversation.seller : conversation.buyer;
  return { label: `Votre conversation avec ${other.username}`, back: routes.conversation(conversation.id) };
}

export default async function ReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const entry = (Object.entries(REPORT_PARAM) as Array<[ReportTarget, string]>).find(([, param]) => firstParam(params[param]));
  if (!entry) notFound();
  const [targetType, param] = entry;
  const targetKey = firstParam(params[param]) ?? "";

  const viewerId = await requireCurrentUserId(getReportUrl(targetType, targetKey));
  const target = await describeTarget(targetType, targetKey, viewerId);
  if (!target) notFound();

  return (
    /* Le formulaire à gauche, ce qui se passe ensuite à droite. Bridée à
       760 px, la page laissait vide la moitié d'un grand écran. */
    <div className="container pb-[var(--section-gap)] pt-6 lg:pt-10">
      <Breadcrumb items={[{ href: target.back, label: target.label }, { label: "Signaler" }]} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12">
        <div className="min-w-0">
          <p className="eyebrow text-[var(--muted)]">Signalement</p>
          <h1 className="display display-h2 mt-3">Signaler {REPORT_TARGET_LABELS[targetType]}</h1>
          <p className="mt-3 text-[length:var(--text-body)] text-[var(--ink-soft)]">
            « {target.label} ». La personne signalée ne saura pas que c&apos;est vous.
          </p>
          <div className="mt-8">
            <ReportForm targetType={targetType} targetKey={targetKey} />
          </div>
        </div>
        <aside aria-label="Après le signalement" className="min-w-0">
          <StickyColumn>
            <ReportAside />
          </StickyColumn>
        </aside>
      </div>
    </div>
  );
}
