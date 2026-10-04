"use client";

import { saveAlertSettings } from "@/app/actions/profile";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { FormSection } from "@/components/deposit/FormSection";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { useMutation } from "@/components/ui/useMutation";
import type { AlertSettings } from "@/lib/data/account-settings";

/* Les deux alertes du compte, enregistrées à part du reste de la page :
   elles ne regardent que leur titulaire. */
export function AlertSettingsForm({ defaults }: { defaults: AlertSettings }) {
  const { result, isPending, run } = useMutation<AlertSettings>();

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => saveAlertSettings(formData));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormSection
        title="Alertes"
        description="Une alerte par e-mail dès qu'un lot correspond à l'une de vos recherches, ou qu'une recherche correspond à l'un de vos lots. C'est le croisement qui la déclenche, pas une lettre d'information."
      >
        <Checkbox
          id="alertMatches"
          label="Me prévenir quand un croisement tombe"
          description="Au dépôt d'un lot qui répond à l'une de vos recherches, et au dépôt d'une recherche que l'un de vos lots satisfait."
          defaultChecked={defaults.alertMatches}
        />
        <Checkbox
          id="alertMessages"
          label="Me prévenir d'un nouveau message"
          description="Un seul e-mail par conversation tant que vous n'avez pas répondu, pas un par message."
          defaultChecked={defaults.alertMessages}
        />
      </FormSection>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer les alertes"}
        </Button>
        <PersistenceNote result={result} action="enregistrer les alertes" />
      </div>
    </form>
  );
}
