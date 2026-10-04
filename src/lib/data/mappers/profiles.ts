import { ACCOUNT_TYPES, type SellerProfile, type SellerSummary } from "@/types/profile";
import type { RatingBreakdown } from "@/types/review";
import type { ProfileRow } from "@/lib/data/rows";
import { narrow } from "@/lib/data/mappers/shared";

/* Un compte professionnel : le statut déclaré avec le SIRET, forfait ou
   non. C'est lui que porte le badge PRO, et lui que trie le filtre
   « Particuliers / Boutiques » : une boutique au forfait échu y passait
   pour un particulier, badge PRO sur sa vignette. */
export function isProRow(row: Pick<ProfileRow, "account_type">): boolean {
  return narrow(row.account_type, ACCOUNT_TYPES, "profiles.account_type") === "pro";
}

/* Un pro dont le forfait court encore — ce qui ouvre les lots réservés aux
   pros. La date décide, pas le type de compte : c'est la même règle que
   public.is_active_pro côté base. */
export function isActiveProRow(
  row: Pick<ProfileRow, "account_type" | "pro_until">,
  now: number = Date.now(),
): boolean {
  return isProRow(row) && row.pro_until !== null && new Date(row.pro_until).getTime() > now;
}

export function toSellerSummary(row: ProfileRow): SellerSummary {
  const isPro = isProRow(row);
  return {
    id: row.id,
    username: row.username,
    city: row.city,
    postalCode: row.postal_code,
    avatarInitials: row.avatar_initials,
    /* rating_avg est null tant qu'aucun avis n'existe : on le laisse null
       plutôt que de le coalescer à 0, qui se lirait comme une mauvaise note. */
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    isPro,
    hasProPlan: isActiveProRow(row),
    companyName: isPro ? row.company_name : null,
  };
}

export function toSellerProfile(row: ProfileRow, activeListingCount: number): SellerProfile {
  return {
    ...toSellerSummary(row),
    bio: row.bio,
    proUntil: row.pro_until,
    createdAt: row.created_at,
    activeListingCount,
    soldListingCount: row.sold_listing_count,
    ratingBreakdown: toRatingBreakdown(row),
    shop: isProRow(row)
      ? {
          siret: row.siret,
          legalName: row.legal_name,
          verifiedAt: row.pro_verified_at,
          address: row.shop_address,
          hours: row.shop_hours,
          website: row.shop_website,
          cardmarketUrl: row.cardmarket_url,
          cardnexusUrl: row.cardnexus_url,
        }
      : null,
  };
}

/* Comme rating_avg : null tant qu'aucun avis n'existe, jamais 0. */
function toRatingBreakdown(row: ProfileRow): RatingBreakdown {
  return {
    punctuality: row.punctuality_avg,
    responsiveness: row.responsiveness_avg,
    reliability: row.reliability_avg,
  };
}
