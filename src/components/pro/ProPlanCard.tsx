import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProBadge } from "@/components/pro/ProBadge";
import { formatPrice } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { PRO_PLAN_PRICE_CENTS } from "@/lib/site";

type ProPlanCardProps = {
  /* Le nombre de lots réservés en ligne, compté sur les annonces réelles. */
  reservedCount: number;
};

/* Le forfait, tel qu'une boutique le lit avant de souscrire : le prix, ce
   qu'il ouvre, et ce qu'il suppose — le statut professionnel, gratuit, qui
   porte le badge et l'enseigne. Rien de ce qui est promis ici n'est absent
   du site ; seul le paiement attend, et le bouton le dit. */
export function ProPlanCard({ reservedCount }: ProPlanCardProps) {
  return (
    <div className="flex flex-col gap-6 rounded-[var(--radius-xl)] border-[length:var(--border-width-strong)] border-[var(--ink)] bg-[var(--card)] p-6 shadow-[var(--shadow-md)] sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="display display-h3">Forfait pro</p>
        <ProBadge />
      </div>

      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="price text-[length:var(--number-3xl)] font-bold leading-none">{formatPrice(PRO_PLAN_PRICE_CENTS)}</span>
        <span className="text-[length:var(--text-md)] text-[var(--ink-soft)]">HT par mois, sans engagement</span>
      </p>

      <ul className="flex list-none flex-col gap-4 border-t-[length:var(--border-width)] border-[var(--line)] pt-5">
        <Benefit title="Les lots réservés aux pros">
          Des particuliers ne montrent leur lot qu&apos;aux boutiques. Vous les voyez dans votre espace pro —{" "}
          {countLabel(reservedCount, "lot en ligne", "lots en ligne")} en ce moment.
        </Benefit>
        <Benefit title="Sur un compte professionnel">
          Le badge Pro et votre enseigne viennent avec le statut, gratuit : déclarez le SIRET de votre établissement dans
          Paramètres. Ils restent si le forfait s&apos;arrête.
        </Benefit>
        <Benefit title="Le reste ne change pas">
          Déposer reste gratuit, les ventes se règlent en main propre, sans commission. Le forfait est le
          seul paiement fait au site.
        </Benefit>
      </ul>

      <div className="flex flex-col gap-2.5">
        <Button type="button" size="lg" disabled className="w-full">
          Souscrire au forfait
        </Button>
        <p className="text-[length:var(--text-sm)] leading-snug text-[var(--muted)]">
          Les paiements ne sont pas encore ouverts : la souscription arrivera avec eux. Rien n&apos;est
          facturé aujourd&apos;hui.
        </p>
      </div>
    </div>
  );
}

function Benefit({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[var(--on-ink)]">
        <Icon name="check" size={14} strokeWidth={3} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">{children}</span>
      </span>
    </li>
  );
}
