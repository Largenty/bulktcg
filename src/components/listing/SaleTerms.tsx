import Link from "next/link";
import type { SellerSummary } from "@/types/profile";
import { LEGAL_LINKS } from "@/lib/legal";
import { routes } from "@/lib/routes";
import { SITE_NAME } from "@/lib/site";

const TEXT = "text-[length:var(--text-body)] leading-relaxed";

/* Ce que l'acheteur doit savoir de la vente avant le rendez-vous, selon qui
   vend : la qualité du vendeur, telle qu'il l'a déclarée, et pour une vente
   entre particuliers ce qu'elle ne garantit pas (Code de la consommation,
   D111-8). Le prix est le prix total : le site ne prélève rien. */
export function SaleTerms({ seller }: { seller: Pick<SellerSummary, "isPro" | "companyName" | "username"> }) {
  if (seller.isPro) {
    return (
      <p className={TEXT}>
        <strong className="font-semibold">Vendu par un professionnel</strong>
        {seller.companyName ? `, ${seller.companyName}` : ""}. Le prix affiché est le prix total : {SITE_NAME} ne prélève
        aucun frais. Son SIRET et l&apos;adresse de sa boutique sont sur{" "}
        <Link href={routes.profile(seller.username)} className="text-link">
          sa fiche
        </Link>
        .
      </p>
    );
  }
  return (
    <p className={TEXT}>
      <strong className="font-semibold">Vente entre particuliers</strong>, comme le vendeur l&apos;a déclaré. Le prix affiché est
      le prix total : {SITE_NAME} ne prélève aucun frais. Ni droit de rétractation ni garantie légale de conformité, qui ne
      valent que pour un achat auprès d&apos;un professionnel ; la garantie des vices cachés s&apos;applique (
      <a href={LEGAL_LINKS.hiddenDefects} rel="noopener" target="_blank" className="text-link">
        Code civil, art. 1641 et suivants
      </a>
      ).
    </p>
  );
}
