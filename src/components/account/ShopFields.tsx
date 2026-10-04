import Link from "next/link";
import type { ShopDetails } from "@/types/profile";
import { FormSection } from "@/components/deposit/FormSection";
import { Input } from "@/components/ui/Input";
import { formatSiret } from "@/lib/format";
import { routes } from "@/lib/routes";

type ShopFieldsProps = {
  shop: ShopDetails;
  errors: Partial<Record<string, string>>;
};

/* La fiche boutique d'un compte professionnel, dans « Profil public » : où
   la trouver, quand, en ligne, et ses pages de vendeur sur Cardmarket et
   CardNexus. Celles-ci sont déclarées, pas vérifiées — le profil le dit à
   côté du lien —, et aucune statistique n'en est recopiée : un chiffre
   recopié vieillit et finit par mentir, et Cardmarket interdit d'en
   reproduire le contenu. Le SIRET, lui, se déclare dans Paramètres. */
export function ShopFields({ shop, errors }: ShopFieldsProps) {
  return (
    <FormSection
      title="Votre boutique"
      description="Affichée sur votre profil, sous le badge PRO, tant que votre compte est professionnel. Un champ laissé vide s'y affiche « — »."
    >
      <Input id="shopAddress" label="Adresse de la boutique" defaultValue={shop.address ?? ""} error={errors.shopAddress} hint="La rue et la commune : on vient vous voir, on ne vous écrit pas seulement." />
      <Input id="shopHours" label="Horaires" defaultValue={shop.hours ?? ""} error={errors.shopHours} hint="Par exemple : du mardi au samedi, de 10 h à 19 h." />
      <Input id="shopWebsite" label="Site" type="url" inputMode="url" placeholder="https://" defaultValue={shop.website ?? ""} error={errors.shopWebsite} />
      <Input
        id="cardmarketUrl"
        label="Votre page vendeur Cardmarket"
        type="url"
        inputMode="url"
        placeholder="https://www.cardmarket.com/fr/…/Users/…"
        defaultValue={shop.cardmarketUrl ?? ""}
        error={errors.cardmarketUrl}
        hint="Copiez l'adresse de votre page vendeur. Elle s'affiche comme déclarée par vous : les acheteurs y lisent vos ventes et vos évaluations, à jour."
      />
      <Input
        id="cardnexusUrl"
        label="Votre page CardNexus"
        type="url"
        inputMode="url"
        placeholder="https://cardnexus.com/…"
        defaultValue={shop.cardnexusUrl ?? ""}
        error={errors.cardnexusUrl}
      />
      <p className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
        SIRET : {formatSiret(shop.siret)}. Il se déclare et se vérifie dans{" "}
        <Link href={routes.accountSettings} className="text-link">
          Paramètres
        </Link>
        .
      </p>
    </FormSection>
  );
}
