import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAccountAction } from "@/app/actions/profile";
import { AlertSettingsForm } from "@/components/account/AlertSettingsForm";
import { DeleteAction } from "@/components/account/DeleteAction";
import { ProStatusSection } from "@/components/account/ProStatusSection";
import { FormSection } from "@/components/deposit/FormSection";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAlertSettings } from "@/lib/data/account-settings";
import { getListingsOwnedBy } from "@/lib/data/listings";
import { getProfileById } from "@/lib/data/profiles";
import { requireCurrentUserId } from "@/lib/data/session";
import { getWantedListingsByBuyer } from "@/lib/data/wanted";
import { countLabel } from "@/lib/french";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Paramètres" };

export default async function AccountSettingsPage() {
  const userId = await requireCurrentUserId(routes.accountSettings);
  const [profile, listings, wantedListings, alerts] = await Promise.all([
    getProfileById(userId),
    getListingsOwnedBy(userId, { includeSold: true }),
    getWantedListingsByBuyer(userId),
    getAlertSettings(),
  ]);
  if (!profile) notFound();

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        size="md"
        title="Paramètres du compte"
        description="Rien de ce qui est ici n'apparaît sur vos annonces."
      />

      <FormSection
        title="Connexion"
        description="L'adresse sert à vous reconnecter et à recevoir les alertes. Elle n'est jamais affichée aux acheteurs, qui passent par la messagerie."
      >
        <Input id="email" label="Adresse e-mail" type="email" isRequired autoComplete="email" />
        <Input
          id="password"
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          hint="Laissez vide pour conserver le mot de passe actuel."
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled>
          Enregistrer
        </Button>
        <p className="text-[length:var(--text-sm)] leading-relaxed text-[var(--muted)]">
          L&apos;adresse et le mot de passe ne se changent pas encore ici. Pour un nouveau mot de passe, passez
          par{" "}
          <Link href={routes.passwordReset} className="text-link">
            « Mot de passe oublié »
          </Link>
          .
        </p>
      </div>

      <AlertSettingsForm defaults={alerts} />

      <ProStatusSection profile={profile} />

      {/* La suppression du compte est en bas, séparée, et déplie la même
          confirmation en deux temps que celle des annonces : un geste
          irréversible ne se distingue pas des autres par sa couleur seule. */}
      <div className="panel mt-8 border-[var(--danger)]">
        <h2 className="display display-h3">Supprimer le compte</h2>
        <p className="mt-3 text-[length:var(--text-lg)] leading-relaxed text-[var(--ink-soft)]">
          {countLabel(listings.length, "annonce")} et {countLabel(wantedListings.length, "recherche")}{" "}
          disparaîtraient avec lui, leurs liens permanents compris. Les avis que vous avez laissés
          à d&apos;autres vendeurs restent sur leur profil : ils leur appartiennent, pas à vous.
        </p>
        <p className="mt-3 text-[length:var(--text-md)] leading-relaxed text-[var(--muted)]">
          Pour arrêter simplement de recevoir des propositions, passez vos annonces en « Vendu » et
          vos recherches en « Trouvé » : le compte reste, la note aussi.
        </p>
        <div className="mt-5">
          <DeleteAction
            itemName={`le compte ${profile.username}`}
            onConfirmAction={deleteAccountAction}
            buttonLabel="Supprimer mon compte"
            confirmLabel="Supprimer le compte"
            consequence="Cette action ne se défait pas. Le pseudo est libéré, les annonces et les recherches sont retirées, et les liens partagés cessent de répondre."
          />
        </div>
      </div>
    </div>
  );
}
