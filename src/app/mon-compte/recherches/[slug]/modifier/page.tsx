import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { WantedForm } from "@/components/deposit/WantedForm";
import { WantedStatusBadge } from "@/components/wanted/WantedStatusBadge";
import { getListings } from "@/lib/data/listings";
import { toMatchCandidates } from "@/lib/match-candidate";
import { getProfileById } from "@/lib/data/profiles";
import { requireCurrentUserId } from "@/lib/data/session";
import { getWantedBySlug } from "@/lib/data/wanted";
import { toWantedFormDefaults } from "@/lib/form-defaults";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Modifier une recherche" };

type PageProps = { params: Promise<{ slug: string }> };

export default async function EditWantedPage({ params }: PageProps) {
  const { slug } = await params;
  const [userId, wanted] = await Promise.all([
    requireCurrentUserId(routes.editWanted(slug)),
    getWantedBySlug(slug),
  ]);

  /* Une demande qui n'est pas la sienne se comporte comme une demande qui
     n'existe pas : répondre « interdit » confirmerait qu'elle existe. */
  if (!wanted || wanted.buyer.id !== userId) notFound();

  const [buyer, activeListings] = await Promise.all([getProfileById(userId), getListings({ limit: 200 })]);
  if (!buyer) notFound();

  return (
    <>
      <Breadcrumb items={[{ href: routes.accountWanted, label: "Mes recherches" }, { label: "Modifier" }]} />

      <div className="flex flex-wrap items-center gap-3">
        <WantedStatusBadge status={wanted.status} />
        <p className="mono text-[length:var(--text-xs)] text-[var(--muted)]">{wanted.reference}</p>
      </div>
      <h2 className="display mt-3 text-[length:var(--text-2xl)]">{wanted.title}</h2>
      <p className="mt-4 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
        Élargir le rayon ou le budget fait remonter des lots qui étaient jusque-là écartés : la
        validation vous montrera lesquels avant que vous enregistriez.{" "}
        <Link href={routes.wanted(wanted.slug)} className="text-link">
          Voir la page publique
        </Link>
      </p>

      <div className="mt-10">
        <WantedForm
          activeListings={toMatchCandidates(activeListings, userId)}
          buyer={buyer}
          defaults={toWantedFormDefaults(wanted)}
          wantedId={wanted.id}
          permalink={`${SITE_URL}${routes.wanted(wanted.slug)}`}
          now={wanted.createdAt}
        />
      </div>
    </>
  );
}
