import Link from "next/link";
import type { SellerProfile } from "@/types/profile";
import { leaveProStatusAction } from "@/app/actions/pro-status";
import { DeleteAction } from "@/components/account/DeleteAction";
import { ProStatusForm } from "@/components/account/ProStatusForm";
import { FormSection } from "@/components/deposit/FormSection";
import { DefinitionList } from "@/components/ui/DefinitionList";
import { formatDate, formatSiret } from "@/lib/format";
import { UNKNOWN_VALUE } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

/* Le statut professionnel du compte, dans Paramètres : on le déclare ici,
   avec son SIRET, et non à l'inscription — la plupart des comptes sont des
   particuliers, et un formulaire d'inscription court est un formulaire
   rempli. Le statut est gratuit et porte le badge PRO : un acheteur doit
   savoir qu'il traite avec un professionnel. Le forfait, payant, s'y ajoute
   pour voir les lots réservés. */
export function ProStatusSection({ profile }: { profile: SellerProfile }) {
  if (!profile.isPro || !profile.shop) {
    return (
      <FormSection
        title="Compte professionnel"
        description="Vous vendez dans le cadre d'une activité — boutique, dépôt-vente, revendeur ? Déclarez le SIRET de votre établissement : il est vérifié aussitôt auprès du répertoire des entreprises, et vos annonces porteront le badge PRO et votre enseigne. C'est gratuit ; le forfait pro, à part, ouvre les lots réservés aux professionnels."
      >
        <ProStatusForm />
      </FormSection>
    );
  }

  const { shop } = profile;
  return (
    <FormSection
      title="Compte professionnel"
      description="Vos annonces, vos demandes et vos messages portent le badge PRO et votre enseigne. La fiche boutique — adresse, horaires, site, profils Cardmarket et CardNexus — se renseigne dans « Profil public »."
    >
      <DefinitionList
        rows={[
          { label: "Enseigne", value: profile.companyName ?? UNKNOWN_VALUE },
          { label: "Raison sociale", value: shop.legalName ?? UNKNOWN_VALUE, note: "Masquée par le répertoire, ou pas encore vérifiée" },
          { label: "SIRET", value: formatSiret(shop.siret) },
          shop.verifiedAt
            ? { label: "Vérifié le", value: formatDate(shop.verifiedAt), dateTime: shop.verifiedAt }
            : { label: "Vérifié le", value: UNKNOWN_VALUE, note: "Pas encore vérifié auprès du répertoire" },
          profile.hasProPlan && profile.proUntil
            ? { label: "Forfait pro jusqu'au", value: formatDate(profile.proUntil), dateTime: profile.proUntil }
            : { label: "Forfait pro", value: "Aucun" },
        ]}
      />
      {profile.hasProPlan ? null : (
        <p className="text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
          Sans forfait, les lots réservés aux professionnels ne vous sont pas ouverts.{" "}
          <Link href={routes.pro} className="text-link">
            Voir le forfait pro
          </Link>
        </p>
      )}
      {profile.hasProPlan ? (
        <p className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
          Pour repasser en compte particulier, le forfait se résilie d&apos;abord.
        </p>
      ) : (
        <DeleteAction
          itemName="le statut professionnel"
          question="Repasser en compte particulier ?"
          buttonLabel="Repasser en compte particulier"
          confirmLabel="Repasser en particulier"
          pendingLabel="Enregistrement…"
          icon="ban"
          consequence="Le badge PRO, l'enseigne, la fiche boutique et le SIRET quittent le compte et ses annonces. Vos annonces, vos demandes et vos avis restent."
          doneTitle="Le compte reste professionnel."
          notPersistedText={`La demande est valide, mais rien n'est changé : ${DEMO_MODE_REASON}.`}
          onConfirmAction={leaveProStatusAction}
        />
      )}
    </FormSection>
  );
}
