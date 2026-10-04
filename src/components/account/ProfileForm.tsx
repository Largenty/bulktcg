"use client";

import { useState } from "react";
import { saveProfile } from "@/app/actions/profile";
import { PersistenceNote } from "@/components/account/PersistenceNote";
import { ShopFields } from "@/components/account/ShopFields";
import { FormSection } from "@/components/deposit/FormSection";
import { Button } from "@/components/ui/Button";
import { CityCombobox } from "@/components/city/CityCombobox";
import type { City } from "@/lib/city-label";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useMutation } from "@/components/ui/useMutation";
import type { ShopDetails } from "@/types/profile";
import { collectErrors } from "@/lib/schemas/field-errors";
import { profileSchema } from "@/lib/schemas/profile-form";

type ProfileFormProps = {
  /* `place` : la commune enregistrée, résolue par la page. */
  defaults: { username: string; bio: string; city: string; place: City | null };
  /* La fiche boutique d'un compte professionnel ; null pour un particulier. */
  shop: ShopDetails | null;
};

/* Le profil public, modifiable. Même mécanique que les dépôts : validation
   immédiate, puis action serveur, et un compte rendu qui ne ment pas. */
export function ProfileForm({ defaults, shop }: ProfileFormProps) {
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const { result, isPending, run, setResult } = useMutation<{ username: string }>();

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      setErrors(collectErrors(parsed.error));
      setResult(null);
      return;
    }
    setErrors({});
    run(
      () => saveProfile(formData),
      (outcome) => {
        if (outcome.status === "invalid") setErrors(outcome.fieldErrors);
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <FormSection
        title="Identité"
        description="Le pseudo est repris dans le filigrane de vos photos : le changer casserait la correspondance sur les annonces déjà en ligne."
      >
        <Input id="username" label="Pseudo" isRequired defaultValue={defaults.username} error={errors.username} autoComplete="nickname" />
        <Textarea
          id="bio"
          label="Présentation"
          rows={4}
          defaultValue={defaults.bio}
          error={errors.bio}
          hint="Deux lignes suffisent : ce que vous vendez, et comment vous organisez les remises en main propre."
        />
      </FormSection>

      <FormSection
        title="Où vous remettez les lots"
        description="La commune place vos annonces sur la carte des acheteurs. L'adresse exacte n'est jamais demandée ni stockée : elle se convient dans la conversation."
      >
        <CityCombobox id="city" label="Commune" autoComplete="address-level2" defaultValue={defaults.city} defaultCity={defaults.place} error={errors.city ?? errors.postalCode} />
      </FormSection>

      {shop ? <ShopFields shop={shop} errors={errors} /> : null}

      <div className="flex flex-col gap-2">
        <div>
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
          </Button>
        </div>
        <PersistenceNote result={result} action="mettre à jour le profil" />
      </div>
    </form>
  );
}
