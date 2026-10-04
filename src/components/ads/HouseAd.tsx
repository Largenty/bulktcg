import { ButtonLink } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";
import { routes } from "@/lib/routes";
import { FEATURED_DURATION_DAYS, FEATURED_PRICE_CENTS, SITE_NAME } from "@/lib/site";

/* Encart maison. Ce n'est pas une régie : le site fait la promotion de son
   propre produit payant, la mise en avant d'annonce. Il est signé du nom du
   site et habillé du holographique — celui qu'on obtient en payant — pour
   qu'on ne le confonde ni avec une annonce, ni avec une publicité tierce. */
export function HouseAd({ className }: { className?: string }) {
  return (
    <aside
      aria-label={`Proposition ${SITE_NAME}`}
      className={[
        "foil-panel flex flex-col items-start gap-3 p-5 pt-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="label text-[var(--ink-soft)]">{SITE_NAME} · À la une</p>
      <p className="display display-h3">{formatPrice(FEATURED_PRICE_CENTS)} pour passer devant</p>
      <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink)]">
        {FEATURED_DURATION_DAYS} jours en tête de liste et le sceau holographique sur votre vignette.
        C&apos;est la seule chose que nous facturons : aucune commission sur la vente.
      </p>
      <ButtonLink href={routes.deposit} size="sm">
        Déposer une annonce
      </ButtonLink>
    </aside>
  );
}
