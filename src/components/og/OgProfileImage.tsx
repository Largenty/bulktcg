import type { SellerProfile } from "@/types/profile";
import { OgChip, OgKicker } from "@/components/og/OgChip";
import { OgFacts } from "@/components/og/OgPlate";
import { OgShareFrame } from "@/components/og/OgShareFrame";
import { PANE_LAYER } from "@/components/og/OgStamp";
import { formatRating } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { OG_COLOR } from "@/lib/og-colors";
import { forSatori } from "@/lib/og-fonts";

/* Ce que dessine l'image de partage d'un profil : qui, où, ce qu'il a en
   ligne, et sa note — « Pas encore d'avis » pour un compte neuf, jamais un
   0/5. Une boutique au forfait se présente sous son enseigne ; un forfait
   expiré ne se présente plus comme boutique. Jamais sans ligne : la
   première, la note, complète le texte alternatif de l'image. */
export type ProfileShare = { initials: string; chip: string; kicker: string; title: string; lines: [string, ...string[]] };

export function profileShare(profile: SellerProfile): ProfileShare {
  const isShop = profile.isPro && profile.companyName !== null;
  return {
    initials: profile.avatarInitials,
    chip: profile.isPro ? "Boutique" : "Profil",
    kicker: isShop ? `@${profile.username}` : `${profile.city} (${profile.postalCode})`,
    title: isShop ? (profile.companyName as string) : profile.username,
    lines: [
      profile.ratingAvg === null
        ? "Pas encore d'avis"
        : `Note ${formatRating(profile.ratingAvg)}/5 sur ${countLabel(profile.ratingCount, "avis", "avis")}`,
      `${countLabel(profile.activeListingCount, "annonce")} en ligne · ${countLabel(profile.soldListingCount, "vente")}`,
      ...(isShop ? [`${profile.city} (${profile.postalCode})`] : []),
    ],
  };
}

/* Les initiales du compte, comme son avatar sur le site. */
function OgProfilePane({ share, hasBrandFonts }: { share: ProfileShare; hasBrandFonts: boolean }) {
  return (
    <div style={{ display: "flex", ...PANE_LAYER, alignItems: "center", justifyContent: "center", background: OG_COLOR.slateRaised }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 260,
          height: 260,
          borderRadius: 10,
          background: OG_COLOR.chalk,
          color: OG_COLOR.ink,
          fontSize: 120,
          fontWeight: 800,
          fontFamily: hasBrandFonts ? "Science Gothic" : undefined,
        }}
      >
        {share.initials}
      </div>
    </div>
  );
}

export function OgProfileImage({ share, hasBrandFonts }: { share: ProfileShare; hasBrandFonts: boolean }) {
  return (
    <OgShareFrame
      pane={<OgProfilePane share={share} hasBrandFonts={hasBrandFonts} />}
      kicker={[<OgChip key="chip" label={share.chip} hasBrandFonts={hasBrandFonts} />, <OgKicker key="kicker" text={share.kicker} />]}
      title={share.title}
      details={<OgFacts lines={share.lines.map(forSatori)} />}
      hasBrandFonts={hasBrandFonts}
    />
  );
}
