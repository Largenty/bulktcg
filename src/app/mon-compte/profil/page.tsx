import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Avatar } from "@/components/ui/Avatar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCityByPair } from "@/lib/cities";
import { getProfileById } from "@/lib/data/profiles";
import { requireCurrentUserId } from "@/lib/data/session";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Profil public" };

/* Le formulaire est un composant client, branché sur l'action serveur ; la
   page reste un composant serveur qui lit le profil. */
export default async function AccountProfilePage() {
  const userId = await requireCurrentUserId(routes.accountProfile);
  const profile = await getProfileById(userId);
  if (!profile) notFound();

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        size="md"
        title="Ce que les autres voient"
        description="Tout ce qui est sur cette page est public et apparaît sur chacune de vos annonces."
        linkHref={routes.profile(profile.username)}
        linkLabel="Voir la page publique"
      />
      <div className="flex items-center gap-4">
        <Avatar initials={profile.avatarInitials} size="md" />
        <p className="text-[length:var(--text-md)] leading-snug text-[var(--ink-soft)]">
          Les initiales sont dérivées du pseudo.
        </p>
      </div>
      <ProfileForm defaults={{ username: profile.username, bio: profile.bio ?? "", city: profile.city, place: getCityByPair(profile.city, profile.postalCode) }} shop={profile.shop} />
      <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
        Votre note et vos avis ne se modifient pas ici : ils sont écrits par les personnes avec qui vous avez conclu une
        vente.{" "}
        <Link href={routes.profileReviews(profile.username)} className="text-link">
          Le détail de votre note
        </Link>
      </p>
    </div>
  );
}
