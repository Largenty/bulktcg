"use client";

import { useState } from "react";
import { declareProStatusAction } from "@/app/actions/pro-status";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RequiredCheckbox } from "@/components/ui/RequiredCheckbox";
import { useMutation } from "@/components/ui/useMutation";
import type { ProStatusResult } from "@/lib/data/pro-status-mutations";
import { isAccepted } from "@/lib/data/mutation-result";
import { collectErrors } from "@/lib/schemas/field-errors";
import { focusFirstError } from "@/lib/form-focus";
import { proStatusSchema } from "@/lib/schemas/pro-status-form";

const FIELD_ORDER = ["siret", "companyName", "certifies"] as const;

/* Déclarer son SIRET. La forme se vérifie ici, tout de suite — quatorze
   chiffres, la clé de contrôle —, l'établissement ensuite par le serveur,
   auprès du répertoire des entreprises. Le compte rendu dit ce que le
   répertoire a trouvé, et ce qui a vraiment été enregistré. */
export function ProStatusForm() {
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const { result, isPending, run, setResult } = useMutation<ProStatusResult>();
  const found = result && isAccepted(result) ? result.data : null;

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = proStatusSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const fieldErrors = collectErrors(parsed.error);
      setErrors(fieldErrors);
      setResult(null);
      focusFirstError(fieldErrors, { order: FIELD_ORDER });
      return;
    }
    setErrors({});
    run(
      () => declareProStatusAction(formData),
      (outcome) => {
        if (outcome.status !== "invalid") return;
        setErrors(outcome.fieldErrors);
        focusFirstError(outcome.fieldErrors, { order: FIELD_ORDER });
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Input
        id="siret"
        label="SIRET de l'établissement"
        isRequired
        inputMode="numeric"
        error={errors.siret}
        hint="Quatorze chiffres, sur un extrait Kbis, l'avis de situation Insee ou annuaire-entreprises.data.gouv.fr."
      />
      <Input
        id="companyName"
        label="Enseigne"
        maxLength={80}
        error={errors.companyName}
        hint="Le nom affiché à côté de votre pseudo. Laissé vide, ce sera celui du répertoire des entreprises."
      />
      <RequiredCheckbox
        id="certifies"
        error={errors.certifies}
        label="Je déclare agir pour cette entreprise et vendre ici dans le cadre de son activité."
        description="Vous la dirigez, ou vous êtes habilité à la représenter. Un SIRET prouve qu'un établissement existe, pas qui le dirige : cette déclaration engage votre compte."
      />
      <div className="flex flex-col gap-2">
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Vérification auprès du répertoire…" : "Vérifier et passer en professionnel"}
          </Button>
        </div>
        {found ? (
          <p className="text-[length:var(--text-md)] leading-snug">
            Établissement en activité : <strong className="font-semibold">{found.legalName ?? "raison sociale non diffusée"}</strong>,
            affiché sous l&apos;enseigne « {found.companyName} ».
          </p>
        ) : null}
        <PersistenceNote result={result} action="passer le compte en professionnel" />
      </div>
    </form>
  );
}
