import { FormSection } from "@/components/deposit/FormSection";
import { PhotoPicker } from "@/components/deposit/PhotoPicker";
import type { DraftPhoto } from "@/lib/listing-draft";
import { listingStepNumber } from "@/lib/listing-form-steps";
import { LISTING_LIFECYCLE } from "@/lib/listing-lifecycle";

/* Dit au moment où l'on dépose la photo — c'est là qu'on doit dire combien
   de temps on la garde. La raison est la vraie : ce sont des photos prises
   chez les gens. */
const PHOTO_RETENTION_NOTE = `Elles sont supprimées de BulkTCG ${LISTING_LIFECYCLE.archiveAfterDays} jours après la vente ou l'expiration de l'annonce : nous ne gardons pas plus longtemps que nécessaire des photos prises chez vous.`;

type PhotoSectionProps = {
  /* Faux avec la base tant que les photos ne s'enregistrent pas : elles
     arrivent avec Cloudflare Images, en phase 3 (canAttachPhotos). */
  isAvailable: boolean;
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
  hasExtra: boolean;
  onRequestExtra: () => void;
  onPreparingChange: (isPreparing: boolean) => void;
  watermark: string;
  error?: string;
};

/* La première étape du dépôt. Sans photos possibles, elle le dit au lieu
   de proposer un sélecteur dont les fichiers seraient perdus à la
   publication ; la vignette affiche « Sans photo » d'ici là. */
export function PhotoSection({ isAvailable, error, ...picker }: PhotoSectionProps) {
  if (!isAvailable) {
    return (
      <FormSection step={listingStepNumber("photos")} title="Photos" description="La vignette affichera « Sans photo » d'ici là.">
        <p data-photos-unavailable className="notice text-[length:var(--text-md)] leading-relaxed">
          Les photos arrivent bientôt. Publiez l&apos;annonce sans photo : vous pourrez les ajouter ensuite, et son lien ne
          changera pas.
        </p>
      </FormSection>
    );
  }
  return (
    <FormSection
      step={listingStepNumber("photos")}
      title="Photos"
      description={`La première est la couverture : prenez l'ensemble du lot, à la lumière du jour, puis les détails qui comptent. ${PHOTO_RETENTION_NOTE}`}
    >
      <PhotoPicker {...picker} error={error} />
    </FormSection>
  );
}
