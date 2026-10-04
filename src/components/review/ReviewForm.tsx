"use client";

import { useEffect, useState } from "react";
import { reviewDealAction } from "@/app/actions/deals";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { StarRatingInput } from "@/components/review/StarRatingInput";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useMutation } from "@/components/ui/useMutation";
import { REVIEW_CRITERION_HINTS, REVIEW_CRITERION_LABELS } from "@/lib/labels";
import { REVIEW_CRITERIA, type RatingBreakdown, type ReviewRole } from "@/types/review";
import { DEMO_MODE_REASON } from "@/lib/demo-mode";

type ReviewFormProps = {
  dealId: string;
  revieweeUsername: string;
  /* Vendeur ou acheteur : la fiabilité ne se juge pas pareil. */
  revieweeRole: ReviewRole;
};

const EMPTY: RatingBreakdown = { punctuality: null, responsiveness: null, reliability: null };

/* Trois critères plutôt qu'une note : un rendez-vous manqué et un lot moins
   rempli qu'annoncé ne sont pas le même reproche, et le prochain acheteur
   veut savoir lequel. Le commentaire est facultatif ; une note, non. */
export function ReviewForm({ dealId, revieweeUsername, revieweeRole }: ReviewFormProps) {
  const [scores, setScores] = useState<RatingBreakdown>(EMPTY);
  const { result, isPending, run } = useMutation<null>();
  const errors = result?.status === "invalid" ? result.fieldErrors : {};

  /* Un avis refusé renvoie le focus sur le premier champ fautif : sans lui,
     le message d'erreur s'affiche hors de la vue de qui a validé en bas. */
  useEffect(() => {
    if (result?.status !== "invalid") return;
    const first = [...REVIEW_CRITERIA, "comment"].find((field) => result.fieldErrors[field]);
    if (first) document.getElementById(first)?.focus();
  }, [result]);

  if (result?.status === "not-persisted" || result?.status === "saved") {
    return (
      <div role="status" className="notice notice-success flex flex-col gap-2">
        <p className="font-semibold">Avis reçu.</p>
        <p className="text-[length:var(--text-md)] leading-relaxed text-[var(--ink-soft)]">
          {result.status === "saved"
            ? `Il est publié sur le profil de ${revieweeUsername}.`
            : `L'avis est valide, mais rien n'est enregistré : ${DEMO_MODE_REASON}.`}
        </p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        run(() => reviewDealAction(data));
      }}
    >
      <input type="hidden" name="dealId" value={dealId} />
      {REVIEW_CRITERIA.map((criterion) => (
        <StarRatingInput
          key={criterion}
          name={criterion}
          label={REVIEW_CRITERION_LABELS[criterion]}
          hint={REVIEW_CRITERION_HINTS[revieweeRole][criterion]}
          value={scores[criterion]}
          error={errors[criterion]}
          onChange={(value) => setScores((current) => ({ ...current, [criterion]: value }))}
        />
      ))}
      <Textarea
        id="comment"
        name="comment"
        label="Un mot sur l'échange"
        rows={4}
        maxLength={1000}
        error={errors.comment}
        hint={`Ce que le prochain ${revieweeRole === "seller" ? "acheteur" : "vendeur"} aimerait savoir sur ${revieweeUsername}.`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Envoi…" : "Publier l'avis"}
        </Button>
        {/* Les refus de champ s'affichent sous leur champ ; ici, le reste :
            session expirée, vente introuvable, envoi perdu en route. */}
        <PersistenceNote result={result?.status === "invalid" ? null : result} action="publier l'avis" />
      </div>
    </form>
  );
}
