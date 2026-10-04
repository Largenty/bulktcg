import Link from "next/link";
import type { SellerSummary } from "@/types/profile";
import { FormSection } from "@/components/deposit/FormSection";
import { RequiredCheckbox } from "@/components/ui/RequiredCheckbox";
import { listingStepNumber } from "@/lib/listing-form-steps";
import { LEGAL_LINKS } from "@/lib/legal";
import { routes } from "@/lib/routes";

type SellerStatusSectionProps = {
  seller: Pick<SellerSummary, "isPro" | "companyName">;
  /* À la modification, la déclaration a été faite au dépôt. */
  isEdit: boolean;
  error?: string;
};

/* Chaque annonce dit si elle vient d'un particulier ou d'un professionnel,
   tel que le vendeur le déclare ; avant de déposer, un particulier lit ce
   qu'il risque à se présenter comme tel s'il est professionnel (Code de la
   consommation, D111-8). Un compte professionnel n'a rien à déclarer de
   plus : son SIRET, vérifié, le dit déjà. */
export function SellerStatusSection({ seller, isEdit, error }: SellerStatusSectionProps) {
  if (seller.isPro) {
    return (
      <FormSection step={listingStepNumber("seller")} title="Vous vendez en tant que" description="Professionnel : l'annonce porte le badge PRO et votre enseigne, et l'acheteur sait à qui il a affaire.">
        <p className="text-[length:var(--text-md)] leading-relaxed">
          <strong className="font-semibold">{seller.companyName ?? "Votre boutique"}</strong>, compte professionnel.
        </p>
      </FormSection>
    );
  }

  return (
    <FormSection
      step={listingStepNumber("seller")}
      title="Vous vendez en tant que"
      description="Particulier. L'annonce le dit à l'acheteur, avec ce que cela change pour lui : pas de droit de rétractation ni de garantie légale de conformité, la garantie des vices cachés seulement."
    >
      {isEdit ? (
        <p className="text-[length:var(--text-md)] leading-relaxed">Déclaré au dépôt : vous vendez à titre personnel.</p>
      ) : (
        <RequiredCheckbox
          id="privateSeller"
          error={error}
          label="Je vends à titre personnel, en dehors de toute activité professionnelle."
        />
      )}
      <p className="notice text-[length:var(--text-sm)] leading-relaxed">
        Un professionnel qui se présente comme un particulier commet une pratique commerciale trompeuse : jusqu&apos;à cinq ans
        d&apos;emprisonnement et 750 000 € d&apos;amende quand elle a lieu en ligne (
        <a href={LEGAL_LINKS.misleadingPractices} rel="noopener" target="_blank" className="text-link">
          Code de la consommation, art. L132-2
        </a>
        ). Vous vendez pour une boutique ou un commerce ?{" "}
        <Link href={routes.accountSettings} className="text-link">
          Déclarez son SIRET dans Paramètres
        </Link>
        .
      </p>
    </FormSection>
  );
}
