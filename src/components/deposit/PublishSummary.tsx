import type { ReactNode } from "react";
import { CopyLinkButton } from "@/components/listing/CopyLinkButton";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DefinitionList, type DefinitionRow } from "@/components/ui/DefinitionList";
import { Icon } from "@/components/ui/Icon";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type PublishSummaryProps = {
  /* « L'annonce » ou « la demande ». */
  subject: string;
  /* Vrai quand l'écriture a réellement eu lieu, en base. */
  isSaved: boolean;
  isEdit: boolean;
  /* La vignette telle qu'elle apparaîtra. */
  preview: ReactNode;
  /* Le croisement, dans le sens qui convient à ce dépôt. */
  crossing?: ReactNode;
  title: string;
  description: string;
  rows: DefinitionRow[];
  permalinkUrl: string;
  dashboardHref: string;
  dashboardLabel: string;
  onEdit: () => void;
};

/* Ce qui suit la validation d'un dépôt. En démonstration, rien n'est
   enregistré et l'écran le dit en premier, en toutes lettres : une
   confirmation de publication qui mentirait serait pire que pas de bouton.
   Le reste — la vignette, qui cherche déjà ce lot, le lien permanent — est
   exactement ce qu'affiche un dépôt enregistré. */
export function PublishSummary(props: PublishSummaryProps) {
  const { subject, isSaved, isEdit, preview, crossing, title, description, rows, permalinkUrl } = props;

  return (
    <div className="flex flex-col gap-6">
      <div role="status" className={`notice flex gap-3 ${isSaved ? "notice-success" : "notice-warn"}`}>
        <Icon name={isSaved ? "check" : "info"} size={22} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-[length:var(--text-lg)] font-semibold">
            {isSaved
              ? `${subject} est ${isEdit ? "mise à jour" : "en ligne"}.`
              : `${subject} est complète et cohérente — rien n'a été enregistré.`}
          </p>
          <p className="mt-1 text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
            {isSaved
              ? "Le lien ci-dessous est permanent : collez-le où vous voulez."
              : `Rien n'est enregistré : ${DEMO_MODE_REASON}. Voici ce qui serait ${isEdit ? "mis à jour" : "publié"}, et le lien permanent qui ${isEdit ? "ne change pas" : "serait généré"}.`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <div inert className="pointer-events-none">
          {preview}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {crossing}

          <div className="panel flex flex-col gap-4">
            <p className="label text-[var(--muted)]">Lien permanent</p>
            {/* Passe à la ligne au lieu de défiler hors de portée du clavier. */}
            <code className="mono [overflow-wrap:anywhere] rounded-[var(--radius-md)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--tint)] px-4 py-3 text-[length:var(--text-sm)]">
              {permalinkUrl}
            </code>
            <div className="flex flex-wrap items-start gap-3">
              <CopyLinkButton url={permalinkUrl} variant="primary" />
              <Button variant="secondary" onClick={props.onEdit}>
                <Icon name="arrowLeft" size={16} />
                Revenir au formulaire
              </Button>
              <ButtonLink href={props.dashboardHref} variant="quiet">
                {props.dashboardLabel}
              </ButtonLink>
            </div>
          </div>

          <div className="panel">
            <h2 className="display display-h3">{title}</h2>
            <DefinitionList rows={rows} className="mt-4" />
            <p className="mt-6 whitespace-pre-line text-[length:var(--text-lg)] leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
