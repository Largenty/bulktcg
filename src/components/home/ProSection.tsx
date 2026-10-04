import type { GameId } from "@/types/game";
import { ReservedCounts } from "@/components/pro/ReservedCounts";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProBadge } from "@/components/pro/ProBadge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { formatPrice } from "@/lib/format";
import { AUDIENCE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";
import { PRO_PLAN_PRICE_CENTS } from "@/lib/site";

/* Les deux côtés de l'offre pro, sur l'accueil : le particulier qui réserve
   son lot aux boutiques, la boutique qui paie pour les voir. L'un ne va pas
   sans l'autre, d'où une seule section et deux cartes de même poids. */
export function ProSection({ reservedCounts }: { reservedCounts: Record<GameId, number> }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHeader
          eyebrow="Particuliers et boutiques"
          title="Vendre à un pro, en un clic"
          description="Un carton de succession, une collection entière : certains lots se vendent mieux à une boutique qu'à trente inconnus."
          linkHref={routes.pro}
          linkLabel="Le forfait pro"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel flex flex-col gap-5">
            <p className="label text-[var(--muted)]">Vous vendez</p>
            <p className="text-[length:var(--text-xl)] font-semibold leading-snug">
              Au dépôt, réservez votre annonce aux professionnels.
            </p>
            {/* La même question qu'au dépôt, reproduite telle quelle : on sait
                d'avance où elle se pose et ce qu'elle change. */}
            <div aria-hidden="true" className="flex flex-col gap-2">
              <FakeOption label={AUDIENCE_LABELS.everyone} />
              <FakeOption label={AUDIENCE_LABELS.pros} isChecked />
            </div>
            <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
              Votre lot n&apos;apparaît ni dans la recherche publique ni sur Google : seules les boutiques au
              forfait le voient, estiment sur place et paient comptant.
            </p>
            <div className="mt-auto">
              <ButtonLink href={routes.deposit} variant="secondary">
                Déposer un lot
              </ButtonLink>
            </div>
          </div>

          <div className="on-slate flex flex-col gap-5 rounded-[var(--radius-lg)] p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="label text-[var(--chalk-muted)]">Vous tenez une boutique</p>
              <ProBadge isInverse />
            </div>
            <p className="text-[length:var(--text-xl)] font-semibold leading-snug">
              Le forfait pro vous ouvre les lots réservés, pour{" "}
              <span className="price whitespace-nowrap">{formatPrice(PRO_PLAN_PRICE_CENTS)}</span> HT par mois.
            </p>
            <ReservedCounts counts={reservedCounts} isInverse />
            <div className="mt-auto">
              <ButtonLink href={routes.pro} variant="inverse">
                Voir le forfait pro
                <Icon name="arrowRight" size={18} />
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FakeOption({ label, isChecked = false }: { label: string; isChecked?: boolean }) {
  return (
    <span
      className={`flex items-center gap-3 rounded-[var(--radius-md)] border-[length:var(--border-width)] px-3.5 py-2.5 ${
        isChecked ? "border-[var(--ink)] bg-[var(--card)] font-semibold" : "border-[var(--line)] text-[var(--ink-soft)]"
      }`}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-[length:var(--border-width-strong)] border-[var(--ink)]">
        {isChecked ? <span className="h-2 w-2 rounded-full bg-[var(--ink)]" /> : null}
      </span>
      {label}
      {isChecked ? <ProBadge /> : null}
    </span>
  );
}
