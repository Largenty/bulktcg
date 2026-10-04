import { Checkbox } from "@/components/ui/Checkbox";
import { Icon } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/format";
import {
  BUMP_DURATION_DAYS,
  BUMP_PRICE_CENTS,
  EXTRA_PHOTOS_PRICE_CENTS,
  FEATURED_DURATION_DAYS,
  FEATURED_PRICE_CENTS,
  FREE_PHOTOS,
  MAX_PHOTOS,
  URGENT_DURATION_DAYS,
  URGENT_PRICE_CENTS,
} from "@/lib/site";

type ListingOptionsProps = {
  /* Les cases vivent dans la colonne de l'aperçu, hors de la balise <form> :
     leur attribut form les y rattache, pour la soumission comme pour la
     lecture du brouillon. */
  form: string;
  /* null quand les photos ne s'enregistrent pas encore (phase 3) : une
     option « 8 photos » n'aurait rien à ouvrir. */
  extraPhotos: {
    isChecked: boolean;
    /* Déjà payée, à la modification d'une annonce : elle est acquise, et
       repart par un champ caché. */
    isPaid: boolean;
    onChange: (isChecked: boolean) => void;
  } | null;
};

const OPTION_LABEL = "flex flex-wrap items-center gap-x-3 gap-y-1.5";
const SEPARATOR = "border-t-[length:var(--border-width)] border-[var(--line)] pt-5";

/* Les options payantes du dépôt, sous l'aperçu de la vignette : on voit ce
   qu'elles y posent — le sceau, la mention « Urgent » — au moment de cocher.
   L'option « 8 photos » est aussi proposée par le sélecteur, dès que les
   trois photos gratuites sont posées. Rien n'est facturé en phase 1 —
   l'écran le dit. */
export function ListingOptions({ form, extraPhotos }: ListingOptionsProps) {
  return (
    <section aria-labelledby="options-titre" className="flex flex-col gap-3">
      <h2 id="options-titre" className="label text-[var(--muted)]">
        Options payantes
      </h2>
      <div className="foil-panel flex flex-col gap-5 p-5">
        <Checkbox
          id="isFeatured"
          form={form}
          label={
            <span className={OPTION_LABEL}>
              Mettre à la une pour {formatPrice(FEATURED_PRICE_CENTS)}
              <span aria-hidden="true" className="seal">
                À la une
              </span>
            </span>
          }
          description={`${FEATURED_DURATION_DAYS} jours en tête de liste et le sceau holographique sur la vignette.`}
        />
        <div className={SEPARATOR}>
          <Checkbox
            id="isUrgent"
            form={form}
            label={
              <span className={OPTION_LABEL}>
                Marquer comme urgent pour {formatPrice(URGENT_PRICE_CENTS)}
                <span aria-hidden="true" className="urgent-flag">
                  Urgent
                </span>
              </span>
            }
            description={`${URGENT_DURATION_DAYS} jours avec la mention « Urgent » sur la vignette et la fiche : les acheteurs savent que vous voulez vendre vite.`}
          />
        </div>
        <div className={SEPARATOR}>
          <Checkbox
            id="isBumped"
            form={form}
            label={
              <span className={OPTION_LABEL}>
                Remonter chaque jour pour {formatPrice(BUMP_PRICE_CENTS)}
                <span aria-hidden="true" className="mono inline-flex items-center gap-1 text-[length:var(--text-xs)] font-bold">
                  <Icon name="arrowUp" size={12} strokeWidth={2.4} />
                  Remontée
                </span>
              </span>
            }
            description={`Chaque jour pendant ${BUMP_DURATION_DAYS} jours, l'annonce repasse en tête des plus récentes, sous les annonces à la une. Sa date de dépôt ne change pas, et la vignette dit qu'elle a été remontée.`}
          />
        </div>
        {extraPhotos ? (
          <div className={SEPARATOR}>
            {extraPhotos.isPaid ? (
              <p className="flex items-start gap-3 text-[length:var(--text-md)]">
                <Icon name="check" size={20} className="mt-0.5 shrink-0" />
                <span>
                  <span className="font-semibold">{MAX_PHOTOS} photos, déjà incluses</span>
                  <span className="block text-[var(--ink-soft)]">Option réglée au dépôt : elle vaut pour toute la vie de l&apos;annonce.</span>
                </span>
                {/* Pour le schéma seulement : le serveur relit l'option sur l'annonce. */}
                <input type="hidden" name="extraPhotos" value="on" form={form} />
              </p>
            ) : (
              <Checkbox
                id="extraPhotos"
                form={form}
                checked={extraPhotos.isChecked}
                onChange={(event) => extraPhotos.onChange(event.currentTarget.checked)}
                label={`Jusqu'à ${MAX_PHOTOS} photos pour ${formatPrice(EXTRA_PHOTOS_PRICE_CENTS)}`}
                description={`${FREE_PHOTOS} photos sont gratuites. L'option en ouvre ${MAX_PHOTOS - FREE_PHOTOS} de plus, une fois pour toutes : le détail d'un classeur, les cartes qui font le prix.`}
              />
            )}
          </div>
        ) : null}
        <p className="text-[length:var(--text-sm)] text-[var(--muted)]">
          Le paiement n&apos;est pas encore ouvert : rien n&apos;est facturé ici.
        </p>
      </div>
    </section>
  );
}
