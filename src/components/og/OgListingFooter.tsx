import type { Listing } from "@/types/listing";
import { OgChip } from "@/components/og/OgChip";
import { OgPlate } from "@/components/og/OgPlate";
import { OG_COLOR } from "@/lib/og-colors";

type OgListingFooterProps = {
  listing: Pick<Listing, "priceCents" | "city" | "postalCode" | "status"> & {
    seller: Pick<Listing["seller"], "isPro" | "companyName">;
  };
  hasBrandFonts: boolean;
};

/* Le bas de l'image de partage d'une annonce : le prix en pavé et la
   commune. Un lot vendu perd l'aplat de son prix, comme sur la vignette ;
   une boutique au forfait porte son badge et son enseigne sous la
   commune. */
export function OgListingFooter({ listing, hasBrandFonts }: OgListingFooterProps) {
  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 24 }}>
      <OgPlate cents={listing.priceCents} isOutlined={listing.status === "sold"} hasBrandFonts={hasBrandFonts} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", fontSize: 30, color: OG_COLOR.chalkSoft, fontWeight: 600 }}>
          {listing.city} ({listing.postalCode})
        </div>
        {listing.seller.isPro ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 24, color: OG_COLOR.chalkSoft }}>
            <OgChip label="Pro" hasBrandFonts={hasBrandFonts} />
            {listing.seller.companyName ? <span style={{ display: "flex" }}>{listing.seller.companyName}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
